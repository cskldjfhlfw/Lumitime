"""
MVP 编排：实战 SSO → 教务 app/index → h5 → 按日期循环 getCurrentTask → doInitForm → POST doSave。

- 默认 `MVP_REAL_SSO=1`；`MVP_DRY_RUN=1` 为不调外网干跑。
"""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Awaitable, Callable
from datetime import date
from typing import Any

from app.jw_chain import run_jw_chain
from app.sso_cppu import try_sso_login

logger = logging.getLogger(__name__)

EmitFn = Callable[[dict[str, Any]], Awaitable[None]]


def _dry_run() -> bool:
    return os.environ.get("MVP_DRY_RUN", "0").strip() == "1"


def _real_sso() -> bool:
    return os.environ.get("MVP_REAL_SSO", "1").strip() == "1"


async def execute_stub(
    *,
    jw_username: str,
    jw_password: str,
    confirmed_text_han: int,
    emit: EmitFn,
    student_no: str,
    display_name: str,
    sxrz_text: str,
    log_dates: list[date],
    pacing_total_sec: float = 0.0,
    sxrz_by_bgrq: dict[str, str] | None = None,
    request_spacing_sec: float = 0.0,
) -> None:
    dry = _dry_run()
    real_sso = _real_sso() and not dry

    if dry:
        await emit(
            {
                "level": "warn",
                "step": "mvp_mode",
                "message": "MVP_DRY_RUN=1：不真实请求外网（调试用）",
                "detail": None,
            }
        )
        steps = [
            ("sso_login", "SSO（占位）", None),
            ("captcha", "验证码（占位）", None),
            ("rsa_encrypt", "RSA（占位）", None),
            ("chaoxing_cas", "CAS（占位）", None),
            ("jw_auth", "教务授权（占位）", None),
            (
                "jw_prepare",
                "doSave 组装（占位）",
                {
                    "confirmed_han": confirmed_text_han,
                    "log_dates": [d.isoformat() for d in log_dates],
                    "pacing_total_sec": pacing_total_sec,
                    "request_spacing_sec": request_spacing_sec,
                    "per_day_sxrzs": len(sxrz_by_bgrq) if sxrz_by_bgrq is not None else 0,
                },
            ),
            ("jw_do_save", "doSave（占位）", {"http_status": None}),
        ]
        for step, message, detail in steps:
            await emit({"level": "info", "step": step, "message": message, "detail": detail})
            await asyncio.sleep(0.2)
            logger.info("dry step=%s", step)
        await emit(
            {
                "level": "warn",
                "step": "mvp_complete",
                "message": f"MVP 干跑结束。账号（脱敏）：{_mask_user(jw_username)}",
                "detail": None,
            }
        )
        return

    if not real_sso:
        raise RuntimeError(
            "当前为实战模式：请设置 MVP_REAL_SSO=1（run.bat 默认已设），"
            "或设置 MVP_DRY_RUN=1 进行不调外网的干跑。"
        )

    logs, ok, err, session = await asyncio.to_thread(try_sso_login, jw_username, jw_password)
    for row in logs:
        await emit(
            {
                "level": row.get("level", "info"),
                "step": row["step"],
                "message": row["message"],
                "detail": row.get("detail"),
            }
        )
        await asyncio.sleep(0.02)
    if not ok:
        raise RuntimeError(err or "SSO 登录失败")
    await emit(
        {
            "level": "info",
            "step": "sso_done",
            "message": "SSO 完成，开始教务链（app/index → …）",
            "detail": None,
        }
    )

    if session is None:
        raise RuntimeError("SSO 未返回会话，无法继续教务链")

    jw_logs = await asyncio.to_thread(
        run_jw_chain,
        session,
        student_no=student_no,
        display_name=display_name,
        sxrz_text=sxrz_text,
        sxrz_by_bgrq=sxrz_by_bgrq,
        log_dates=log_dates,
        pacing_total_sec=pacing_total_sec,
        request_spacing_sec=request_spacing_sec,
    )
    for row in jw_logs:
        await emit(
            {
                "level": row.get("level", "info"),
                "step": row["step"],
                "message": row["message"],
                "detail": row.get("detail"),
            }
        )
        await asyncio.sleep(0.02)

    await emit(
        {
            "level": "info",
            "step": "mvp_complete",
            "message": (
                "链路结束，已按所选日期 POST doSave（见各日 jw_do_save）。"
                + f" 账号（脱敏）：{_mask_user(jw_username)}"
            ),
            "detail": {
                "confirmed_han": confirmed_text_han,
                "log_dates": [d.isoformat() for d in log_dates],
                "pacing_total_sec": pacing_total_sec,
                "request_spacing_sec": request_spacing_sec,
            },
        }
    )


def _mask_user(u: str) -> str:
    u = u.strip()
    if len(u) <= 2:
        return "***"
    return u[0] + "*" * (len(u) - 2) + u[-1]
