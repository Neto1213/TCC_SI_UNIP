from typing import List, Optional, Sequence, Tuple

from sqlalchemy.orm import Session, selectinload

from app.models.plan import Plan
from app.models.card import Card


def create_plan(
    db: Session,
    *,
    user_id: int,
    tema: str | None,
    semanas: int | None,
    data: dict,
    plan_title: str | None = None,
    learning_type: str = "default",
    perfil_label: str | None = None,
    version: int = 1,
) -> Plan:
    plan = Plan(
        user_id=user_id,
        tema=tema,
        semanas=semanas,
        data=data,
        plan_title=plan_title,
        learning_type=learning_type,
        perfil_label=perfil_label,
        version=version,
        raw_response=data,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def create_plan_with_cards(
    db: Session,
    *,
    user_id: int,
    plan_title: str,
    learning_type: str,
    tema: str,
    perfil_label: str | None,
    semanas: int,
    version: int,
    raw_response: dict,
    cards_payload: Sequence[dict],
) -> Tuple[Plan, List[Card]]:
    plan = Plan(
        user_id=user_id,
        plan_title=plan_title,
        learning_type=learning_type,
        tema=tema,
        perfil_label=perfil_label,
        semanas=semanas,
        version=version,
        raw_response=raw_response,
        data=raw_response,  # legacy compatibility
    )
    db.add(plan)
    db.flush()

    card_models: List[Card] = []
    for card in cards_payload:
        card_model = Card(
            plan_id=plan.id,
            source_id=card.get("id"),
            title=card.get("title") or "Tarefa",
            description=card.get("description"),
            instructions=card.get("instructions"),
            stage_suggestion=card.get("stage_suggestion"),
            column_key=card.get("column_key") or "novo",
            order=card.get("order"),
            type=card.get("type"),
            needs_review=bool(card.get("needs_review")),
            review_after_days=card.get("review_after_days"),
            effort_minutes=card.get("effort_minutes"),
            week=card.get("week"),
            depends_on=card.get("depends_on") or [],
            notes=card.get("notes"),
            raw=card.get("raw") or {},
        )
        db.add(card_model)
        card_models.append(card_model)

    db.commit()
    db.refresh(plan)
    for model in card_models:
        db.refresh(model)
    return plan, card_models


def list_user_plans(db: Session, *, user_id: int) -> List[Plan]:
    return (
        db.query(Plan)
        .filter(Plan.user_id == user_id)
        .order_by(Plan.id.desc())
        .all()
    )


def get_user_plan(db: Session, *, user_id: int, plan_id: int, include_cards: bool = False) -> Optional[Plan]:
    query = db.query(Plan).filter(Plan.user_id == user_id, Plan.id == plan_id)
    if include_cards:
        query = query.options(selectinload(Plan.cards))
    return query.first()


def get_plan_card_by_identifier(db: Session, *, plan_id: int, card_identifier: str) -> Optional[Card]:
    """
    Localiza o card pelo source_id (id lógico vindo da IA) ou pelo UUID real.
    """
    card = (
        db.query(Card)
        .filter(Card.plan_id == plan_id, Card.source_id == card_identifier)
        .first()
    )
    if card:
        return card
    return (
        db.query(Card)
        .filter(Card.plan_id == plan_id, Card.id == card_identifier)
        .first()
    )


def list_cards(db: Session, *, plan_id: int) -> List[Card]:
    return (
        db.query(Card)
        .filter(Card.plan_id == plan_id)
        .order_by(Card.order.asc().nullsfirst(), Card.created_at.asc())
        .all()
    )
