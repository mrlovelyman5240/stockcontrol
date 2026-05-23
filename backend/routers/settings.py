"""Global app settings (payment method, rates)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from database import db
from models import Settings, SettingsUpdate
from security import get_current_user, require_role

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=Settings)
async def get_settings(user=Depends(get_current_user)):
    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    if not settings:
        default = Settings()
        await db.settings.insert_one(default.model_dump())
        return default
    return Settings(**settings)


@router.put("", response_model=Settings)
async def update_settings(
    update: SettingsUpdate,
    user=Depends(require_role(["boss"])),
):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = user["username"]

    await db.settings.update_one(
        {"id": "global_settings"},
        {"$set": update_data},
        upsert=True,
    )

    settings = await db.settings.find_one({"id": "global_settings"}, {"_id": 0})
    return Settings(**settings)
