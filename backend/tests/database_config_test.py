from __future__ import annotations

import os
import subprocess
import sys


def test_production_rejects_sqlite_database_url() -> None:
    env = os.environ.copy()
    env["LUMITIME_ENV"] = "production"
    env["LUMITIME_DATABASE_URL"] = "sqlite:///./should-not-start.db"
    result = subprocess.run(
        [sys.executable, "-c", "import backend.app.database"],
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert result.returncode != 0
    assert "必须使用 PostgreSQL" in (result.stderr + result.stdout)


def test_test_environment_allows_sqlite_database_url() -> None:
    env = os.environ.copy()
    env["LUMITIME_ENV"] = "test"
    env["LUMITIME_DATABASE_URL"] = "sqlite:///:memory:"
    result = subprocess.run(
        [sys.executable, "-c", "import backend.app.database; print('ok')"],
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr
    assert "ok" in result.stdout
