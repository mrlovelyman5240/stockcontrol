"""Driver payment submission + boss approve/reject."""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import Payment, PaymentCreate
from security import get_current_user, require_role

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("", response_model=List[Payment])
async def get_payments(
    driver_id: Optional[str] = None,
    status: Optional[str] = None,
    user=Depends(get_current_user),
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


@router.post("", response_model=Payment)
async def submit_payment(
    payment_data: PaymentCreate,
    user=Depends(require_role(["driver"])),
):
    payment = Payment(
        driver_id=user["user_id"],
        driver_name=user["username"],
        amount=payment_data.amount,
    )
    await db.payments.insert_one(payment.model_dump())
    return payment


@router.put("/{payment_id}/approve", response_model=Payment)
async def approve_payment(payment_id: str, user=Depends(require_role(["boss"]))):
    existing = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")

    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": user["username"],
        }},
    )

    updated = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    return Payment(**updated)


@router.put("/{payment_id}/reject", response_model=Payment)
async def reject_payment(payment_id: str, user=Depends(require_role(["boss"]))):
    existing = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")

    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": "rejected"}},
    )

    updated = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    return Payment(**updated)
