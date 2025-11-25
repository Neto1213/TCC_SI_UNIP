from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
import logging

import re

STAGE_SUGGESTION = {
    "fundamento": "Explorar",
    "pratica": "Praticar",
    "revisao": "Revisar",
    "aplicacao": "Aplicar",
    "entrega": "Entregar",
}

TYPE_MAP = {
    "teoria": "fundamento",
    "teórico": "fundamento",
    "fundamento": "fundamento",
    "pratica": "pratica",
    "prática": "pratica",
    "prático": "pratica",
    "exercicio": "pratica",
    "exercício": "pratica",
    "revisao": "revisao",
    "revisão": "revisao",
    "simulado": "revisao",
    "avaliacao": "revisao",
    "avaliação": "revisao",
    "projeto": "aplicacao",
    "aplicacao": "aplicacao",
    "aplicação": "aplicacao",
    "entrega": "entrega",
    "apresentacao": "entrega",
    "apresentação": "entrega",
}

LEARNING_TYPE_MAP = {
    "prova": "prova",
    "habito": "habito",
    "aprendizado_profundo": "profundo",
    "projeto": "apresentacao",
}


@dataclass
class TransformedCard:
    id: str
    title: str
    description: Optional[str]
    instructions: Optional[str]
    order: int
    type: Optional[str]
    needs_review: bool
    review_after_days: Optional[int]
    effort_minutes: Optional[int]
    stage_suggestion: Optional[str]
    column_key: str
    week: Optional[int]
    depends_on: List[str]
    raw: Dict[str, Any]
    notes: Optional[str] = None


@dataclass
class TransformedPlan:
    tema: str
    perfil_label: Optional[str]
    learning_type: str
    semanas: int
    plan_title: str
    cards: List[TransformedCard]
    raw: Dict[str, Any]


_HOURS_REGEX = re.compile(r"(?P<hours>\d+(?:[.,]\d+)?)\s*h", re.IGNORECASE)
_MINUTES_REGEX = re.compile(r"(?P<minutes>\d+(?:[.,]\d+)?)\s*m", re.IGNORECASE)
_HM_REGEX = re.compile(r"(?P<hours>\d+)[h:]?(?P<minutes>\d{1,2})$")


def _to_minutes(hours_string: Optional[str]) -> Optional[int]:
    if not hours_string:
        return None
    text = hours_string.strip().lower().replace(" ", "")
    if not text:
        return None
    match_hm = _HM_REGEX.match(text.replace(" ", ""))
    if match_hm:
        try:
            h = int(match_hm.group("hours"))
            m = int(match_hm.group("minutes"))
            return max(1, h * 60 + m)
        except ValueError:
            pass
    match_hours = _HOURS_REGEX.search(hours_string.lower())
    match_minutes = _MINUTES_REGEX.search(hours_string.lower())
    total = 0.0
    if match_hours:
        total += float(match_hours.group("hours").replace(",", "."))
    if match_minutes:
        total += float(match_minutes.group("minutes").replace(",", ".")) / 60.0
    if "h" not in text and "m" in text and match_minutes:
        total = float(match_minutes.group("minutes").replace(",", ".")) / 60.0
    if total == 0.0:
        try:
            total = float(text.replace("h", "").replace("m", ""))
        except ValueError:
            return None
    return int(total * 60)


def _parse_description(desc: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not desc:
        return None, None
    parts = desc.split("\n\n", 1)
    description = parts[0]
    instructions = parts[1] if len(parts) > 1 else None
    # remove prefixes
    def clean(block: Optional[str]) -> Optional[str]:
        if not block:
            return None
        block = block.strip()
        if block.lower().startswith("descricao:"):
            block = block[len("descricao:") :].strip()
        if block.lower().startswith("descrição:"):
            block = block[len("descrição:") :].strip()
        if block.lower().startswith("como fazer:"):
            block = block[len("como fazer:") :].strip()
        return block or None

    return clean(description), clean(instructions)


def _map_learning_type(objetivo: Optional[str]) -> str:
    if not objetivo:
        return "default"
    return LEARNING_TYPE_MAP.get(objetivo.lower(), "default")


def _map_card_type(raw_type: Optional[str]) -> str:
    if not raw_type:
        return "fundamento"
    norm = raw_type.strip().lower()
    return TYPE_MAP.get(norm, "fundamento")


def _infer_review(plan_type: str, card_type: str) -> Tuple[bool, Optional[int]]:
    if plan_type not in {"habito", "prova"}:
        return False, None
    if card_type not in {"fundamento", "revisao"}:
        return False, None
    default_days = 2 if card_type == "fundamento" else 1
    return True, default_days


def transform_ai_plan(payload: Dict[str, Any]) -> TransformedPlan:
    """
    Converte o JSON cru vindo da IA em um plano rico pronto para persistência/retorno.
    """
    tema = payload.get("tema", "Plano de Estudos")
    objetivo = payload.get("objetivo")
    learning_type = _map_learning_type(objetivo)
    semanas = int(payload.get("semanas") or len(payload.get("plano", [])) or 4)
    perfil_label = payload.get("perfil_label")
    plan_title = f"Plano de {tema}".strip().title()
    if objetivo:
        plan_title = f"{plan_title} ({objetivo})"

    cards: List[TransformedCard] = []
    order_counter = 1

    for semana in payload.get("plano", []):
        week_number = semana.get("semana")
        tarefas = semana.get("tarefas") or []
        for tarefa in tarefas:
            if not isinstance(tarefa, dict):
                continue
            original_id = str(tarefa.get("id") or f"card-{len(cards)+1}")
            description, instructions = _parse_description(tarefa.get("description"))
            card_type = _map_card_type(tarefa.get("type"))
            needs_review, review_after_days = _infer_review(learning_type, card_type)
            effort = _to_minutes(tarefa.get("hours"))
            stage = STAGE_SUGGESTION.get(card_type, "Explorar")
            cards.append(
                TransformedCard(
                    id=original_id,
                    title=tarefa.get("title") or "Tarefa",
                    description=description,
                    instructions=instructions,
                    order=order_counter,
                    type=card_type,
                    needs_review=needs_review,
                    review_after_days=review_after_days,
                    effort_minutes=effort,
                    stage_suggestion=stage,
                    column_key=tarefa.get("status") or "novo",
                    week=week_number,
                    depends_on=[],
                    raw=tarefa,
                    notes=tarefa.get("notes"),
                )
            )
            order_counter += 1

    transformed_plan = TransformedPlan(
        tema=tema,
        perfil_label=perfil_label,
        learning_type=learning_type or "default",
        semanas=semanas,
        plan_title=plan_title,
        cards=cards,
        raw=payload,
    )

    # Validação auxiliar: soma de horas por semana vs carga_horas_semana
    carga_horas_semana = payload.get("carga_horas_semana")
    if carga_horas_semana:
        try:
          carga_semana_min = float(carga_horas_semana) * 60
          por_semana: Dict[int, int] = {}
          for c in cards:
              if c.week is None or c.effort_minutes is None:
                  continue
              por_semana[c.week] = por_semana.get(c.week, 0) + c.effort_minutes
          for semana_idx, total_min in por_semana.items():
              if abs(total_min - carga_semana_min) > 1:  # tolerância de 1 min
                  logging.warning(
                      "Carga horária inconsistente: semana=%s esperado=%.2fmin atual=%smin",
                      semana_idx,
                      carga_semana_min,
                      total_min,
                  )
        except Exception:
          logging.exception("Falha ao validar carga horária semanal do plano")

    return transformed_plan
