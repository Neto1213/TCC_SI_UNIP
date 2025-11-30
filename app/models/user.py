from datetime import datetime
from typing import List, Optional

from sqlalchemy import func, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    plans: Mapped[List["Plan"]] = relationship(back_populates="user", cascade="all, delete-orphan")


# PEP 563 forward refs support is default in SQLAlchemy relationship; import Plan at bottom for typing
from .plan import Plan  # noqa: E402  # type: ignore
