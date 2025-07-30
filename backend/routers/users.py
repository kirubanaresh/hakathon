# backend/routers/users.py

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Path
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from typing import List, Optional

from ..database import get_database
from ..schemas import UserCreate, UserResponse, UserUpdate
from ..auth.utils import get_password_hash
from ..dependencies import get_current_user, role_required
#from ..utils.email_utils import send_email_notification

router = APIRouter()


def convert_mongo_to_response(user_doc: dict) -> dict:
    return {
        "id": str(user_doc["_id"]),
        "username": user_doc["username"],
        "email": user_doc.get("email"),
        "full_name": user_doc.get("full_name"),
        "disabled": user_doc.get("disabled", False),
        "is_active": user_doc.get("is_active", True),
        "roles": user_doc.get("roles", []),
        "status": user_doc.get("status", "pending"),
    }


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
):
    db = get_database()
    users_collection = db["users"]

    existing_user = await users_collection.find_one({"username": user_in.username})
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")

    user_dict = user_in.model_dump()
    hashed_password = get_password_hash(user_in.password)
    user_dict["hashed_password"] = hashed_password
    del user_dict["password"]

    if not user_dict.get("roles"):
        user_dict["roles"] = ["operator"]

    if "admin" in user_dict["roles"]:
        first_admin = await users_collection.find_one({"roles": "admin", "status": "approved"})
        if first_admin:
            user_dict["status"] = "pending"
            user_dict["requestedBy"] = first_admin["_id"]
            try:
                result = await users_collection.insert_one(user_dict)
            except DuplicateKeyError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")

            admin_email = first_admin.get("email")
            if admin_email:
                background_tasks.add_task(
                    send_email_notification,
                    to_email=admin_email,
                    subject="New Admin Registration Request",
                    body=f"User '{user_in.username}' requested admin role. Please approve or reject."
                )
            inserted_user = await users_collection.find_one({"_id": result.inserted_id})
            return UserResponse(**convert_mongo_to_response(inserted_user))
        else:
            user_dict["status"] = "approved"
            try:
                result = await users_collection.insert_one(user_dict)
            except DuplicateKeyError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
            inserted_user = await users_collection.find_one({"_id": result.inserted_id})
            return UserResponse(**convert_mongo_to_response(inserted_user))

    elif "supervisor" in user_dict["roles"]:
        first_admin = await users_collection.find_one({"roles": "admin", "status": "approved"})
        if not first_admin:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No approved admin available to approve supervisor")
        user_dict["status"] = "pending"
        user_dict["requestedBy"] = first_admin["_id"]
        try:
            result = await users_collection.insert_one(user_dict)
        except DuplicateKeyError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
        inserted_user = await users_collection.find_one({"_id": result.inserted_id})
        return UserResponse(**convert_mongo_to_response(inserted_user))

    elif "operator" in user_dict["roles"]:
        first_supervisor = await users_collection.find_one({"roles": "supervisor", "status": "approved"})
        if not first_supervisor:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No approved supervisor available to approve operator")
        user_dict["status"] = "pending"
        user_dict["requestedBy"] = first_supervisor["_id"]
        try:
            result = await users_collection.insert_one(user_dict)
        except DuplicateKeyError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
        inserted_user = await users_collection.find_one({"_id": result.inserted_id})
        return UserResponse(**convert_mongo_to_response(inserted_user))

    else:
        user_dict["status"] = "approved"
        try:
            result = await users_collection.insert_one(user_dict)
        except DuplicateKeyError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
        inserted_user = await users_collection.find_one({"_id": result.inserted_id})
        return UserResponse(**convert_mongo_to_response(inserted_user))


@router.post("/approve/{user_id}", status_code=status.HTTP_200_OK)
async def approve_user(
    user_id: str = Path(...),
    current_user: UserResponse = Depends(get_current_user),
    db=Depends(get_database)
):
    users_collection = db["users"]

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format")

    user_to_approve = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user_to_approve:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")

    print(
        f"DEBUG: requestedBy in DB: {user_to_approve.get('requestedBy')}, "
        f"As string: {str(user_to_approve.get('requestedBy'))}, current_user.id: {current_user.id}"
    )

    if "requestedBy" in user_to_approve and str(user_to_approve["requestedBy"]) != str(current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You are not authorized to approve this user")

    user_roles = user_to_approve.get("roles", [])
    status_to_approve = user_to_approve.get("status")

    if status_to_approve != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="User is not pending approval")

    if "admin" in user_roles:
        first_admin = await users_collection.find_one({"roles": "admin", "status": "approved"}, sort=[("_id", 1)])
        if not first_admin or str(first_admin["_id"]) != str(current_user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only the first admin can approve admin requests")

    elif "supervisor" in user_roles:
        if "admin" not in current_user.roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only admins can approve supervisors")

    elif "operator" in user_roles:
        if "supervisor" not in current_user.roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only supervisors can approve operators")

    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="User role not eligible for approval")

    await users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": "approved"}})

    return {"message": f"User '{user_to_approve['username']}' approved successfully"}
