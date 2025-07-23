# backend/auth/utils.py

import os
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from passlib.context import CryptContext
from jose import JWTError, jwt
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env

# --- Configuration for JWT ---
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30)) # Default to 30 if not set

if not SECRET_KEY or not ALGORITHM:
    raise ValueError("JWT_SECRET_KEY and JWT_ALGORITHM must be set in the .env file.")

# --- Password Hashing Context ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hashes a plain password."""
    return pwd_context.hash(password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Creates a JWT access token.
    'data' dictionary should include 'sub' (username) and 'roles' (list of strings).
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Ensure 'roles' is included in the payload
    if "roles" not in to_encode:
        # This check is here to be explicit, but the login endpoint should always add roles now.
        pass # Allow creating token without roles if explicitly intended, but warn or require roles for auth.
        # For our use case, `login_for_access_token` *will* provide roles.
        # If this is hit, it means create_access_token was called without 'roles' in data.
        # You might want to uncomment the line below for strictness in future development:
        # raise ValueError("Roles must be included in the token data for proper authorization.")

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes a JWT access token.
    Raises JWTError if decoding fails.
    """
    # Ensure SECRET_KEY and ALGORITHM are not None, though the module-level check should catch this.
    #if not SECRET_KEY or not ALGORITHM:
    #    raise ValueError("JWT_SECRET_KEY or JWT_ALGORITHM environment variable not set in utils.")
    #return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return payload # Or return a User object/dict with details
    except JWTError: # <--- This is where it was undefined
        return None # Token validation failed