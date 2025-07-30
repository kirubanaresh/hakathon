# backend/auth/router.py

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import List
from datetime import timedelta
from motor.motor_asyncio import AsyncIOMotorClient

from ..database import get_database
from ..schemas import Token, UserResponse
from ..dependencies import get_current_user
from ..auth.utils import create_access_token, verify_password

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post("/token", response_model=Token, summary="Login For Access Token")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncIOMotorClient = Depends(get_database)
):
    users_collection = db["users"]
    user_data = await users_collection.find_one({"username": form_data.username})

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(form_data.password, user_data["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_roles: List[str] = user_data.get("roles", ["operator"])

    access_token_expires = timedelta(minutes=create_access_token.__globals__['ACCESS_TOKEN_EXPIRE_MINUTES'])

    access_token = create_access_token(
        data={"sub": user_data["username"], "id": str(user_data["_id"]), "roles": user_roles},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me/", response_model=UserResponse, summary="Read Current Authenticated User")
async def read_current_authenticated_user(
    current_user: UserResponse = Depends(get_current_user)
):
    return current_user
