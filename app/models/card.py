from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Boolean, Text, func
from sqlalchemy.dialects.postgresql import JSONB, ARRAY, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from uuid import uuid4, UUID

from .base import Base


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4, unique=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"), index=True)

    source_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    stage_suggestion: Mapped[str | None] = mapped_column(String(64), nullable=True)
    column_key: Mapped[str] = mapped_column(String(32), default="novo", index=True)
    order: Mapped[int | None] = mapped_column("order", Integer, nullable=True)
    type: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    review_after_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    effort_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    week: Mapped[int | None] = mapped_column(Integer, nullable=True)

    depends_on: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    raw: Mapped[dict] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    plan: Mapped["Plan"] = relationship(back_populates="cards")


class CardReview(Base):
    __tablename__ = "card_reviews"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    card_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), index=True)
    review_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="scheduled")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    card: Mapped[Card] = relationship("Card", backref="reviews")
