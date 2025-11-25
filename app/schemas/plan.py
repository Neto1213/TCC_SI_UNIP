from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from uuid import UUID


class PlanCreate(BaseModel):
    data: Dict[str, Any]
    semanas: int | None = None
    tema: str | None = None


class StudyCard(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    order: Optional[int] = None
    type: Optional[str] = None
    needs_review: bool = False
    review_after_days: Optional[int] = None
    effort_minutes: Optional[int] = None
    stage_suggestion: Optional[str] = None
    column_key: str = "novo"
    week: Optional[int] = None
    depends_on: List[str] = Field(default_factory=list)
    raw: Dict[str, Any] = Field(default_factory=dict)
    notes: Optional[str] = None


class StudyPlanMeta(BaseModel):
    id: int
    plan_title: str
    learning_type: str
    tema: str
    perfil_label: Optional[str] = None
    semanas: int
    version: int = 2


class StudyPlanResponse(BaseModel):
    plan: StudyPlanMeta
    cards: List[StudyCard]


class PlanOut(BaseModel):
    id: int
    plan_title: str | None = None
    learning_type: str = "default"
    tema: str | None = None
    perfil_label: str | None = None
    semanas: int | None = None
    version: int = 1
    created_at: datetime | None = None
    data: Dict[str, Any] | None = None  # legacy

    model_config = {"from_attributes": True}


class PlanDetail(PlanOut):
    raw_response: Dict[str, Any] | None = None
    cards: List[StudyCard] = Field(default_factory=list)
