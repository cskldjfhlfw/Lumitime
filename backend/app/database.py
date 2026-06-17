from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


database_url_value = settings.database_url.strip()
if not database_url_value:
    raise RuntimeError("LUMITIME_DATABASE_URL 不能为空。")

database_url = make_url(database_url_value)
if settings.is_production and database_url.get_backend_name() != "postgresql":
    raise RuntimeError("LUMITIME_ENV=production 时必须使用 PostgreSQL 数据库。")

engine_kwargs: dict[str, object] = {"future": True}
if database_url.get_backend_name() == "sqlite":
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(database_url_value, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
