import os
import importlib
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

try:
    # Carrega variáveis do .env automaticamente para melhor DX
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()
except Exception:
    pass


def _detect_driver() -> str:
    # Se psycopg v3 estiver instalado, use-o; senão caia para psycopg2
    try:
        importlib.import_module("psycopg")
        return "psycopg"
    except ImportError:
        return "psycopg2"


def _build_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url

    driver = _detect_driver()
    user = os.getenv("POSTGRES_USER", "projeto_ia")
    password = os.getenv("POSTGRES_PASSWORD", "devpassword")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "projeto_ia")
    return f"postgresql+{driver}://{user}:{password}@{host}:{port}/{db}"


DATABASE_URL: str = _build_database_url()

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
