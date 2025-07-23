# backend/dependencies.py

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import List, Optional, Dict, Any # Added Optional, Dict, Any for type hints
from motor.motor_asyncio import AsyncIOMotorClient

# IMPORTANT: Adjust these import paths based on your file structure
from .schemas import TokenData, UserResponse, UserInDB
from .services.user_service import get_user_by_username
from .database import get_database
from .auth.utils import decode_access_token # Import the new decode_access_token utility
from jose import jwt, JWTError # Keep jwt and JWTError imported for clarity

# Define the OAuth2PasswordBearer scheme ONLY ONCE here
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncIOMotorClient = Depends(get_database) # Add db dependency here for fetching user
) -> UserResponse:
    """
    Dependency to get the current authenticated user from a JWT token.
    Returns a UserResponse object if successful, raises HTTPException otherwise.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Debugging: Print the token received
    print(f"Token received in get_current_user: {token[:30]}... (truncated)") if token else print("No token received.")

    payload: Optional[Dict[str, Any]] = None # Initialize payload as Optional
    try:
        # Use the centralized decode_access_token from utils.py
        # This function should ideally raise JWTError on invalid tokens, not return None
        payload = decode_access_token(token)
        
        # Debugging: Print the payload after decoding
        print(f"Decoded payload from decode_access_token: {payload}")

        # IMPORTANT: Check if payload is None or not a dictionary after decoding
        if not isinstance(payload, dict):
            print(f"Payload is not a dictionary. Type: {type(payload)}. Value: {payload}")
            raise credentials_exception # If decode_access_token returns None or non-dict, this will catch it
        
        username: str = payload.get("sub")
        # Ensure 'roles' key exists in payload; default to empty list if not
        user_roles: List[str] = payload.get("roles", []) 
        
        if username is None or not user_roles: # Ensure roles are present in the token
            print(f"Username ('sub') or roles missing in payload. Username: {username}, Roles: {user_roles}")
            raise credentials_exception
        
        # 'scopes' aligns with OAuth2 spec for roles
        token_data = TokenData(username=username, scopes=user_roles) 

    except JWTError as e: # This block is active if decode_access_token raises JWTError
        print(f"JWTError caught in get_current_user: {e}")
        raise credentials_exception
    except ValueError as e: # Catch the ValueError from missing env vars or missing roles in token from utils
        print(f"ValueError caught in get_current_user (from utils.py): {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e: # Catch any other unexpected errors during processing
        print(f"An unexpected error occurred in get_current_user (after decode_access_token): {e}")
        raise credentials_exception
    
    # Retrieve user from the database to ensure they still exist and are active
    user_in_db = await get_user_by_username(db, token_data.username) # This returns UserInDB
    if user_in_db is None:
        print(f"User '{token_data.username}' not found in database.")
        raise credentials_exception
    
    # Check if the roles from the token match the roles from the database (optional, but good for security)
    if sorted(user_in_db.roles) != sorted(user_roles):
        print(f"Warning: Roles in token ({user_roles}) do not match roles in DB ({user_in_db.roles}) for user {username}.")
        # You might choose to raise an exception here instead of just logging a warning
        pass

    # Convert UserInDB object to UserResponse object, excluding sensitive hashed_password
    # Use model_dump() for Pydantic v2
    return UserResponse(**user_in_db.model_dump(exclude={"hashed_password", "is_active"})) # Exclude is_active if not in UserResponse

def role_required(required_roles: List[str]):
    """
    Dependency factory to check if the current user has any of the required roles.
    Usage: Depends(role_required(["admin", "supervisor"]))
    """
    def role_checker(current_user: UserResponse = Depends(get_current_user)):
        # Ensure user has roles (should always be true if user is authenticated via get_current_user)
        if not current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions: User has no roles assigned."
            )
        
        # Check if the user has any of the required roles
        for role in required_roles:
            if role in current_user.roles:
                return current_user # User has at least one of the required roles
        
        # If no required roles are found
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Not enough permissions: Required roles are {required_roles}."
        )
    return role_checker