from typing import Any, Dict

from gpt_api import get_plan_from_gpt


class ChatGPTClient:
    """Wrapper simples para encapsular a chamada ao ChatGPT."""

    def generate_content(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Usa o mesmo fluxo anterior (get_plan_from_gpt), mas isolado como provider de conteúdo.
        """
        return get_plan_from_gpt(
            skeleton=payload.get("skeleton"),
            semanas=payload.get("semanas") or 0,
            weekly_hours=payload.get("weekly_hours"),
            model=payload.get("model") or "gpt-4o-mini",
            max_tokens=payload.get("max_tokens") or 1200,
        )
