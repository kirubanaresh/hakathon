# backend/routers/users.py

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Path
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from typing import List, Optional

from ..database import get_database
from ..schemas import UserCreate, UserResponse, UserUpdate
from ..auth.utils import get_password_hash
from ..dependencies import get_current_user, role_required
from ..utils.email_utils import send_email_notification

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


# Get current user's profile
@router.get("/me/", response_model=UserResponse) # Added trailing slash to match common conventions
async def read_users_me(current_user: UserResponse = Depends(get_current_user)):
    """Retrieve current authenticated user's details."""
    return current_user

@router.get("/", response_model=List[UserResponse], summary="Get All Users")
async def get_all_users(
    username: Optional[str] = Query(None, description="Filter by username (case-insensitive partial match)"),
    role: Optional[str] = Query(None, description="Filter by a specific role"),
    sort_by: Optional[str] = Query("username", description="Field to sort by (e.g., 'username', 'email', 'id')"),
    sort_order: Optional[str] = Query("asc", description="Sort order: 'asc' for ascending, 'desc' for descending"),
    current_user: UserResponse = Depends(role_required(["admin", "supervisor"])), # Admins and Supervisors can view
    db = Depends(get_database)
):
    """
    Retrieve a list of all registered users with optional filtering and sorting.
    Requires 'admin' or 'supervisor' role.
    """
    users_collection = db["users"]
    query_filter = {}

    if username:
        # Case-insensitive partial match for username
        query_filter["username"] = {"$regex": username, "$options": "i"}
    if role:
        # Exact match for role in the roles array
        query_filter["roles"] = role

    # Define valid sort fields
    # 'id' maps to '_id' in MongoDB for sorting
    valid_sort_fields = ["username", "email", "id", "is_active"]
    if sort_by not in valid_sort_fields:
        sort_by = "username" # Default to username if invalid sort_by is provided

    # Determine sort direction
    sort_direction = 1 if sort_order.lower() == "asc" else -1

    # For MongoDB, sort by '_id' if 'id' is requested
    mongo_sort_by = "_id" if sort_by == "id" else sort_by

    # Fetch users from MongoDB with filters and sorting
    # Exclude hashed_password from the projection
    users_cursor = users_collection.find(query_filter, {"hashed_password": 0}).sort(mongo_sort_by, sort_direction)
    all_users_data = await users_cursor.to_list(None)

    users_for_response = []
    for user_doc in all_users_data:
        user_data = {
            "id": str(user_doc["_id"]), # Ensure _id is converted to string for 'id'
            "username": user_doc["username"],
            "email": user_doc.get("email"),
            "full_name": user_doc.get("full_name", None), # Use "full_name" or "full_ado_full_name" based on your schema
            "disabled": user_doc.get("disabled", False),
            "is_active": user_doc.get("is_active", True),
            "roles": user_doc.get("roles", []),
        }
        users_for_response.append(UserResponse(**user_data))

    return users_for_response

@router.get("/{user_id}", response_model=UserResponse) # Changed from "/users/{user_id}" to "/{user_id}"
async def get_user_by_id(
    user_id: str,
    current_user: UserResponse = Depends(role_required(["admin", "supervisor"])),
    db = Depends(get_database)
):
    """
    Retrieve details of a specific user by their ID.
    Requires 'admin' or 'supervisor' role.
    """
    users_collection = db["users"]

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format")

    user_doc = await users_collection.find_one({"_id": ObjectId(user_id)}, {"hashed_password": 0})

    if user_doc:
        user_data_for_response = {
            "id": str(user_doc["_id"]),
            "username": user_doc["username"],
            "email": user_doc.get("email"),
            "full_name": user_doc.get("full_name"),
            "disabled": user_doc.get("disabled", False),
            "is_active": user_doc.get("is_active", True),
            "roles": user_doc.get("roles", []),
        }
        return UserResponse(**user_data_for_response)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

@router.put("/{user_id}", response_model=UserResponse) # Changed from "/users/{user_id}" to "/{user_id}"
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: UserResponse = Depends(role_required(["admin", "supervisor"])),
    db = Depends(get_database)
):
    # ... (rest of update_user function, no changes needed inside)
    users_collection = db["users"]

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format")

    update_data = user_update.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided for update")

    if "username" in update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username cannot be updated via this endpoint")
    if "password" in update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password cannot be updated via this endpoint")

    result = await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    updated_user_doc = await users_collection.find_one({"_id": ObjectId(user_id)}, {"hashed_password": 0})

    if updated_user_doc:
        user_data_for_response = {
            "id": str(updated_user_doc["_id"]),
            "username": updated_user_doc["username"],
            "email": updated_user_doc.get("email"),
            "full_name": updated_user_doc.get("full_name"),
            "disabled": updated_user_doc.get("disabled", False),
            "is_active": updated_user_doc.get("is_active", True),
            "roles": updated_user_doc.get("roles", []),
        }
        return UserResponse(**user_data_for_response)

    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve updated user")

# --- NEW API ENDPOINT: Delete User ---
@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: UserResponse = Depends(role_required(["admin"])), # Only admins can delete users
    db = Depends(get_database)
):
    users_collection = db["users"]

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format")

    # Prevent a user from deleting themselves (optional, but good practice)
    if str(current_user.id) == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own user account via this endpoint.")

    # Prevent deleting the last admin (optional, for system integrity)
    # --- THIS IS THE LINE TO CHANGE ---
    if "admin" in current_user.roles: # Correctly check if "admin" role is in the roles list
        target_user_doc = await users_collection.find_one({"_id": ObjectId(user_id)})
        if target_user_doc and "admin" in target_user_doc.get("roles", []):
            admin_count = await users_collection.count_documents({"roles": "admin"})
            if admin_count <= 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete the last admin user.")

    result = await users_collection.delete_one({"_id": ObjectId(user_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return {} # 204 No Content response