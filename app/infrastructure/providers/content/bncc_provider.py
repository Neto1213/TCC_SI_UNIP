from typing import Any, Dict

from .base import ContentProvider


class BNCCContentProvider(ContentProvider):
    def generate_content(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        # Futuro: conectar com banco BNCC
        return {
            "message": "BNCC provider ainda não implementado",
            "debug_payload": payload,
        }
