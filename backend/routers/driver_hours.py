"""Driver hours logging — boss/CS logs hours per driver per date."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import DriverHours, DriverHoursCreate
from security import get_current_user, require_role

router = APIRouter(prefix="/driver-hours", tags=["driver-hours"])


@router.get("")
async def get_driver_hours(
    date: Optional[str] = None,
    driver_id: Optional[str] = None,
    user=Depends(get_current_user),
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


@router.post("", response_model=DriverHours)
async def log_driver_hours(
    hours_data: DriverHoursCreate,
    user=Depends(require_role(["boss", "customer_service"])),
):
    driver = await db.users.find_one({"id": hours_data.driver_id, "role": "driver"}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    existing = await db.driver_hours.find_one({
        "driver_id": hours_data.driver_id,
        "date": hours_data.date,
    }, {"_id": 0})

    if existing:
        await db.driver_hours.update_one(
            {"id": existing["id"]},
            {"$set": {"hours": hours_data.hours, "logged_by": user["username"]}},
        )
        updated = await db.driver_hours.find_one({"id": existing["id"]}, {"_id": 0})
        return DriverHours(**updated)

    driver_hours = DriverHours(
        driver_id=hours_data.driver_id,
        date=hours_data.date,
        hours=hours_data.hours,
    )
    doc = driver_hours.model_dump()
    doc["logged_by"] = user["username"]
    doc["driver_name"] = driver["username"]
    await db.driver_hours.insert_one(doc)
    return driver_hours
