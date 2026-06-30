from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


DEFAULT_SECRET_KEY = "lumitime-dev-secret-change-me"
DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024
DEFAULT_DEEPSEEK_ALLOWED_BASE_URLS = "https://api.deepseek.com"


def _env_bool(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} 必须是整数。") from exc


def _env_cors_origins() -> tuple[str, ...]:
    return tuple(
        origin.strip()
        for origin in os.getenv("LUMITIME_CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
        if origin.strip()
    )


def _env_csv(name: str, default: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in os.getenv(name, default).split(",") if item.strip())


@dataclass(frozen=True)
class Settings:
    api_prefix: str = "/api/v1"
    database_url: str = field(default_factory=lambda: os.getenv("LUMITIME_DATABASE_URL", "postgresql+psycopg://lumitime:lumitime@127.0.0.1:5432/lumitime"))
    secret_key: str = field(default_factory=lambda: os.getenv("LUMITIME_SECRET_KEY", DEFAULT_SECRET_KEY))
    environment: str = field(default_factory=lambda: os.getenv("LUMITIME_ENV", "development").strip().lower())
    session_cookie_name: str = "lumitime_session"
    csrf_cookie_name: str = "lumitime_csrf"
    cookie_secure: bool = field(default_factory=lambda: _env_bool("LUMITIME_COOKIE_SECURE"))
    upload_dir: Path = field(default_factory=lambda: Path(os.getenv("LUMITIME_UPLOAD_DIR", "backend/uploads")))
    max_upload_bytes: int = field(default_factory=lambda: _env_int("LUMITIME_MAX_UPLOAD_BYTES", DEFAULT_MAX_UPLOAD_BYTES))
    bootstrap_demo_data: bool = field(default_factory=lambda: _env_bool("LUMITIME_BOOTSTRAP_DEMO_DATA"))
    enable_inline_worker: bool = field(default_factory=lambda: _env_bool("LUMITIME_ENABLE_INLINE_WORKER", "1"))
    auto_migrate_requested: bool = field(default_factory=lambda: _env_bool("LUMITIME_AUTO_MIGRATE", "1"))
    require_migrated_db: bool = field(default_factory=lambda: _env_bool("LUMITIME_REQUIRE_MIGRATED_DB", "1"))
    bootstrap_token: str | None = field(default_factory=lambda: os.getenv("LUMITIME_BOOTSTRAP_TOKEN") or None)
    cors_origins: tuple[str, ...] = field(default_factory=_env_cors_origins)
    log_submit_mode: str = field(default_factory=lambda: os.getenv("LUMITIME_LOG_SUBMIT_MODE", "real").strip().lower())
    log_submit_canary_usernames: tuple[str, ...] = field(default_factory=lambda: _env_csv("LUMITIME_LOG_SUBMIT_CANARY_USERNAMES", ""))
    deepseek_allowed_base_urls: tuple[str, ...] = field(default_factory=lambda: _env_csv("LUMITIME_DEEPSEEK_ALLOWED_BASE_URLS", DEFAULT_DEEPSEEK_ALLOWED_BASE_URLS))

    def __post_init__(self) -> None:
        if self.max_upload_bytes < 1:
            raise RuntimeError("LUMITIME_MAX_UPLOAD_BYTES 必须大于 0。")
        if self.is_production:
            self.validate_production()

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def demo_seed_enabled(self) -> bool:
        return self.bootstrap_demo_data and not self.is_production

    @property
    def inline_worker_enabled(self) -> bool:
        return self.enable_inline_worker

    @property
    def real_log_submit_enabled(self) -> bool:
        return self.log_submit_mode == "real" and self.environment != "test"

    @property
    def real_log_submit_canary_enabled(self) -> bool:
        return self.log_submit_mode in {"real_canary", "canary"} and self.environment != "test"

    @property
    def dry_run_log_submit_enabled(self) -> bool:
        return self.log_submit_mode in {"dry_run", "mock", "simulated"} or self.environment == "test"

    @property
    def auto_migrate_enabled(self) -> bool:
        return self.auto_migrate_requested and not self.is_production

    def validate_production(self) -> None:
        errors: list[str] = []
        if self.secret_key == DEFAULT_SECRET_KEY or len(self.secret_key.strip()) < 32:
            errors.append("LUMITIME_SECRET_KEY 必须设置为至少 32 字符的非默认密钥")
        if not self.cookie_secure:
            errors.append("LUMITIME_COOKIE_SECURE 在生产环境必须为 1")
        if not self.cors_origins:
            errors.append("LUMITIME_CORS_ORIGINS 在生产环境不能为空")
        if any(origin == "*" for origin in self.cors_origins):
            errors.append("LUMITIME_CORS_ORIGINS 在生产环境不能包含通配符 *")
        if errors:
            raise RuntimeError("生产配置不安全：" + "；".join(errors) + "。")


settings = Settings()
