import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from passlib.context import CryptContext


# Use PBKDF2-SHA256 to avoid OS/binary issues and the 72-byte limit of bcrypt
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def get_jwt_secret() -> str:
    return os.getenv("JWT_SECRET", "change_me_super_secret")


def get_jwt_alg() -> str:
    return os.getenv("JWT_ALG", "HS256")


def get_jwt_exp_minutes() -> int:
    try:
        return int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    except Exception:
        return 60


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(*, user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=get_jwt_exp_minutes())
    payload = {"sub": str(user_id), "exp": expire}
    token = jwt.encode(payload, get_jwt_secret(), algorithm=get_jwt_alg())
    return token


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, get_jwt_secret(), algorithms=[get_jwt_alg()])
