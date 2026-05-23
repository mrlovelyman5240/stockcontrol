"""Orders routes: list, create (atomic stock deduction), update, complete, cancel, delete."""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import Order, OrderCreate, OrderItem, OrderUpdate
from security import create_audit_log, get_current_user, require_role

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=List[Order])
async def get_orders(
    status: Optional[str] = None,
    driver_id: Optional[str] = None,
    date: Optional[str] = None,
    user=Depends(get_current_user),
):
    query = {}

    # Drivers can only see their own orders
    if user["role"] == "driver":
        query["driver_id"] = user["user_id"]
    elif driver_id:
        query["driver_id"] = driver_id

    if status:
        query["status"] = status

    if date:
        query["created_at"] = {"$regex": f"^{date}"}

    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Order(**order) for order in orders]


@router.get("/today", response_model=List[Order])
async def get_today_orders(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    query = {"created_at": {"$regex": f"^{today}"}}

    if user["role"] == "driver":
        query["driver_id"] = user["user_id"]

    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Order(**order) for order in orders]


@router.post("", response_model=Order)
async def create_order(
    order_data: OrderCreate,
    user=Depends(require_role(["boss", "customer_service"])),
):
    driver = await db.users.find_one({"id": order_data.driver_id, "role": "driver"}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=400, detail="Invalid driver selected")

    if not order_data.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    # Resolve authoritative price + base-stock cost from DB for each item; never trust client.
    # `base_cost` = how many units of product.stock this line consumes (= quantity for non-variant
    # items, or quantity * variant.units_per for variant items).
    resolved_items: List[OrderItem] = []
    base_costs: List[int] = []
    for item in order_data.items:
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Invalid quantity for {item.name}")

        inv_item = await db.inventory.find_one({"id": item.item_id}, {"_id": 0})
        if not inv_item:
            raise HTTPException(status_code=400, detail=f"Item {item.name} not found")

        if item.variant_name and inv_item.get("variants"):
            variant = next((v for v in inv_item["variants"] if v["name"] == item.variant_name), None)
            if not variant:
                raise HTTPException(
                    status_code=400,
                    detail=f"Variant {item.variant_name} not found for {inv_item['name']}",
                )
            unit_price = float(variant.get("price", 0))
            units_per = int(variant.get("units_per", 1)) or 1
        else:
            unit_price = float(inv_item.get("price", 0))
            units_per = 1
        base_cost = item.quantity * units_per

        resolved_items.append(
            OrderItem(
                item_id=item.item_id,
                name=inv_item["name"],
                price=0.0 if item.is_free_gift else unit_price,
                quantity=item.quantity,
                variant_name=item.variant_name,
                is_free_gift=item.is_free_gift,
                units_per=units_per,
            )
        )
        base_costs.append(base_cost)

    # Atomically deduct base stock with a $gte guard; rollback prior deductions if any fails.
    # Free gifts also deduct stock — they are real items leaving the warehouse.
    deducted: List[tuple] = []  # list of (item_id, base_cost)
    for item, base_cost in zip(resolved_items, base_costs):
        result = await db.inventory.update_one(
            {"id": item.item_id, "stock": {"$gte": base_cost}},
            {"$inc": {"stock": -base_cost}},
        )

        if result.modified_count == 0:
            for done_id, done_cost in deducted:
                await db.inventory.update_one(
                    {"id": done_id},
                    {"$inc": {"stock": done_cost}},
                )
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {item.name}")

        deducted.append((item.item_id, base_cost))

    total = round(sum(i.price * i.quantity for i in resolved_items), 2)

    order = Order(
        address=order_data.address,
        items=resolved_items,
        total=total,
        order_type=order_data.order_type,
        status="pending",
        driver_id=order_data.driver_id,
        driver_name=order_data.driver_name,
        created_by=user["user_id"],
        created_by_name=user["username"],
    )
    await db.orders.insert_one(order.model_dump())
    return order


@router.put("/{order_id}", response_model=Order)
async def update_order(
    order_id: str,
    update: OrderUpdate,
    user=Depends(require_role(["boss", "customer_service"])),
):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}

    if "driver_id" in update_data:
        driver = await db.users.find_one(
            {"id": update_data["driver_id"], "role": "driver"}, {"_id": 0}
        )
        if not driver:
            raise HTTPException(status_code=400, detail="Invalid driver selected")
        update_data["driver_name"] = driver.get("full_name") or driver["username"]

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.orders.update_one({"id": order_id}, {"$set": update_data})

    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return Order(**updated)


@router.put("/{order_id}/complete", response_model=Order)
async def complete_order(
    order_id: str,
    user=Depends(require_role(["boss", "customer_service", "driver"])),
):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")

    if existing["status"] != "pending":
        raise HTTPException(status_code=400, detail="Order is not in pending status")

    if user["role"] == "driver" and existing.get("driver_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only complete your own orders")

    # Atomic pending→completed transition. If a concurrent /cancel or /delete already
    # changed status, modified_count will be 0 and we reject — preventing a state where
    # the order ends up completed while stock was restored by the racing cancel.
    now = datetime.now(timezone.utc).isoformat()
    result = await db.orders.update_one(
        {"id": order_id, "status": "pending"},
        {"$set": {
            "status": "completed",
            "completed_at": now,
            "completed_by": user["username"],
            "updated_at": now,
        }},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=409, detail="Order is no longer pending")

    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return Order(**updated)


@router.put("/{order_id}/cancel", response_model=Order)
async def cancel_order(
    order_id: str,
    user=Depends(require_role(["boss", "customer_service"])),
):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")

    if existing["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending orders can be cancelled")

    # Atomic pending→cancelled transition. Only the winning request restores stock;
    # a concurrent cancel/delete/complete that loses the race will see modified_count=0
    # and exit without touching stock — preventing double restoration.
    now = datetime.now(timezone.utc).isoformat()
    result = await db.orders.update_one(
        {"id": order_id, "status": "pending"},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": user["username"],
            "cancelled_at": now,
            "updated_at": now,
        }},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=409, detail="Order is no longer pending")

    # Restore base stock using units_per snapshotted on each OrderItem at creation
    # (so later variant changes can't drift the math). Free gifts included.
    for item in existing["items"]:
        units_per = int(item.get("units_per", 1)) or 1
        base_cost = item["quantity"] * units_per
        await db.inventory.update_one(
            {"id": item["item_id"]},
            {"$inc": {"stock": base_cost}},
        )

    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})

    await create_audit_log(
        action="cancel",
        entity_type="order",
        entity_id=order_id,
        entity_name=f"Order #{order_id[:8]}",
        user_id=user["user_id"],
        user_name=user["username"],
        details=f"Cancelled order worth ${existing['total']:.2f}",
    )

    return Order(**updated)


@router.delete("/{order_id}")
async def delete_order(
    order_id: str,
    user=Depends(require_role(["boss", "customer_service"])),
):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")

    # For pending orders the delete is the authoritative state change — use a
    # conditional delete so only one request restores stock if two arrive concurrently.
    # Non-pending orders (cancelled/completed) just need the row gone; stock was
    # already restored at cancellation or shipped on completion.
    if existing.get("status") == "pending":
        deleted = await db.orders.delete_one({"id": order_id, "status": "pending"})
        if deleted.deleted_count == 1:
            for item in existing["items"]:
                units_per = int(item.get("units_per", 1)) or 1
                base_cost = item["quantity"] * units_per
                await db.inventory.update_one(
                    {"id": item["item_id"]},
                    {"$inc": {"stock": base_cost}},
                )
        else:
            # Lost the race to a concurrent cancel/complete/delete; just remove the row
            # if it still exists, never restore stock here.
            await db.orders.delete_one({"id": order_id})
    else:
        await db.orders.delete_one({"id": order_id})

    if user["role"] == "customer_service":
        await create_audit_log(
            action="delete",
            entity_type="order",
            entity_id=order_id,
            entity_name=f"Order to {existing['address']}",
            user_id=user["user_id"],
            user_name=user["username"],
            details=f"Deleted order worth ${existing['total']}",
        )

    return {"message": "Order deleted"}
