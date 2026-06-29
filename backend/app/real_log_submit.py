from __future__ import annotations

import asyncio
import math
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from .log_submit import PreparedLogContent, prepare_log_content


@dataclass(frozen=True)
class RealSubmitEvent:
    step: str
    message: str
    level: str = "info"


@dataclass(frozen=True)
class RealSubmitResult:
    content: PreparedLogContent
    events: list[RealSubmitEvent]


class RealSubmitError(RuntimeError):
    def __init__(self, message: str, *, failure_code: str, events: list[RealSubmitEvent]) -> None:
        super().__init__(message)
        self.failure_code = failure_code
        self.events = events


def run_real_log_submit(
    *,
    student_account: str,
    student_password: str,
    raw_task_config: dict[str, Any],
    sanitized_task_config: dict[str, Any],
) -> RealSubmitResult:
    events: list[RealSubmitEvent] = [
        RealSubmitEvent("real_submit", "已切换到 submit_example 真实提交脚本。"),
    ]
    try:
        _preflight_submit_example_resources(events)
        content = prepare_log_content(raw_task_config, sanitized_task_config)
        display_name = str(raw_task_config.get("display_name") or "").strip()
        if not display_name:
            raise ValueError("姓名不能为空。")
        log_dates = [date.fromisoformat(item) for item in content.target_dates]
        pacing_total_sec = _safe_float(raw_task_config.get("pacing_total_sec"), 0.0)
        request_spacing_sec = _safe_float(raw_task_config.get("request_spacing_sec"), 0.0)
        events.append(
            RealSubmitEvent(
                "sxrz_prepare",
                (
                    f"准备实习日志正文来源：{content.source_label}，"
                    f"生成正文数={len(content.texts_by_date)}，汉字数={content.han_chars}。"
                ),
            )
        )
        asyncio.run(
            _execute_submit_example(
                student_account=student_account,
                student_password=student_password,
                display_name=display_name,
                content=content,
                log_dates=log_dates,
                pacing_total_sec=pacing_total_sec,
                request_spacing_sec=request_spacing_sec,
                events=events,
            )
        )
        return RealSubmitResult(content=content, events=events)
    except Exception as exc:  # noqa: BLE001 - map script failures to service failure codes.
        if isinstance(exc, RealSubmitError):
            raise
        raise RealSubmitError(str(exc), failure_code=_failure_code_from_error(exc), events=events) from exc
    finally:
        student_password = ""


def _preflight_submit_example_resources(events: list[RealSubmitEvent]) -> None:
    from submit_example import jw_chain, sso_cppu

    missing: list[str] = []
    tool_path = Path(sso_cppu._TOOLS)  # noqa: SLF001 - submit_example exposes no public config object.
    if not tool_path.is_file():
        tool_candidates = "；".join(str(path) for path in sso_cppu._TOOL_CANDIDATES)  # noqa: SLF001
        missing.append(f"缺少加密脚本，已查找: {tool_candidates}")
    for dependency_path in sso_cppu._RSA_DEPENDENCIES:  # noqa: SLF001
        if not Path(dependency_path).is_file():
            missing.append(f"缺少 RSA 依赖文件: {dependency_path}")
    template_path = Path(jw_chain._DOSAVE_TEMPLATE)  # noqa: SLF001
    if not template_path.is_file():
        candidates = "；".join(str(path) for path in jw_chain._DOSAVE_TEMPLATE_CANDIDATES)  # noqa: SLF001
        missing.append(f"缺少 doSave 模板文件，已查找: {candidates}")
    if missing:
        message = "真实提交脚本资源缺失：" + "；".join(missing)
        events.append(RealSubmitEvent("script_preflight", message, "error"))
        raise RuntimeError(message)
    events.append(RealSubmitEvent("script_preflight", "真实提交脚本资源预检通过。"))


async def _execute_submit_example(
    *,
    student_account: str,
    student_password: str,
    display_name: str,
    content: PreparedLogContent,
    log_dates: list[date],
    pacing_total_sec: float,
    request_spacing_sec: float,
    events: list[RealSubmitEvent],
) -> None:
    from submit_example.orchestrator_stub import execute_stub

    async def emit(event: dict[str, Any]) -> None:
        events.append(
            RealSubmitEvent(
                step=str(event.get("step") or "submit_example"),
                message=str(event.get("message") or ""),
                level=str(event.get("level") or "info"),
            )
        )

    await execute_stub(
        jw_username=student_account.strip(),
        jw_password=student_password,
        confirmed_text_han=content.han_chars,
        emit=emit,
        student_no=student_account.strip(),
        display_name=display_name,
        sxrz_text="",
        sxrz_by_bgrq=content.texts_by_date,
        log_dates=log_dates,
        pacing_total_sec=pacing_total_sec,
        request_spacing_sec=request_spacing_sec,
    )


def _safe_float(value: Any, default: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(parsed):
        return default
    return max(parsed, 0.0)


def _failure_code_from_error(exc: Exception) -> str:
    message = str(exc).lower()
    if isinstance(exc, ValueError):
        return "VALIDATION_ERROR"
    if any(token in message for token in ["需要安装", "未找到", "缺少", "missing", "not found", "no module"]):
        return "SCRIPT_ERROR"
    if "timeout" in message or "超时" in message:
        return "TIMEOUT"
    if any(token in message for token in ["账号", "密码", "验证码", "登录", "sso"]):
        return "AUTH_FAILED"
    if any(token in message for token in ["network", "connection", "网络", "temporarily", "dns"]):
        return "NETWORK_ERROR"
    if any(token in message for token in ["dosave", "教务", "http "]):
        return "SCHOOL_SYSTEM_ERROR"
    return "SCRIPT_ERROR"
