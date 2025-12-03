from app.core.config import CONTENT_SOURCE
from .base import ContentProvider
from .chatgpt_provider import ChatGPTContentProvider
from .bncc_provider import BNCCContentProvider


def get_content_provider() -> ContentProvider:
    if CONTENT_SOURCE == "bncc":
        return BNCCContentProvider()
    # default: chatgpt
    return ChatGPTContentProvider()
