"""Financial ledger and boss/driver statistics dashboards."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends

from database import db
from models import Payment, Settings
from security import require_role

router = APIRouter(tags=["stats"])


@router.get("/ledger")
async def get_financial_ledger(
    type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    driver_id: Optional[str] = None,
    search: Optional[str] = None,
    user=Depends(require_role(["boss"])),
):
    ledger = []

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
                "details": {"items_count": len(o.get("items", [])), "order_type": o.get("order_type", "delivery")},
            }
            if search:
                search_lower = search.lower()
                desc_match = search_lower in entry["description"].lower()
                driver_match = entry["driver_name"] and search_lower in entry["driver_name"].lower()
                if not desc_match and not driver_match:
                    continue
            ledger.append(entry)

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
                "details": {"approved_by": p.get("approved_by", "")},
            }
            if search:
                search_lower = search.lower()
                desc_match = search_lower in entry["description"].lower()
                driver_match = entry["driver_name"] and search_lower in entry["driver_name"].lower()
                if not desc_match and not driver_match:
                    continue
            ledger.append(entry)

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
                "details": {"logged_by": h.get("logged_by", ""), "date": h["date"]},
            }
            if search:
                search_lower = search.lower()
                desc_match = search_lower in entry["description"].lower()
                driver_match = entry["driver_name"] and search_lower in entry["driver_name"].lower()
                if not desc_match and not driver_match:
                    continue
            ledger.append(entry)

    ledger.sort(key=lambda x: x["timestamp"], reverse=True)
    return ledger


@router.get("/stats/boss")
async def get_boss_stats(user=Depends(require_role(["boss"]))):
    orders = await db.orders.find({}, {"_id": 0}).to_list(10000)

    pending_orders = [o for o in orders if o["status"] == "pending"]
    completed_orders = [o for o in orders if o["status"] == "completed"]

    pending_revenue = sum(o["total"] for o in pending_orders)
    total_revenue = sum(o["total"] for o in completed_orders)

    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not settings:
        settings = Settings().model_dump()

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

    net_profit = total_revenue - total_staff_payments

    approved_payments = await db.payments.find({"status": "approved"}, {"_id": 0}).to_list(10000)
    total_collected = sum(p["amount"] for p in approved_payments)

    drivers = await db.users.find({"role": "driver"}, {"_id": 0, "password": 0}).to_list(100)
    pending_collections = []

    for driver in drivers:
        driver_completed = [o for o in completed_orders if o.get("driver_id") == driver["id"]]
        driver_sales = sum(o["total"] for o in driver_completed)

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

        holding = driver_sales - driver_earnings

        driver_approved = await db.payments.find({
            "driver_id": driver["id"],
            "status": "approved",
        }, {"_id": 0}).to_list(1000)
        total_driver_paid = sum(p["amount"] for p in driver_approved)

        pending_amount = max(0, holding - total_driver_paid)

        if pending_amount > 0:
            pending_collections.append({
                "driver_id": driver["id"],
                "driver_name": driver["username"],
                "amount": pending_amount,
                "total_sales": driver_sales,
                "driver_earnings": driver_earnings,
            })

    pending_payments = await db.payments.find({"status": "pending"}, {"_id": 0}).to_list(100)

    return {
        "pending_revenue": pending_revenue,
        "total_revenue": total_revenue,
        "total_staff_payments": total_staff_payments,
        "net_profit": net_profit,
        "total_collected": total_collected,
        "pending_collections": pending_collections,
        "pending_payments": [Payment(**p).model_dump() for p in pending_payments],
        "pending_orders": pending_orders,
        "total_orders": len(orders),
        "pending_count": len(pending_orders),
        "completed_count": len(completed_orders),
    }


@router.get("/stats/driver")
async def get_driver_stats(date: Optional[str] = None, user=Depends(require_role(["driver"]))):
    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not settings:
        settings = Settings().model_dump()

    all_driver_orders = await db.orders.find({"driver_id": user["user_id"]}, {"_id": 0}).to_list(10000)

    pending_orders = [o for o in all_driver_orders if o["status"] == "pending"]
    completed_orders = [o for o in all_driver_orders if o["status"] == "completed"]

    pending_revenue = sum(o["total"] for o in pending_orders)
    total_sales = sum(o["total"] for o in completed_orders)
    packages_delivered = len(completed_orders)

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

    if settings["payment_method"] == "per_package":
        pending_deliveries = len([o for o in pending_orders if o.get("order_type", "delivery") == "delivery"])
        pending_pickups = len([o for o in pending_orders if o.get("order_type", "delivery") == "pickup"])
        expected_earnings = (pending_deliveries * delivery_rate) + (pending_pickups * pickup_rate)
    else:
        expected_earnings = 0

    holding = total_sales - earnings

    approved_payments = await db.payments.find({
        "driver_id": user["user_id"],
        "status": "approved",
    }, {"_id": 0}).to_list(1000)
    total_paid = sum(p["amount"] for p in approved_payments)

    pending_to_boss = max(0, holding - total_paid)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_orders = [o for o in all_driver_orders if o["created_at"].startswith(today)]
    today_pending = [o for o in today_orders if o["status"] == "pending"]
    today_completed = [o for o in today_orders if o["status"] == "completed"]

    return {
        "payment_method": settings["payment_method"],
        "hourly_rate": settings["hourly_rate"],
        "per_delivery_rate": settings.get("per_delivery_rate", settings.get("per_package_rate", 5.0)),
        "per_pickup_rate": settings.get("per_pickup_rate", settings.get("per_package_rate", 3.0)),
        "pending_revenue": pending_revenue,
        "pending_count": len(pending_orders),
        "expected_earnings": expected_earnings,
        "total_sales": total_sales,
        "packages_delivered": packages_delivered,
        "deliveries_completed": deliveries_completed,
        "pickups_completed": pickups_completed,
        "hours_logged": hours_logged,
        "earnings": earnings,
        "holding": holding,
        "total_paid": total_paid,
        "pending_to_boss": pending_to_boss,
        "today_orders": len(today_orders),
        "today_pending": len(today_pending),
        "today_completed": len(today_completed),
        "today_pending_revenue": sum(o["total"] for o in today_pending),
        "today_revenue": sum(o["total"] for o in today_completed),
    }
