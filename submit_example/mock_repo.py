"""案例库：均匀随机一条。"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path


@dataclass
class MockEntry:
    id: int
    text: str


class MockLogRepository:
    def __init__(self, json_path: Path) -> None:
        raw = json.loads(json_path.read_text(encoding="utf-8"))
        self._entries: list[MockEntry] = [
            MockEntry(id=int(e["id"]), text=str(e["text"])) for e in raw
        ]
        if not self._entries:
            raise ValueError("mock_logs.json 为空")

    def random_one(self) -> MockEntry:
        return random.choice(self._entries)
