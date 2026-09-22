"""
Simple local username/password auth.
Uses standard SHA-256 + salt hashing to be 100% compatible across Python 3.10-3.13+
without passlib/bcrypt version incompatibilities.
User accounts are stored locally in data/users.json.
Default hardcoded admin credentials: admin123 / 123456.
"""
import hashlib
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from . import storage
from .config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Built-in default credentials for convenience
DEFAULT_ACCOUNTS = {
    "admin123": "123456",
    "admin": "123456",
}


def hash_password(password: str) -> str:
    """Hash password using sha256 with a unique random salt."""
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return f"{salt}${hashed}"


def verify_password(plain: str, stored_hash: str) -> bool:
    """Verify password against stored salt$hash or legacy formats."""
    if not stored_hash:
        return False
    
    # Check salt$hash format
    if "$" in stored_hash:
        salt, expected_hash = stored_hash.split("$", 1)
        calc_hash = hashlib.sha256(f"{salt}:{plain}".encode("utf-8")).hexdigest()
        return secrets.compare_digest(calc_hash, expected_hash)
    
    # Fallback for plain text matching
    return secrets.compare_digest(plain, stored_hash)


def create_access_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def authenticate_user(username: str, password: str) -> bool:
    # 1. Check built-in hardcoded accounts (e.g. admin123 / 123456)
    if username in DEFAULT_ACCOUNTS and password == DEFAULT_ACCOUNTS[username]:
        return True

    # 2. Check local database (data/users.json)
    users = storage.get_users()
    user = users.get(username)
    if not user:
        return False
    return verify_password(password, user.get("hashed_password", ""))


def get_current_username(token: str = Depends(oauth2_scheme)) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate session - please log in again",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except JWTError:
        raise credentials_exception
