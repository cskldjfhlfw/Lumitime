from __future__ import annotations

import random
import re
import time
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.parse import urlunparse

import httpx

from .config import settings


INTERNSHIP_START_DATE = date(2026, 4, 13)
SXRZ_MAX_HAN = 200
SXRZ_TARGET_MIN_HAN = 80
SXRZ_TARGET_MAX_HAN = 200
DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash"

RESOURCE_DIR = Path(__file__).resolve().parents[1] / "resources"
LOG_LIBRARY_PATH = RESOURCE_DIR / "logs_text.txt"
_LINE_PREFIX_RE = re.compile(r"^\s*\d+\.\s*")
_HAN_RE = re.compile(r"[\u3400-\u9fff]")


@dataclass(frozen=True)
class PreparedLogContent:
    source: str
    source_label: str
    han_chars: int
    target_dates: tuple[str, ...]
    texts_by_date: dict[str, str]
    library_total: int | None = None


def count_han_chars(text: str) -> int:
    return len(_HAN_RE.findall(text or ""))


def truncate_to_max_han(text: str, max_han: int = 500) -> str:
    if max_han <= 0:
        return ""
    out: list[str] = []
    count = 0
    for char in text or "":
        if _HAN_RE.match(char):
            if count >= max_han:
                break
            count += 1
        out.append(char)
    return "".join(out).strip()


def strip_log_line_prefix(line: str) -> str:
    return _LINE_PREFIX_RE.sub("", line.strip(), count=1).strip()


@lru_cache(maxsize=1)
def load_log_library_entries() -> tuple[str, ...]:
    if not LOG_LIBRARY_PATH.is_file():
        raise RuntimeError("日志库文件不存在。")
    entries = tuple(
        cleaned
        for cleaned in (strip_log_line_prefix(line) for line in LOG_LIBRARY_PATH.read_text(encoding="utf-8").splitlines())
        if cleaned
    )
    if not entries:
        raise RuntimeError("日志库没有可用正文。")
    return entries


def draw_random_entries(count: int) -> tuple[list[tuple[str, int]], int]:
    entries = load_log_library_entries()
    rng = random.Random(time.time_ns())
    desired = max(count, 1)
    remaining = list(range(len(entries)))
    picks: list[tuple[str, int]] = []
    while len(picks) < desired:
        if not remaining:
            remaining = list(range(len(entries)))
        chosen = rng.sample(remaining, k=min(desired - len(picks), len(remaining)))
        for idx in chosen:
            picks.append((entries[idx], idx + 1))
        chosen_set = set(chosen)
        remaining = [idx for idx in remaining if idx not in chosen_set]
    return picks, len(entries)


def parse_log_dates(task_config: dict[str, Any]) -> list[date]:
    raw_values: list[Any] = []
    if task_config.get("target_date"):
        raw_values.append(task_config["target_date"])
    if task_config.get("log_date"):
        raw_values.append(task_config["log_date"])
    log_dates = task_config.get("log_dates")
    if isinstance(log_dates, list):
        raw_values.extend(log_dates)
    elif isinstance(log_dates, str):
        raw_values.extend(part for part in re.split(r"[\s,，;；]+", log_dates) if part)

    dates: list[date] = []
    for value in raw_values:
        try:
            dates.append(date.fromisoformat(str(value).strip()[:10]))
        except ValueError:
            continue
    return sorted(set(dates))


def prepare_log_content(raw_task_config: dict[str, Any], sanitized_task_config: dict[str, Any]) -> PreparedLogContent:
    raw_dates = parse_log_dates(raw_task_config)
    target_dates = tuple(day.isoformat() for day in (raw_dates or parse_log_dates(sanitized_task_config)))
    if not target_dates:
        target_dates = (date.today().isoformat(),)

    activity = str(raw_task_config.get("station_activity_text") or "").strip()
    api_key = str(raw_task_config.get("deepseek_api_key") or "").strip()
    manual_text = str(raw_task_config.get("sxrz_text") or "").strip()
    log_date_values = [date.fromisoformat(item) for item in target_dates]

    if manual_text:
        text = truncate_to_max_han(manual_text, 500)
        return PreparedLogContent(
            source="manual",
            source_label="手写正文",
            han_chars=count_han_chars(text),
            target_dates=target_dates,
            texts_by_date={day: text for day in target_dates},
        )

    if activity and api_key:
        base_url = str(raw_task_config.get("deepseek_base_url") or "https://api.deepseek.com").strip()
        model = str(raw_task_config.get("deepseek_model") or DEEPSEEK_DEFAULT_MODEL).strip()
        texts_by_date: dict[str, str] = {}
        for log_day in log_date_values:
            generated = generate_internship_log_via_deepseek(
                activity=activity,
                api_key=api_key,
                base_url=base_url,
                model=model,
                log_dates=[log_day],
            ).strip()
            texts_by_date[log_day.isoformat()] = truncate_to_max_han(generated, 500)
        max_han = max((count_han_chars(text) for text in texts_by_date.values()), default=0)
        return PreparedLogContent(
            source="deepseek",
            source_label=f"DeepSeek 逐日生成（{len(texts_by_date)} 次）",
            han_chars=max_han,
            target_dates=target_dates,
            texts_by_date=texts_by_date,
        )

    picks, total = draw_random_entries(len(target_dates))
    texts_by_date = {
        day: truncate_to_max_han(text, 500)
        for day, (text, _pick_idx) in zip(target_dates, picks, strict=True)
    }
    max_han = max((count_han_chars(text) for text in texts_by_date.values()), default=0)
    return PreparedLogContent(
        source="library",
        source_label="本地日志库随机抽取",
        han_chars=max_han,
        target_dates=target_dates,
        texts_by_date=texts_by_date,
        library_total=total,
    )


def _fmt_cn_date(value: date) -> str:
    return f"{value.year}年{value.month}月{value.day}日"


def _natural_week_index_one_based(start: date, log_day: date) -> int | None:
    days = (log_day - start).days
    if days < 0:
        return None
    return days // 7 + 1


def _system_prompt() -> str:
    start = INTERNSHIP_START_DATE
    return f"""你是实习日志撰写助手。写作身份需始终遵循以下设定（不要输出设定说明或客套话，只输出日记正文本身）：
- 身份：公安院校本科三年级学生，正在派出所进行专业实习。
- 场景：基层派出所日常勤务、接处警辅助、社区走访、纠纷调解协助、材料整理与信息登记等一线实习环境。
- 体裁：实习日志正文（对应教务字段 SXRZ），第一人称「我」，书面语、积极规范，符合警务实习语境，不编造未发生的重大警情细节。
- 实习时间线：专业实习固定自 {_fmt_cn_date(start)} 开始。若正文中要写周次，仅可使用用户消息中根据 BGRQ 推算的周次。
- 篇幅：正文为单段连续文字，汉字数不得超过 {SXRZ_MAX_HAN} 个，建议 {SXRZ_TARGET_MIN_HAN}～{SXRZ_TARGET_MAX_HAN} 个汉字。
- 格式：不要使用标题、序号、Markdown、引号包裹全文。"""


def generate_internship_log_via_deepseek(
    *,
    activity: str,
    api_key: str,
    base_url: str = "https://api.deepseek.com",
    model: str = DEEPSEEK_DEFAULT_MODEL,
    timeout_sec: float = 90.0,
    log_dates: list[date] | None = None,
) -> str:
    base_url = validate_deepseek_base_url(base_url)

    dates = sorted(set(log_dates or []))
    schedule_lines: list[str] = []
    for day in dates:
        week = _natural_week_index_one_based(INTERNSHIP_START_DATE, day)
        if week is None:
            schedule_lines.append(f"- 日志日期 BGRQ = {day.isoformat()}（早于实习开始日，不写周次）")
        else:
            schedule_lines.append(
                f"- 日志日期 BGRQ = {day.isoformat()}：自 {INTERNSHIP_START_DATE.isoformat()} 起算，为第 {week} 个自然周。"
            )
    schedule_block = "\n".join(schedule_lines) if schedule_lines else "（未提供日志日期，请勿写具体 BGRQ 与周次）"
    user_message = (
        f"【实习开始日】{_fmt_cn_date(INTERNSHIP_START_DATE)}（{INTERNSHIP_START_DATE.isoformat()}）\n"
        f"【本次填报日志日期与周次说明】\n{schedule_block}\n\n"
        "以下是今天在派出所实际参与或观察到的工作要点：\n\n"
        f"{activity.strip()}\n\n"
        f"请写出可直接粘贴到教务系统「实习日志」中的正文，汉字数不得超过 {SXRZ_MAX_HAN}。"
    )
    payload: dict[str, Any] = {
        "model": model or DEEPSEEK_DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": user_message},
        ],
        "max_tokens": 1024,
        "temperature": 0.55,
    }
    url = f"{base_url.rstrip('/')}/v1/chat/completions"
    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=timeout_sec,
        )
    except httpx.RequestError as exc:
        raise RuntimeError("DeepSeek 网络请求失败，请检查网络或 Base URL。") from exc
    if response.status_code >= 400:
        raise RuntimeError(f"DeepSeek 请求失败 HTTP {response.status_code}，请检查 API Key 与 Base URL。")
    try:
        content = (response.json()["choices"][0]["message"].get("content") or "").strip()
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise RuntimeError("DeepSeek 返回格式异常，请稍后重试。") from exc
    if not content:
        raise RuntimeError("DeepSeek 返回空正文，请调整「今日记事」后重试。")
    return content


def validate_deepseek_base_url(base_url: str) -> str:
    normalized = _normalize_deepseek_base_url(base_url)
    allowed = {_normalize_deepseek_base_url(item) for item in settings.deepseek_allowed_base_urls}
    if normalized not in allowed:
        raise RuntimeError("DeepSeek Base URL 不在允许列表。")
    return normalized


def _normalize_deepseek_base_url(base_url: str) -> str:
    value = (base_url or "https://api.deepseek.com").strip() or "https://api.deepseek.com"
    parsed = urlparse(value)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.username is not None
        or parsed.password is not None
        or parsed.params
        or parsed.query
        or parsed.fragment
    ):
        raise RuntimeError("DeepSeek Base URL 格式无效。")
    netloc = parsed.netloc.lower()
    if parsed.scheme == "https" and netloc.endswith(":443"):
        netloc = netloc[:-4]
    if parsed.scheme == "http" and netloc.endswith(":80"):
        netloc = netloc[:-3]
    path = parsed.path.rstrip("/")
    return urlunparse((parsed.scheme.lower(), netloc, path, "", "", ""))
