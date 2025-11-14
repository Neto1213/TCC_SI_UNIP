from datetime import datetime

from sqlalchemy import ForeignKey, String, Integer, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    plan_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    learning_type: Mapped[str] = mapped_column(String(32), default="default")
    tema: Mapped[str | None] = mapped_column(String(255), nullable=True)
    perfil_label: Mapped[str | None] = mapped_column(String(32), nullable=True)
    semanas: Mapped[int | None] = mapped_column(Integer, nullable=True)

    version: Mapped[int] = mapped_column(Integer, default=1)
    raw_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    data: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True
    )  # deprecated (mantido para compatibilidade)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="plans")
    cards: Mapped[list["Card"]] = relationship(
        "Card",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="Card.order",
    )


from .user import User  # noqa: E402  # type: ignore
from .card import Card  # noqa: E402  # type: ignore
