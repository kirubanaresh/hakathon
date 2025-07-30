# backend/dependencies.py

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import List, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from jose import JWTError
from .schemas import TokenData, UserResponse
from .database import get_database
from .auth.utils import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncIOMotorClient = Depends(get_database)
) -> UserResponse:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        if not isinstance(payload, dict):
            raise credentials_exception

        user_id = payload.get("id")
        username = payload.get("sub")
        user_roles = payload.get("roles", [])

        if not username or not user_roles:
            raise credentials_exception

        user_doc = None
        if user_id and ObjectId.is_valid(user_id):
            user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})

        # Optional fallback to username lookup
        if not user_doc and username:
            user_doc = await db["users"].find_one({"username": username})

        if not user_doc:
            raise credentials_exception

        return UserResponse(**user_doc, id=str(user_doc["_id"]))

    except JWTError as e:
        # Optional: log or print error e
        raise credentials_exception
    except Exception:
        raise credentials_exception


def role_required(required_roles: List[str]):
    def role_checker(current_user: UserResponse = Depends(get_current_user)):
        if not current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions: User has no roles assigned."
            )

        if not any(role in current_user.roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Not enough permissions: Required roles are {required_roles}."
            )

        return current_user

    return role_checker
