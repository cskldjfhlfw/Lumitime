"""
从项目根目录 backend/resources/logs_text.txt 随机抽取一条实习日志正文。
行首形如「1. 」「12. 」的前缀会被去掉，仅保留正文。
"""

from __future__ import annotations

import random
import re
import time
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
LOG_LIBRARY_PATH = _REPO / "backend" / "resources" / "logs_text.txt"

_LINE_PREFIX = re.compile(r"^\s*\d+\.\s*")


def strip_log_line_prefix(line: str) -> str:
    """去掉行首「数字 + . + 空白」前缀。"""
    s = line.strip()
    if not s:
        return ""
    return _LINE_PREFIX.sub("", s, count=1).strip()


def load_log_library_entries(path: Path | None = None) -> list[str]:
    """读取日志库，每行去前缀后得到非空条目列表。"""
    p = path or LOG_LIBRARY_PATH
    if not p.is_file():
        raise FileNotFoundError(f"未找到日志库文件: {p}")
    raw = p.read_text(encoding="utf-8")
    entries: list[str] = []
    for line in raw.splitlines():
        cleaned = strip_log_line_prefix(line)
        if cleaned:
            entries.append(cleaned)
    if not entries:
        raise ValueError(f"日志库无有效条目: {p}")
    return entries


def pick_random_log_entry(*, seed_ns: int | None = None) -> str:
    """
    根据时间戳（纳秒）为种子随机抽取一条；便于同秒内多次调用也有不同结果。
    """
    entries = load_log_library_entries()
    seed = seed_ns if seed_ns is not None else time.time_ns()
    rng = random.Random(seed)
    return rng.choice(entries)


def draw_one_from_library() -> tuple[str, int, int, int]:
    """
    返回 (正文, 1-based 条号, 总条数, 随机种子纳秒)。
    """
    entries = load_log_library_entries()
    seed = time.time_ns()
    rng = random.Random(seed)
    idx = rng.randrange(len(entries))
    return entries[idx], idx + 1, len(entries), seed


def draw_random_entries(count: int) -> tuple[list[tuple[str, int]], int]:
    """
    为多天提交各抽一条（可重复抽到同一条）。
    返回 ([(正文, 1-based 条号), ...], 库内总条数)。
    """
    if count <= 0:
        return [], 0
    entries = load_log_library_entries()
    n = len(entries)
    rng = random.Random(time.time_ns())
    out: list[tuple[str, int]] = []
    for _ in range(count):
        idx = rng.randrange(n)
        out.append((entries[idx], idx + 1))
    return out, n
