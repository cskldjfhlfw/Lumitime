"""
调用 DeepSeek（OpenAI 兼容 /v1/chat/completions）根据「今日派出所记事」生成实习日志 SXRZ。
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

import requests

logger = logging.getLogger(__name__)

# 专业实习开始日（与培养方案一致时在此维护；提示词会告知模型，避免其臆造周次）
INTERNSHIP_START_DATE = date(2026, 4, 13)

# 字数：按汉字计；靠提示词约束，服务端不对模型输出做截断（与 main 一致）
SXRZ_MAX_HAN = 200
SXRZ_TARGET_MIN_HAN = 80
SXRZ_TARGET_MAX_HAN = 200


def _fmt_cn_date(d: date) -> str:
    return f"{d.year}年{d.month}月{d.day}日"


def _natural_week_index_one_based(start: date, log_day: date) -> int | None:
    """自开始日所在自然周起算：含开始日当天为第 1 周，每满 7 天进一周。"""
    days = (log_day - start).days
    if days < 0:
        return None
    return days // 7 + 1


def _build_system_prompt() -> str:
    sd = INTERNSHIP_START_DATE
    s_cn = _fmt_cn_date(sd)
    return f"""你是实习日志撰写助手。写作身份需始终遵循以下设定（不要输出设定说明或客套话，只输出日记正文本身）：
- 身份：公安院校本科三年级学生，正在派出所进行专业实习。
- 场景：基层派出所日常勤务、接处警辅助、社区走访、纠纷调解协助、材料整理与信息登记等一线实习环境。
- 体裁：实习日志正文（对应教务字段 SXRZ），第一人称「我」，书面语、积极规范，符合警务实习语境，不编造未发生的重大警情细节。
- **实习时间线（务必遵守）**：专业实习**固定自 {s_cn}** 开始（系统给定，勿改写日期）。用户消息会给出本次填报对应的**日志日期 BGRQ**（可能多天）。
  - **禁止臆造**「实习第几周」「第几个实习周」等与事实不符的周次表述。
  - 若正文中要写周次，**仅可**与用户消息中「系统按开始日与 BGRQ 推算」的周次说明**完全一致**；若用户消息未给出周次或你无把握，则**不要写「第几周」**，只写当日工作即可。
- 篇幅（务必遵守）：正文为单段连续文字；统计范围为**汉字**（中日韩统一表意文字），标点、数字、字母不计入。
  - **全文汉字数不得超过 {SXRZ_MAX_HAN} 个**；建议 **{SXRZ_TARGET_MIN_HAN}～{SXRZ_TARGET_MAX_HAN}** 个汉字。
  - 宁短勿超：若素材多请压缩，在上限内以句号自然结束。
- 格式：不要使用标题、序号、Markdown、引号包裹全文。"""


SYSTEM_PROMPT = _build_system_prompt()


def generate_internship_log_via_deepseek(
    *,
    activity: str,
    api_key: str,
    base_url: str = "https://api.deepseek.com",
    model: str = "deepseek-v4-flash",
    timeout_sec: int = 90,
    internship_start: date | None = None,
    log_dates: list[date] | None = None,
) -> str:
    """
    根据学生在派出所的简要纪要用 DeepSeek 生成一段实习日志正文。
    ``internship_start`` 默认 ``INTERNSHIP_START_DATE``；``log_dates`` 用于写入 BGRQ 与周次推算说明。
    """
    start = internship_start or INTERNSHIP_START_DATE
    dates = sorted(set(log_dates or []))

    schedule_lines: list[str] = []
    for d in dates:
        wk = _natural_week_index_one_based(start, d)
        if wk is None:
            schedule_lines.append(
                f"- 日志日期 BGRQ = {d.isoformat()}（早于实习开始日 {start.isoformat()}，不在此写周次）"
            )
        else:
            schedule_lines.append(
                f"- 日志日期 BGRQ = {d.isoformat()}：自实习开始日 {start.isoformat()} 起算，"
                f"为第 {wk} 个自然周（仅在你确有把握且需写周次时使用该数字；否则不写周次）"
            )
    schedule_block = (
        "\n".join(schedule_lines) if schedule_lines else "（未提供日志日期，请勿写具体 BGRQ 与周次）"
    )

    url = f"{base_url.rstrip('/')}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    user_msg = (
        f"【实习开始日（系统固定）】{_fmt_cn_date(start)}（{start.isoformat()}）\n"
        f"【本次填报日志日期与周次说明（系统推算，供必要时与正文一致；不得编造其他周次）】\n"
        f"{schedule_block}\n\n"
        "以下是我今天在派出所实际参与或观察到的工作要点（可含时间、地点、事项关键词）：\n\n"
        f"{activity.strip()}\n\n"
        "请严格按系统设定中的身份、场景、**实习开始日与 BGRQ**、**字数上限**，写出一段可直接粘贴到教务系统「实习日志」中的正文。"
        f"再次强调：汉字数不得超过 {SXRZ_MAX_HAN}，建议 {SXRZ_TARGET_MIN_HAN}～{SXRZ_TARGET_MAX_HAN}；"
        "以句号自然结束，勿附字数统计或后记。"
    )
    payload: dict[str, Any] = {
        "model": model.strip() or "deepseek-v4-flash",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "max_tokens": 1024,
        "temperature": 0.55,
    }
    r = requests.post(url, headers=headers, json=payload, timeout=timeout_sec)
    if r.status_code >= 400:
        try:
            err = r.json()
        except Exception:
            err = {"raw": (r.text or "")[:500]}
        logger.warning("DeepSeek HTTP %s: %s", r.status_code, err)
        raise RuntimeError(f"DeepSeek 请求失败 HTTP {r.status_code}，请检查 API Key 与 Base URL。")
    data = r.json()
    try:
        content = (data["choices"][0]["message"].get("content") or "").strip()
    except (KeyError, IndexError, TypeError) as e:
        logger.warning("DeepSeek 响应结构异常: %s", data)
        raise RuntimeError("DeepSeek 返回格式异常，请稍后重试。") from e
    if not content:
        raise RuntimeError("DeepSeek 返回空正文，请调整「派出所记事」描述后重试。")
    return content
