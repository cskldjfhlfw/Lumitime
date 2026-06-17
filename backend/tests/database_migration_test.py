from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, inspect

from backend.app import db_lifecycle


def _runtime_settings(
    database_url: str,
    *,
    is_production: bool,
    auto_migrate_enabled: bool,
    require_migrated_db: bool,
) -> SimpleNamespace:
    return SimpleNamespace(
        database_url=database_url,
        is_production=is_production,
        auto_migrate_enabled=auto_migrate_enabled,
        require_migrated_db=require_migrated_db,
    )


def test_initialize_database_for_runtime_upgrades_sqlite_schema(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "runtime.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    engine = create_engine(database_url, future=True)
    monkeypatch.setattr(
        db_lifecycle,
        "settings",
        _runtime_settings(database_url, is_production=False, auto_migrate_enabled=True, require_migrated_db=True),
    )

    db_lifecycle.initialize_database_for_runtime(engine_override=engine, database_url=database_url)

    tables = set(inspect(engine).get_table_names())
    assert {"users", "service_requests", "alembic_version"}.issubset(tables)

    engine.dispose()


def test_initialize_database_for_runtime_rejects_unmigrated_production_db(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "production.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    engine = create_engine(database_url, future=True)
    monkeypatch.setattr(
        db_lifecycle,
        "settings",
        _runtime_settings(database_url, is_production=True, auto_migrate_enabled=False, require_migrated_db=True),
    )

    with pytest.raises(RuntimeError, match="alembic upgrade head"):
        db_lifecycle.initialize_database_for_runtime(engine_override=engine, database_url=database_url)

    engine.dispose()
