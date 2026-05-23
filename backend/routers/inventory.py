"""Inventory CRUD routes."""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import InventoryCreate, InventoryItem, InventoryUpdate
from security import create_audit_log, get_current_user, require_role

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("", response_model=List[InventoryItem])
async def get_inventory(user=Depends(get_current_user)):
    items = await db.inventory.find({}, {"_id": 0}).to_list(1000)
    return [InventoryItem(**item) for item in items]


@router.post("", response_model=InventoryItem)
async def create_inventory_item(
    item: InventoryCreate,
    user=Depends(require_role(["boss", "customer_service"])),
):
    inventory_item = InventoryItem(**item.model_dump())
    await db.inventory.insert_one(inventory_item.model_dump())
    return inventory_item


@router.put("/{item_id}", response_model=InventoryItem)
async def update_inventory_item(
    item_id: str,
    update: InventoryUpdate,
    user=Depends(require_role(["boss", "customer_service"])),
):
    existing = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.inventory.update_one({"id": item_id}, {"$set": update_data})

    if user["role"] == "customer_service":
        await create_audit_log(
            action="update",
            entity_type="inventory",
            entity_id=item_id,
            entity_name=existing["name"],
            user_id=user["user_id"],
            user_name=user["username"],
            details=f"Updated fields: {list(update_data.keys())}",
        )

    updated = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    return InventoryItem(**updated)


@router.delete("/{item_id}")
async def delete_inventory_item(
    item_id: str,
    user=Depends(require_role(["boss", "customer_service"])),
):
    existing = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")

    await db.inventory.delete_one({"id": item_id})

    if user["role"] == "customer_service":
        await create_audit_log(
            action="delete",
            entity_type="inventory",
            entity_id=item_id,
            entity_name=existing["name"],
            user_id=user["user_id"],
            user_name=user["username"],
            details=f"Deleted inventory item: {existing['name']}",
        )

    return {"message": "Item deleted"}
