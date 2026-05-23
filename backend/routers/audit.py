"""Boss-only audit log listing."""
from typing import List

from fastapi import APIRouter, Depends

from database import db
from models import AuditLog
from security import require_role

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("", response_model=List[AuditLog])
async def get_audit_logs(user=Depends(require_role(["boss"]))):
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(1000)
    return [AuditLog(**log) for log in logs]
