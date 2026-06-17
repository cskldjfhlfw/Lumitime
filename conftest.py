from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TEST_ROOT = Path(tempfile.mkdtemp(prefix="lumitime-tests-"))

os.environ["LUMITIME_ENV"] = "test"
os.environ["LUMITIME_BOOTSTRAP_DEMO_DATA"] = "1"
os.environ["LUMITIME_ENABLE_INLINE_WORKER"] = "1"
os.environ["LUMITIME_AUTO_MIGRATE"] = "1"
os.environ["LUMITIME_REQUIRE_MIGRATED_DB"] = "1"
os.environ["LUMITIME_BOOTSTRAP_TOKEN"] = "pytest-bootstrap-token"
os.environ["LUMITIME_DATABASE_URL"] = f"sqlite:///{(TEST_ROOT / 'lumitime-test.db').as_posix()}"
os.environ["LUMITIME_UPLOAD_DIR"] = str(TEST_ROOT / "uploads")

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
