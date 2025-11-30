from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.security import verify_password, hash_password


def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.get(User, user_id)


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, *, email: str, password: str, name: str | None = None) -> User:
    user = User(email=email, username=name, hashed_password=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def update_user_password(db: Session, user: User, new_password: str) -> User:
    """Atualiza a senha aplicando o mesmo hashing usado no cadastro/login."""
    user.hashed_password = hash_password(new_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
