from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy.engine import Engine

from .config import settings
from .database import engine


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _alembic_config(database_url: str | None = None) -> Config:
    config = Config(str(_project_root() / "alembic.ini"))
    config.set_main_option("script_location", str(_project_root() / "backend" / "migrations"))
    effective_url = database_url or settings.database_url
    if effective_url:
        config.set_main_option("sqlalchemy.url", effective_url)
    return config


def _head_revision(database_url: str | None = None) -> str | None:
    return ScriptDirectory.from_config(_alembic_config(database_url)).get_current_head()


def _current_revision(engine_override: Engine | None = None) -> str | None:
    active_engine = engine_override or engine
    with active_engine.connect() as connection:
        context = MigrationContext.configure(connection)
        return context.get_current_revision()


def run_migrations_to_head(database_url: str | None = None) -> None:
    command.upgrade(_alembic_config(database_url), "head")


def assert_database_at_head(*, engine_override: Engine | None = None, database_url: str | None = None) -> None:
    current = _current_revision(engine_override)
    head = _head_revision(database_url)
    if current != head:
        raise RuntimeError(
            "数据库迁移版本未达到 Alembic head。"
            f" current={current or 'none'}, head={head or 'none'}。"
            " 请先运行 `alembic upgrade head`。"
        )


def initialize_database_for_runtime(
    *,
    engine_override: Engine | None = None,
    database_url: str | None = None,
) -> None:
    if settings.is_production:
        if settings.require_migrated_db:
            assert_database_at_head(engine_override=engine_override, database_url=database_url)
        return

    if settings.auto_migrate_enabled:
        run_migrations_to_head(database_url=database_url)
    if settings.require_migrated_db:
        assert_database_at_head(engine_override=engine_override, database_url=database_url)
