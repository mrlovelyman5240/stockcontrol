from fastapi import FastAPI, APIRouter, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from database import client, db
from models import (
    InventoryItem, InventoryCreate, InventoryUpdate,
    OrderItem, Order, OrderCreate, OrderUpdate,
    Payment, PaymentCreate, DriverHours, DriverHoursCreate,
    Settings, SettingsUpdate, AuditLog,
)
from security import get_current_user, require_role, create_audit_log, hash_password
from rate_limit import limiter
from routers import auth as auth_router
from routers import users as users_router

# Create the main app
app = FastAPI(title="Mixy Logistics API")

# Rate limiter (per client IP). Attached to app so SlowAPI middleware can access it via app.state.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Mount sub-routers under /api
api_router.include_router(auth_router.router)
api_router.include_router(users_router.router)

# ============== INVENTORY ROUTES ==============

@api_router.get("/inventory", response_model=List[InventoryItem])
async def get_inventory(user = Depends(get_current_user)):
    items = await db.inventory.find({}, {"_id": 0}).to_list(1000)
    return [InventoryItem(**item) for item in items]

@api_router.post("/inventory", response_model=InventoryItem)
async def create_inventory_item(item: InventoryCreate, user = Depends(require_role(["boss", "customer_service"]))):
    inventory_item = InventoryItem(**item.model_dump())
    await db.inventory.insert_one(inventory_item.model_dump())
    return inventory_item

@api_router.put("/inventory/{item_id}", response_model=InventoryItem)
async def update_inventory_item(item_id: str, update: InventoryUpdate, user = Depends(require_role(["boss", "customer_service"]))):
    existing = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")
    
    update_data = {}
    for k, v in update.model_dump().items():
        if v is not None:
            update_data[k] = v
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.inventory.update_one({"id": item_id}, {"$set": update_data})
    
    # Log if customer service
    if user["role"] == "customer_service":
        await create_audit_log(
            action="update",
            entity_type="inventory",
            entity_id=item_id,
            entity_name=existing["name"],
            user_id=user["user_id"],
            user_name=user["username"],
            details=f"Updated fields: {list(update_data.keys())}"
        )
    
    updated = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    return InventoryItem(**updated)

@api_router.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str, user = Depends(require_role(["boss", "customer_service"]))):
    existing = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")
    
    await db.inventory.delete_one({"id": item_id})
    
    # Log if customer service
    if user["role"] == "customer_service":
        await create_audit_log(
            action="delete",
            entity_type="inventory",
            entity_id=item_id,
            entity_name=existing["name"],
            user_id=user["user_id"],
            user_name=user["username"],
            details=f"Deleted inventory item: {existing['name']}"
        )
    
    return {"message": "Item deleted"}

# ============== ORDERS ROUTES ==============

@api_router.get("/orders", response_model=List[Order])
async def get_orders(
    status: Optional[str] = None,
    driver_id: Optional[str] = None,
    date: Optional[str] = None,
    user = Depends(get_current_user)
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
        # Filter by date (orders created on that date)
        query["created_at"] = {"$regex": f"^{date}"}
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Order(**order) for order in orders]

@api_router.get("/orders/today", response_model=List[Order])
async def get_today_orders(user = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    query = {"created_at": {"$regex": f"^{today}"}}
    
    if user["role"] == "driver":
        query["driver_id"] = user["user_id"]
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Order(**order) for order in orders]

@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, user = Depends(require_role(["boss", "customer_service"]))):
    # Validate driver exists
    driver = await db.users.find_one({"id": order_data.driver_id, "role": "driver"}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=400, detail="Invalid driver selected")

    if not order_data.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    # Resolve authoritative price from DB for each item; never trust client price/total.
    resolved_items: List[OrderItem] = []
    for item in order_data.items:
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Invalid quantity for {item.name}")

        inv_item = await db.inventory.find_one({"id": item.item_id}, {"_id": 0})
        if not inv_item:
            raise HTTPException(status_code=400, detail=f"Item {item.name} not found")

        if item.variant_name and inv_item.get("variants"):
            variant = next((v for v in inv_item["variants"] if v["name"] == item.variant_name), None)
            if not variant:
                raise HTTPException(status_code=400, detail=f"Variant {item.variant_name} not found for {inv_item['name']}")
            unit_price = float(variant.get("price", 0))
        else:
            unit_price = float(inv_item.get("price", 0))

        resolved_items.append(OrderItem(
            item_id=item.item_id,
            name=inv_item["name"],
            price=0.0 if item.is_free_gift else unit_price,
            quantity=item.quantity,
            variant_name=item.variant_name,
            is_free_gift=item.is_free_gift,
        ))

    # Atomically deduct inventory; rollback prior deductions if any fails (race-safe).
    # Free gifts also deduct stock -- they are real items leaving the warehouse.
    deducted: List[OrderItem] = []
    for item in resolved_items:
        if item.variant_name:
            result = await db.inventory.update_one(
                {
                    "id": item.item_id,
                    "variants": {"$elemMatch": {"name": item.variant_name, "stock": {"$gte": item.quantity}}},
                },
                {"$inc": {"variants.$.stock": -item.quantity}}
            )
        else:
            result = await db.inventory.update_one(
                {"id": item.item_id, "stock": {"$gte": item.quantity}},
                {"$inc": {"stock": -item.quantity}}
            )

        if result.modified_count == 0:
            # Rollback already-deducted items
            for done in deducted:
                if done.variant_name:
                    await db.inventory.update_one(
                        {"id": done.item_id, "variants.name": done.variant_name},
                        {"$inc": {"variants.$.stock": done.quantity}}
                    )
                else:
                    await db.inventory.update_one(
                        {"id": done.item_id},
                        {"$inc": {"stock": done.quantity}}
                    )
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {item.name}")

        deducted.append(item)

    total = round(sum(i.price * i.quantity for i in resolved_items), 2)

    order = Order(
        address=order_data.address,
        items=resolved_items,
        total=total,
        order_type=order_data.order_type,
        status="pending",  # Order starts as pending, assigned to driver
        driver_id=order_data.driver_id,
        driver_name=order_data.driver_name,
        created_by=user["user_id"],
        created_by_name=user["username"]
    )
    await db.orders.insert_one(order.model_dump())
    return order

@api_router.put("/orders/{order_id}", response_model=Order)
async def update_order(
    order_id: str,
    update: OrderUpdate,
    user = Depends(require_role(["boss", "customer_service"]))
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
        # Force driver_name to match the actual driver record
        update_data["driver_name"] = driver.get("full_name") or driver["username"]

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    if update_data.get("status") == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    await db.orders.update_one({"id": order_id}, {"$set": update_data})

    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return Order(**updated)

# Endpoint for Boss/CS/Driver to mark order as Done
@api_router.put("/orders/{order_id}/complete", response_model=Order)
async def complete_order(order_id: str, user = Depends(require_role(["boss", "customer_service", "driver"]))):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if existing["status"] != "pending":
        raise HTTPException(status_code=400, detail="Order is not in pending status")
    
    # Drivers can only complete their own orders
    if user["role"] == "driver" and existing.get("driver_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only complete your own orders")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "completed_by": user["username"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return Order(**updated)

# Endpoint to cancel an order
@api_router.put("/orders/{order_id}/cancel", response_model=Order)
async def cancel_order(order_id: str, user = Depends(require_role(["boss", "customer_service"]))):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if existing["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending orders can be cancelled")
    
    # Restore inventory for cancelled order (free gifts included -- they were deducted at creation)
    for item in existing["items"]:
        if item.get("variant_name"):
            await db.inventory.update_one(
                {"id": item["item_id"], "variants.name": item["variant_name"]},
                {"$inc": {"variants.$.stock": item["quantity"]}}
            )
        else:
            await db.inventory.update_one(
                {"id": item["item_id"]},
                {"$inc": {"stock": item["quantity"]}}
            )

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": user["username"],
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    
    # Audit log
    await create_audit_log(
        action="cancel",
        entity_type="order",
        entity_id=order_id,
        entity_name=f"Order #{order_id[:8]}",
        user_id=user["user_id"],
        user_name=user["username"],
        details=f"Cancelled order worth ${existing['total']:.2f}"
    )
    
    return Order(**updated)

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, user = Depends(require_role(["boss", "customer_service"]))):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Restore inventory only for pending orders. Cancelled orders already returned
    # stock at cancellation; completed orders' goods have been delivered.
    if existing.get("status") == "pending":
        for item in existing["items"]:
            if item.get("variant_name"):
                await db.inventory.update_one(
                    {"id": item["item_id"], "variants.name": item["variant_name"]},
                    {"$inc": {"variants.$.stock": item["quantity"]}}
                )
            else:
                await db.inventory.update_one(
                    {"id": item["item_id"]},
                    {"$inc": {"stock": item["quantity"]}}
                )

    await db.orders.delete_one({"id": order_id})
    
    # Log if customer service
    if user["role"] == "customer_service":
        await create_audit_log(
            action="delete",
            entity_type="order",
            entity_id=order_id,
            entity_name=f"Order to {existing['address']}",
            user_id=user["user_id"],
            user_name=user["username"],
            details=f"Deleted order worth ${existing['total']}"
        )
    
    return {"message": "Order deleted"}

# ============== PAYMENTS ROUTES ==============

@api_router.get("/payments", response_model=List[Payment])
async def get_payments(
    driver_id: Optional[str] = None,
    status: Optional[str] = None,
    user = Depends(get_current_user)
):
    query = {}
    
    if user["role"] == "driver":
        query["driver_id"] = user["user_id"]
    elif driver_id:
        query["driver_id"] = driver_id
    
    if status:
        query["status"] = status
    
    payments = await db.payments.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(1000)
    return [Payment(**p) for p in payments]

@api_router.post("/payments", response_model=Payment)
async def submit_payment(payment_data: PaymentCreate, user = Depends(require_role(["driver"]))):
    payment = Payment(
        driver_id=user["user_id"],
        driver_name=user["username"],
        amount=payment_data.amount
    )
    await db.payments.insert_one(payment.model_dump())
    return payment

@api_router.put("/payments/{payment_id}/approve", response_model=Payment)
async def approve_payment(payment_id: str, user = Depends(require_role(["boss"]))):
    existing = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": user["username"]
        }}
    )
    
    updated = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    return Payment(**updated)

@api_router.put("/payments/{payment_id}/reject", response_model=Payment)
async def reject_payment(payment_id: str, user = Depends(require_role(["boss"]))):
    existing = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": "rejected"}}
    )
    
    updated = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    return Payment(**updated)

# ============== DRIVER HOURS ROUTES ==============

@api_router.get("/driver-hours")
async def get_driver_hours(
    date: Optional[str] = None,
    driver_id: Optional[str] = None,
    user = Depends(get_current_user)
):
    query = {}
    if user["role"] == "driver":
        query["driver_id"] = user["user_id"]
    elif driver_id:
        query["driver_id"] = driver_id
    if date:
        query["date"] = date
    
    hours = await db.driver_hours.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [DriverHours(**h) for h in hours]

@api_router.post("/driver-hours", response_model=DriverHours)
async def log_driver_hours(hours_data: DriverHoursCreate, user = Depends(require_role(["boss", "customer_service"]))):
    # Verify driver exists
    driver = await db.users.find_one({"id": hours_data.driver_id, "role": "driver"}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Check if entry exists for this driver+date
    existing = await db.driver_hours.find_one({
        "driver_id": hours_data.driver_id,
        "date": hours_data.date
    }, {"_id": 0})
    
    if existing:
        await db.driver_hours.update_one(
            {"id": existing["id"]},
            {"$set": {"hours": hours_data.hours, "logged_by": user["username"]}}
        )
        updated = await db.driver_hours.find_one({"id": existing["id"]}, {"_id": 0})
        return DriverHours(**updated)
    
    driver_hours = DriverHours(
        driver_id=hours_data.driver_id,
        date=hours_data.date,
        hours=hours_data.hours
    )
    doc = driver_hours.model_dump()
    doc["logged_by"] = user["username"]
    doc["driver_name"] = driver["username"]
    await db.driver_hours.insert_one(doc)
    return driver_hours

# ============== SETTINGS ROUTES ==============

@api_router.get("/settings", response_model=Settings)
async def get_settings(user = Depends(get_current_user)):
    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not settings:
        # Create default settings
        default = Settings()
        await db.settings.insert_one(default.model_dump())
        return default
    return Settings(**settings)

@api_router.put("/settings", response_model=Settings)
async def update_settings(update: SettingsUpdate, user = Depends(require_role(["boss"]))):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = user["username"]
    
    await db.settings.update_one(
        {"id": "global_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    return Settings(**settings)

# ============== AUDIT LOGS ROUTES ==============

@api_router.get("/audit-logs", response_model=List[AuditLog])
async def get_audit_logs(user = Depends(require_role(["boss"]))):
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(1000)
    return [AuditLog(**log) for log in logs]

# ============== FINANCIAL LEDGER ROUTE ==============

@api_router.get("/ledger")
async def get_financial_ledger(
    type: Optional[str] = None,  # orders, deposits, hours
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    driver_id: Optional[str] = None,
    search: Optional[str] = None,
    user = Depends(require_role(["boss"]))
):
    ledger = []
    
    # Get completed orders
    if not type or type == "orders":
        order_query = {"status": {"$in": ["completed", "cancelled"]}}
        if driver_id:
            order_query["driver_id"] = driver_id
        orders = await db.orders.find(order_query, {"_id": 0}).to_list(10000)
        for o in orders:
            ts = o.get("delivered_at") or o.get("updated_at") or o["created_at"]
            if date_from and ts < date_from:
                continue
            if date_to and ts > date_to + "T23:59:59":
                continue
            entry = {
                "id": o["id"],
                "type": "order",
                "subtype": o["status"],
                "amount": o["total"],
                "description": f"Order #{o['id'][:8]} ({o.get('order_type','delivery')}) - {o['status']}",
                "driver_name": o.get("driver_name", ""),
                "driver_id": o.get("driver_id", ""),
                "timestamp": ts,
                "details": {"items_count": len(o.get("items", [])), "order_type": o.get("order_type", "delivery")}
            }
            if search:
                search_lower = search.lower()
                desc_match = search_lower in entry["description"].lower()
                driver_match = entry["driver_name"] and search_lower in entry["driver_name"].lower()
                if not desc_match and not driver_match:
                    continue
            ledger.append(entry)
    
    # Get deposits (payments)
    if not type or type == "deposits":
        pay_query = {}
        if driver_id:
            pay_query["driver_id"] = driver_id
        payments = await db.payments.find(pay_query, {"_id": 0}).to_list(10000)
        for p in payments:
            ts = p.get("approved_at") or p["submitted_at"]
            if date_from and ts < date_from:
                continue
            if date_to and ts > date_to + "T23:59:59":
                continue
            entry = {
                "id": p["id"],
                "type": "deposit",
                "subtype": p["status"],
                "amount": p["amount"],
                "description": f"Deposit by {p['driver_name']} - {p['status']}",
                "driver_name": p.get("driver_name", ""),
                "driver_id": p.get("driver_id", ""),
                "timestamp": ts,
                "details": {"approved_by": p.get("approved_by", "")}
            }
            if search:
                search_lower = search.lower()
                desc_match = search_lower in entry["description"].lower()
                driver_match = entry["driver_name"] and search_lower in entry["driver_name"].lower()
                if not desc_match and not driver_match:
                    continue
            ledger.append(entry)
    
    # Get hours logged
    if not type or type == "hours":
        hr_query = {}
        if driver_id:
            hr_query["driver_id"] = driver_id
        hours = await db.driver_hours.find(hr_query, {"_id": 0}).to_list(10000)
        for h in hours:
            ts = h.get("created_at", h["date"])
            if date_from and h["date"] < date_from:
                continue
            if date_to and h["date"] > date_to:
                continue
            entry = {
                "id": h["id"],
                "type": "hours",
                "subtype": "logged",
                "amount": h["hours"],
                "description": f"{h.get('driver_name', 'Driver')} logged {h['hours']}h on {h['date']}",
                "driver_name": h.get("driver_name", ""),
                "driver_id": h.get("driver_id", ""),
                "timestamp": ts,
                "details": {"logged_by": h.get("logged_by", ""), "date": h["date"]}
            }
            if search:
                search_lower = search.lower()
                desc_match = search_lower in entry["description"].lower()
                driver_match = entry["driver_name"] and search_lower in entry["driver_name"].lower()
                if not desc_match and not driver_match:
                    continue
            ledger.append(entry)
    
    # Sort by timestamp descending
    ledger.sort(key=lambda x: x["timestamp"], reverse=True)
    return ledger

# ============== STATISTICS ROUTES ==============

@api_router.get("/stats/boss")
async def get_boss_stats(user = Depends(require_role(["boss"]))):
    # Get all orders
    orders = await db.orders.find({}, {"_id": 0}).to_list(10000)
    
    # Separate pending and completed orders
    pending_orders = [o for o in orders if o["status"] == "pending"]
    completed_orders = [o for o in orders if o["status"] == "completed"]
    
    # PENDING revenue (not yet finalized - out on delivery)
    pending_revenue = sum(o["total"] for o in pending_orders)
    
    # FINALIZED revenue (completed orders only)
    total_revenue = sum(o["total"] for o in completed_orders)
    
    # Get settings for payment calculation
    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not settings:
        settings = Settings().model_dump()
    
    # Calculate staff payments (only for completed orders)
    total_staff_payments = 0.0
    
    if settings["payment_method"] == "per_package":
        delivery_rate = settings.get("per_delivery_rate", settings.get("per_package_rate", 5.0))
        pickup_rate = settings.get("per_pickup_rate", settings.get("per_package_rate", 3.0))
        delivery_count = len([o for o in completed_orders if o.get("order_type", "delivery") == "delivery"])
        pickup_count = len([o for o in completed_orders if o.get("order_type", "delivery") == "pickup"])
        total_staff_payments = (delivery_count * delivery_rate) + (pickup_count * pickup_rate)
    else:
        hours = await db.driver_hours.find({}, {"_id": 0}).to_list(10000)
        total_hours = sum(h["hours"] for h in hours)
        total_staff_payments = total_hours * settings["hourly_rate"]
    
    # Net profit = finalized revenue - staff payments
    net_profit = total_revenue - total_staff_payments
    
    # Get approved payments from drivers
    approved_payments = await db.payments.find({"status": "approved"}, {"_id": 0}).to_list(10000)
    total_collected = sum(p["amount"] for p in approved_payments)
    
    # Calculate pending collections per driver (only from completed orders)
    drivers = await db.users.find({"role": "driver"}, {"_id": 0, "password": 0}).to_list(100)
    pending_collections = []
    
    for driver in drivers:
        driver_completed = [o for o in completed_orders if o.get("driver_id") == driver["id"]]
        driver_sales = sum(o["total"] for o in driver_completed)
        
        # Calculate driver's earnings from completed orders
        if settings["payment_method"] == "per_package":
            delivery_rate = settings.get("per_delivery_rate", settings.get("per_package_rate", 5.0))
            pickup_rate = settings.get("per_pickup_rate", settings.get("per_package_rate", 3.0))
            d_deliveries = len([o for o in driver_completed if o.get("order_type", "delivery") == "delivery"])
            d_pickups = len([o for o in driver_completed if o.get("order_type", "delivery") == "pickup"])
            driver_earnings = (d_deliveries * delivery_rate) + (d_pickups * pickup_rate)
        else:
            driver_hours = await db.driver_hours.find({"driver_id": driver["id"]}, {"_id": 0}).to_list(1000)
            total_hours = sum(h["hours"] for h in driver_hours)
            driver_earnings = total_hours * settings["hourly_rate"]
        
        # What driver owes (sales - earnings)
        holding = driver_sales - driver_earnings
        
        # Subtract approved payments
        driver_approved = await db.payments.find({
            "driver_id": driver["id"],
            "status": "approved"
        }, {"_id": 0}).to_list(1000)
        total_driver_paid = sum(p["amount"] for p in driver_approved)
        
        pending_amount = max(0, holding - total_driver_paid)
        
        if pending_amount > 0:
            pending_collections.append({
                "driver_id": driver["id"],
                "driver_name": driver["username"],
                "amount": pending_amount,
                "total_sales": driver_sales,
                "driver_earnings": driver_earnings
            })
    
    # Get pending payment submissions
    pending_payments = await db.payments.find({"status": "pending"}, {"_id": 0}).to_list(100)
    
    return {
        "pending_revenue": pending_revenue,  # Money out on delivery (not finalized)
        "total_revenue": total_revenue,      # Finalized revenue (completed orders)
        "total_staff_payments": total_staff_payments,
        "net_profit": net_profit,
        "total_collected": total_collected,
        "pending_collections": pending_collections,
        "pending_payments": [Payment(**p).model_dump() for p in pending_payments],
        "pending_orders": pending_orders,    # List of pending orders
        "total_orders": len(orders),
        "pending_count": len(pending_orders),
        "completed_count": len(completed_orders)
    }

@api_router.get("/stats/driver")
async def get_driver_stats(date: Optional[str] = None, user = Depends(require_role(["driver"]))):
    # Get settings
    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not settings:
        settings = Settings().model_dump()
    
    # Get ALL orders for this driver
    all_driver_orders = await db.orders.find({
        "driver_id": user["user_id"]
    }, {"_id": 0}).to_list(10000)
    
    # Separate pending vs completed
    pending_orders = [o for o in all_driver_orders if o["status"] == "pending"]
    completed_orders = [o for o in all_driver_orders if o["status"] == "completed"]
    
    # PENDING revenue (expected, not yet finalized)
    pending_revenue = sum(o["total"] for o in pending_orders)
    
    # FINALIZED sales (completed orders only)
    total_sales = sum(o["total"] for o in completed_orders)
    packages_delivered = len(completed_orders)
    
    # Calculate FINALIZED earnings (only from completed orders)
    if settings["payment_method"] == "per_package":
        delivery_rate = settings.get("per_delivery_rate", settings.get("per_package_rate", 5.0))
        pickup_rate = settings.get("per_pickup_rate", settings.get("per_package_rate", 3.0))
        deliveries_completed = len([o for o in completed_orders if o.get("order_type", "delivery") == "delivery"])
        pickups_completed = len([o for o in completed_orders if o.get("order_type", "delivery") == "pickup"])
        earnings = (deliveries_completed * delivery_rate) + (pickups_completed * pickup_rate)
        hours_logged = None
    else:
        hours_records = await db.driver_hours.find({"driver_id": user["user_id"]}, {"_id": 0}).to_list(1000)
        hours_logged = sum(h["hours"] for h in hours_records)
        earnings = hours_logged * settings["hourly_rate"]
        deliveries_completed = len([o for o in completed_orders if o.get("order_type", "delivery") == "delivery"])
        pickups_completed = len([o for o in completed_orders if o.get("order_type", "delivery") == "pickup"])
        delivery_rate = settings.get("per_delivery_rate", 5.0)
        pickup_rate = settings.get("per_pickup_rate", 3.0)
    
    # Calculate EXPECTED earnings from pending (for display)
    if settings["payment_method"] == "per_package":
        pending_deliveries = len([o for o in pending_orders if o.get("order_type", "delivery") == "delivery"])
        pending_pickups = len([o for o in pending_orders if o.get("order_type", "delivery") == "pickup"])
        expected_earnings = (pending_deliveries * delivery_rate) + (pending_pickups * pickup_rate)
    else:
        expected_earnings = 0  # Can't predict hours
    
    # Calculate holding (to boss) - only from FINALIZED completed orders
    holding = total_sales - earnings
    
    # Get approved payments
    approved_payments = await db.payments.find({
        "driver_id": user["user_id"], 
        "status": "approved"
    }, {"_id": 0}).to_list(1000)
    total_paid = sum(p["amount"] for p in approved_payments)
    
    # Pending amount to boss (only from finalized)
    pending_to_boss = max(0, holding - total_paid)
    
    # Today's stats
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_orders = [o for o in all_driver_orders if o["created_at"].startswith(today)]
    today_pending = [o for o in today_orders if o["status"] == "pending"]
    today_completed = [o for o in today_orders if o["status"] == "completed"]
    
    return {
        "payment_method": settings["payment_method"],
        "hourly_rate": settings["hourly_rate"],
        "per_delivery_rate": settings.get("per_delivery_rate", settings.get("per_package_rate", 5.0)),
        "per_pickup_rate": settings.get("per_pickup_rate", settings.get("per_package_rate", 3.0)),
        # Pending (expected, not finalized)
        "pending_revenue": pending_revenue,
        "pending_count": len(pending_orders),
        "expected_earnings": expected_earnings,
        # Finalized (completed orders)
        "total_sales": total_sales,
        "packages_delivered": packages_delivered,
        "deliveries_completed": deliveries_completed,
        "pickups_completed": pickups_completed,
        "hours_logged": hours_logged,
        "earnings": earnings,
        "holding": holding,
        "total_paid": total_paid,
        "pending_to_boss": pending_to_boss,
        # Today's stats
        "today_orders": len(today_orders),
        "today_pending": len(today_pending),
        "today_completed": len(today_completed),
        "today_pending_revenue": sum(o["total"] for o in today_pending),
        "today_revenue": sum(o["total"] for o in today_completed)
    }

# ============== HEALTH CHECK ==============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router and middleware
app.include_router(api_router)

_cors_origins_raw = os.environ.get('CORS_ORIGINS', '').strip()
if not _cors_origins_raw:
    raise RuntimeError(
        "CORS_ORIGINS environment variable is required. "
        "Set it to a comma-separated list of allowed origins "
        "(e.g. 'https://stockcontrol.vercel.app,http://localhost:3000')."
    )
_cors_origins = [origin.strip() for origin in _cors_origins_raw.split(',') if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.on_event("startup")
async def ensure_indexes():
    """Create unique indexes for data integrity. Idempotent -- safe to run on every boot."""
    await db.users.create_index("username", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.inventory.create_index("id", unique=True)
    await db.payments.create_index("id", unique=True)
    await db.driver_hours.create_index([("driver_id", 1), ("date", 1)], unique=True)
    logger.info("MongoDB indexes ensured")

@app.on_event("startup")
async def ensure_boss_account():
    """Create initial Boss account from env vars if no boss exists yet.

    Set INITIAL_BOSS_USERNAME and INITIAL_BOSS_PASSWORD to bootstrap the first
    boss account. Once any boss exists, these env vars are ignored.
    """
    initial_username = os.environ.get("INITIAL_BOSS_USERNAME")
    initial_password = os.environ.get("INITIAL_BOSS_PASSWORD")
    if not initial_username or not initial_password:
        return
    existing_boss = await db.users.find_one({"role": "boss"}, {"_id": 0})
    if existing_boss:
        return
    username_taken = await db.users.find_one({"username": initial_username}, {"_id": 0})
    if username_taken:
        logger.warning("INITIAL_BOSS_USERNAME '%s' already taken; skipping boss bootstrap", initial_username)
        return
    boss_doc = {
        "id": str(uuid.uuid4()),
        "username": initial_username,
        "full_name": initial_username,
        "password": hash_password(initial_password),
        "role": "boss",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(boss_doc)
    logger.info("Initial Boss account created from env: %s", initial_username)
    # Ensure settings exist
    existing_settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not existing_settings:
        await db.settings.insert_one(Settings().model_dump())
        logger.info("Default settings initialized")
