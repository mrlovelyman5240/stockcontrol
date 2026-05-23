"""User management routes: list drivers, list all, delete, reset/update."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import ResetPasswordRequest, UserResponse
from security import hash_password, require_role

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/drivers", response_model=List[UserResponse])
async def get_drivers(user=Depends(require_role(["boss", "customer_service"]))):
    drivers = await db.users.find({"role": "driver"}, {"_id": 0, "password": 0}).to_list(100)
    return [UserResponse(**d) for d in drivers]


@router.get("/all")
async def get_all_users(user=Depends(require_role(["boss"]))):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return users


@router.delete("/{user_id}")
async def delete_user(user_id: str, user=Depends(require_role(["boss"]))):
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.delete_one({"id": user_id})
    return {"message": f"User '{target['username']}' deleted"}


@router.put("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    data: ResetPasswordRequest,
    user=Depends(require_role(["boss"])),
):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    await db.users.update_one({"id": user_id}, {"$set": {"password": hash_password(data.new_password)}})
    return {"message": f"Password reset for '{target['username']}'"}


@router.put("/{user_id}/update")
async def update_user(user_id: str, data: dict, user=Depends(require_role(["boss"]))):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    update = {}
    if "full_name" in data and data["full_name"]:
        update["full_name"] = data["full_name"]
    if "username" in data and data["username"]:
        if data["username"] != target["username"]:
            existing = await db.users.find_one({"username": data["username"]}, {"_id": 0})
            if existing:
                raise HTTPException(status_code=400, detail="Username already taken")
            update["username"] = data["username"]
    if "password" in data and data["password"]:
        if len(data["password"]) < 4:
            raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
        update["password"] = hash_password(data["password"])
    if update:
        await db.users.update_one({"id": user_id}, {"$set": update})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated
