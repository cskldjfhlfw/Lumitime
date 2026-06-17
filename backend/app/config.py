from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _env_bool(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    api_prefix: str = "/api/v1"
    database_url: str = os.getenv("LUMITIME_DATABASE_URL", "postgresql+psycopg://lumitime:lumitime@127.0.0.1:5432/lumitime")
    secret_key: str = os.getenv("LUMITIME_SECRET_KEY", "lumitime-dev-secret-change-me")
    environment: str = os.getenv("LUMITIME_ENV", "development").strip().lower()
    session_cookie_name: str = "lumitime_session"
    cookie_secure: bool = os.getenv("LUMITIME_COOKIE_SECURE", "0") == "1"
    upload_dir: Path = Path(os.getenv("LUMITIME_UPLOAD_DIR", "backend/uploads"))
    bootstrap_demo_data: bool = _env_bool("LUMITIME_BOOTSTRAP_DEMO_DATA")
    enable_inline_worker: bool = _env_bool("LUMITIME_ENABLE_INLINE_WORKER")
    auto_migrate_requested: bool = _env_bool("LUMITIME_AUTO_MIGRATE", "1")
    require_migrated_db: bool = _env_bool("LUMITIME_REQUIRE_MIGRATED_DB", "1")
    bootstrap_token: str | None = os.getenv("LUMITIME_BOOTSTRAP_TOKEN") or None
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv(
            "LUMITIME_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
        ).split(",")
        if origin.strip()
    )

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def demo_seed_enabled(self) -> bool:
        return self.bootstrap_demo_data and not self.is_production

    @property
    def inline_worker_enabled(self) -> bool:
        return self.enable_inline_worker and not self.is_production

    @property
    def auto_migrate_enabled(self) -> bool:
        return self.auto_migrate_requested and not self.is_production


settings = Settings()
