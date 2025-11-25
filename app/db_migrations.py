from __future__ import annotations

import logging
from pathlib import Path
from contextlib import closing

from sqlalchemy.engine import Engine

_logger = logging.getLogger(__name__)
_PROJECT_ROOT = Path(__file__).resolve().parents[1]


def run_sql_migrations(engine: Engine, migrations_dir: str | Path = "migrations") -> None:
    """
    Executes every .sql file inside the migrations directory (idempotent scripts).
    Files are executed in alphabetical order on every startup so ALTER statements
    with IF NOT EXISTS keep the schema up to date even without Alembic.
    """
    folder = Path(migrations_dir)
    if not folder.is_absolute():
        folder = _PROJECT_ROOT / folder

    if not folder.exists():
        _logger.info("Skipping migrations: directory %s not found", folder)
        return

    sql_files = sorted(file for file in folder.glob("*.sql"))
    if not sql_files:
        _logger.info("Skipping migrations: no .sql files in %s", folder)
        return

    with closing(engine.raw_connection()) as raw_conn:
        with closing(raw_conn.cursor()) as cursor:
            for sql_file in sql_files:
                sql_text = sql_file.read_text(encoding="utf-8").strip()
                if not sql_text:
                    continue
                _logger.info("Applying migration %s", sql_file.name)
                cursor.execute(sql_text)
        raw_conn.commit()
