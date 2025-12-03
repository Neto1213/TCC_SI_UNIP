from typing import Any, Dict

from .base import ContentProvider
from app.infrastructure.openai.chatgpt_client import ChatGPTClient


class ChatGPTContentProvider(ContentProvider):
    def __init__(self):
        self.client = ChatGPTClient()

    def generate_content(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Usa a API da OpenAI para gerar conteúdo com base no payload recebido.
        """
        return self.client.generate_content(payload)
