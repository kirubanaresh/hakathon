# backend/auth/router.py

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import Optional, List # Keep List if needed for UserResponse, but it won't be in this file directly
from datetime import timedelta
from motor.motor_asyncio import AsyncIOMotorClient

# IMPORT FROM CORRECT LOCATIONS
from ..database import get_database
from ..schemas import Token, UserResponse, UserInDB # Assuming UserResponse is the model for /auth/me/
from ..dependencies import get_current_user # Import from our centralized dependencies file
from ..auth.utils import create_access_token, verify_password # Import from our new utils file


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

# --- Authentication Endpoints ---

@router.post("/token", response_model=Token, summary="Login For Access Token")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """
    Authenticate a user and return an access token.
    The access token will include the user's roles.
    """
    users_collection = db["users"]
    user_data = await users_collection.find_one({"username": form_data.username})

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password using the utility function
    if not verify_password(form_data.password, user_data["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user roles from the database entry
    user_roles: List[str] = user_data.get("roles", ["operator"]) # Default to 'operator' if roles not found

    access_token_expires = timedelta(minutes=create_access_token.__globals__['ACCESS_TOKEN_EXPIRE_MINUTES'])
    
    # Create the token, including the user's roles in the payload
    access_token = create_access_token(
        data={"sub": user_data["username"], "roles": user_roles}, # Include roles here!
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me/", response_model=UserResponse, summary="Read Current Authenticated User")
async def read_current_authenticated_user(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Retrieve the current authenticated user's information.
    Requires a valid JWT in the Authorization header.
    This endpoint uses the centralized get_current_user dependency.
    """
    return current_user

# IMPORTANT: All /users/ related endpoints (like register_user, get_all_users,
# get_user_by_id, update_user, delete_user) should NO LONGER be in this file.
# They should be exclusively in backend/routers/users.py.
# If you have them here, please remove them.