# backend/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pymongo.errors import DuplicateKeyError
import os
from bson import ObjectId
from typing import List, Optional, Dict, Any # Keep Any if you use it elsewhere

from ..database import get_database
from ..schemas import UserCreate, UserResponse, PyObjectId, UserUpdate
from ..auth.utils import get_password_hash, verify_password # Moved from auth/utils
from ..dependencies import get_current_user, role_required # Assuming these are defined in dependencies.py or similar

router = APIRouter()

# Helper function to fetch user from DB for dependencies
async def get_user_from_db(username: str):
    db = get_database()
    user = await db["users"].find_one({"username": username})
    if user:
        user_data_for_response = user.copy()
        user_data_for_response['id'] = str(user_data_for_response['_id'])
        del user_data_for_response['_id']
        return UserResponse(**user_data_for_response)
    return None

# User creation (registration) - Corrected path to "/"
@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_in: UserCreate):
    db = get_database()
    users_collection = db["users"]

    existing_user = await users_collection.find_one({"username": user_in.username})
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")

    hashed_password = get_password_hash(user_in.password)
    user_dict = user_in.model_dump()
    user_dict["hashed_password"] = hashed_password
    if not user_dict.get("roles"):
        user_dict["roles"] = ["operator"] # Default role for new registrations
    del user_dict["password"]

    try:
        result = await users_collection.insert_one(user_dict)
        created_user = await users_collection.find_one({"_id": result.inserted_id})

        if created_user:
            user_data_for_response = {
                "id": str(created_user["_id"]),
                "username": created_user["username"],
                "email": created_user.get("email"),
                "full_name": created_user.get("full_name"),
                "disabled": created_user.get("disabled", False),
                "is_active": created_user.get("is_active", True),
                "roles": created_user.get("roles", []),
            }
            return UserResponse(**user_data_for_response)

        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve created user")
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered (DB constraint violation)")
    except Exception as e:
        if isinstance(e, ValueError) and "Invalid ObjectId" in str(e):
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Data validation error after creation: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to register user: {e}")


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