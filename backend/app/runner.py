from __future__ import annotations

import json
from datetime import timedelta
from threading import Lock
from time import monotonic
from typing import Any

from sqlalchemy import select

from .config import settings
from .core import mask_account, now_utc, prefixed_id, sanitize_text
from .database import SessionLocal
from .log_submit import PreparedLogContent, prepare_log_content
from .models import ServiceExecutionLog, ServiceRequest, WorkstationService
from .real_log_submit import RealSubmitError, run_real_log_submit


TERMINAL_FAILURE_SUMMARIES = {
    "AUTH_FAILED": "账号密码验证失败，无法完成提交。",
    "NETWORK_ERROR": "网络异常，目标系统暂时不可用。",
    "SCHOOL_SYSTEM_ERROR": "学校系统返回异常，请稍后重试。",
    "SCRIPT_ERROR": "自动提交服务运行异常，请联系管理员。",
    "TIMEOUT": "请求超时，目标系统无响应。",
    "VALIDATION_ERROR": "输入校验失败，请检查后重试。",
    "UNKNOWN_ERROR": "未知错误，请联系管理员。",
    "SERVICE_NOT_INTEGRATED": "服务暂未接入真实脚本，请稍后再试。",
}

LOG_AUTO_SUBMIT_SCRIPT_KEY = "log_auto_submit"
CREDENTIAL_TTL_SECONDS = 300.0
_CREDENTIALS: dict[str, tuple[str, str, dict[str, Any], float]] = {}
_CREDENTIAL_LOCK = Lock()


def _prune_expired_credentials(now: float) -> None:
    expired = [request_id for request_id, (*_, expires_at) in _CREDENTIALS.items() if now > expires_at]
    for request_id in expired:
        _CREDENTIALS.pop(request_id, None)


def enqueue_service_credentials(
    service_request_public_id: str,
    student_account: str,
    student_password: str,
    raw_task_config: dict[str, Any] | None = None,
) -> None:
    now = monotonic()
    expires_at = now + CREDENTIAL_TTL_SECONDS
    with _CREDENTIAL_LOCK:
        _prune_expired_credentials(now)
        _CREDENTIALS[service_request_public_id] = (student_account, student_password, raw_task_config or {}, expires_at)


def _pop_service_credentials(service_request_public_id: str) -> tuple[str, str, dict[str, Any]] | None:
    with _CREDENTIAL_LOCK:
        credentials = _CREDENTIALS.pop(service_request_public_id, None)
    if credentials is None:
        return None
    student_account, student_password, raw_task_config, expires_at = credentials
    if monotonic() > expires_at:
        student_account = ""
        student_password = ""
        raw_task_config = {}
        return None
    return student_account, student_password, raw_task_config


def _append_log(
    db,
    record: ServiceRequest,
    sequence: int,
    level: str,
    step: str,
    message: str,
    student_account: str | None,
) -> None:
    db.add(
        ServiceExecutionLog(
            id=prefixed_id("svc_log"),
            service_request_id=record.service_request_id,
            sequence=sequence,
            log_level=level,
            step_name=step,
            message_sanitized=sanitize_text(message, student_account=student_account),
            expires_at=record.expires_at,
        )
    )


def _log_auto_submit_steps(student_account: str, content: PreparedLogContent) -> list[tuple[str, str]]:
    return [
        ("mvp_mode", "本地验收干跑：不请求真实 SSO、教务或第三方接口。"),
        ("validate", f"校验模板字段，账号={mask_account(student_account)}，日期={','.join(content.target_dates)}。"),
        (
            "sxrz_prepare",
            f"准备实习日志正文来源：{content.source_label}，生成正文数={len(content.texts_by_date)}，汉字数={content.han_chars}"
            + (f"，日志库总数={content.library_total}" if content.library_total is not None else "")
            + "。",
        ),
        ("sso_login", f"模拟 SSO 登录页、验证码、RSA 加密与登录提交，账号={student_account}，password=[REDACTED_PASSWORD]。"),
        ("chaoxing_cas", "模拟超星 CAS / 教务桥接链路。"),
        ("jw_prepare", "模拟 app/index -> h5 -> getCurrentTask -> doInitForm。"),
        ("jw_do_save", f"模拟按模板 POST doSave，提交日期数={len(content.target_dates)}。"),
    ]


def _generic_steps(student_account: str) -> list[tuple[str, str]]:
    return [
        ("validate", f"开始校验服务输入，账号={mask_account(student_account)}"),
        ("login", f"开始登录学生学习 App，账号={student_account}，password=[REDACTED_PASSWORD]"),
        ("prepare", "准备学习日志提交参数。"),
        ("submit", "提交学习日志。"),
    ]


def _run_simulated_steps(db, record: ServiceRequest, student_account: str, steps: list[tuple[str, str]]) -> None:
    for idx, (step, message) in enumerate(steps, start=1):
        _append_log(db, record, idx, "info", step, message, student_account)
        db.commit()


def _append_real_submit_events(db, record: ServiceRequest, student_account: str, events: list[Any]) -> None:
    for idx, event in enumerate(events, start=1):
        _append_log(db, record, idx, getattr(event, "level", "info"), getattr(event, "step", "submit_example"), getattr(event, "message", ""), student_account)
    db.commit()


def _mark_missing_credentials(service_request_public_id: str) -> None:
    finished = now_utc()
    db = SessionLocal()
    try:
        record = db.scalar(select(ServiceRequest).where(ServiceRequest.service_request_id == service_request_public_id))
        if record is None or record.status not in {"pending", "running"}:
            return
        record.status = "failed"
        record.failure_code = "VALIDATION_ERROR"
        record.finished_at = finished
        record.duration_ms = int((finished - (record.started_at or record.created_at)).total_seconds() * 1000)
        record.result_summary = TERMINAL_FAILURE_SUMMARIES["VALIDATION_ERROR"]
        _append_log(db, record, 1, "error", "credentials", "执行凭证已失效，请重新提交。", None)
        db.commit()
    finally:
        db.close()


def run_queued_service_request(service_request_public_id: str) -> None:
    credentials = _pop_service_credentials(service_request_public_id)
    if credentials is None:
        _mark_missing_credentials(service_request_public_id)
        return
    student_account, student_password, raw_task_config = credentials
    try:
        _run_service_request_with_credentials(service_request_public_id, student_account, student_password, raw_task_config)
    finally:
        student_account = ""
        student_password = ""
        raw_task_config = {}


def run_service_request(service_request_public_id: str, student_account: str, student_password: str) -> None:
    enqueue_service_credentials(service_request_public_id, student_account, student_password)
    run_queued_service_request(service_request_public_id)


def _run_service_request_with_credentials(
    service_request_public_id: str,
    student_account: str,
    student_password: str,
    raw_task_config: dict[str, Any] | None = None,
) -> None:
    """Run a workstation request.

    Credentials are popped from the short-lived in-memory queue and are never saved.
    The function deliberately avoids logging the raw password.
    """
    started = now_utc()
    db = SessionLocal()
    try:
        record = db.scalar(
            select(ServiceRequest).where(ServiceRequest.service_request_id == service_request_public_id)
        )
        if record is None:
            return
        service = db.get(WorkstationService, record.service_id)

        record.status = "running"
        record.started_at = started
        db.commit()

        account_lower = student_account.lower()
        task_config = {}
        if record.task_config_sanitized_json:
            try:
                task_config = json.loads(record.task_config_sanitized_json)
            except json.JSONDecodeError:
                task_config = {}

        is_log_auto_submit = service is not None and service.script_key == LOG_AUTO_SUBMIT_SCRIPT_KEY
        real_log_submit = is_log_auto_submit and settings.real_log_submit_enabled and not settings.dry_run_log_submit_enabled
        prepared_content: PreparedLogContent | None = None
        steps: list[tuple[str, str]] = []

        if real_log_submit:
            try:
                submit_result = run_real_log_submit(
                    student_account=student_account,
                    student_password=student_password,
                    raw_task_config=raw_task_config or {},
                    sanitized_task_config=task_config,
                )
            except RealSubmitError as exc:
                _append_real_submit_events(db, record, student_account, exc.events)
                failure_code = exc.failure_code
                finished = now_utc()
                record.status = "timeout" if failure_code == "TIMEOUT" else "failed"
                record.failure_code = failure_code
                record.finished_at = finished
                record.duration_ms = int((finished - started).total_seconds() * 1000)
                record.result_summary = _failure_summary_with_detail(
                    failure_code,
                    str(exc),
                    student_account=student_account,
                )
                _append_log(db, record, len(exc.events) + 1, "error", "failed", record.result_summary, student_account)
                db.commit()
                return
            prepared_content = submit_result.content
            _append_real_submit_events(db, record, student_account, submit_result.events)
        else:
            prepared_content = prepare_log_content(raw_task_config or {}, task_config) if is_log_auto_submit else None
            steps = _log_auto_submit_steps(student_account, prepared_content) if prepared_content is not None else _generic_steps(student_account)
            _run_simulated_steps(db, record, student_account, steps)

        forced = str(task_config.get("force_result") or task_config.get("simulate") or "").upper()
        failure_code: str | None = None
        final_status = "success"
        if service is None or service.deleted_at is not None or service.script_key in {None, "not_integrated"}:
            final_status = "not_integrated"
            failure_code = "SERVICE_NOT_INTEGRATED"
        elif record.script_version and record.script_version != "v0.1.0-mock":
            final_status = "not_integrated"
            failure_code = "SERVICE_NOT_INTEGRATED"
        elif not real_log_submit and ("TIMEOUT" in forced or "timeout" in account_lower):
            final_status = "timeout"
            failure_code = "TIMEOUT"
        elif not real_log_submit and ("AUTH" in forced or "fail" in account_lower):
            final_status = "failed"
            failure_code = "AUTH_FAILED"
        elif not real_log_submit and forced in TERMINAL_FAILURE_SUMMARIES:
            final_status = "failed"
            failure_code = forced
        elif not real_log_submit and forced in {"NOT_INTEGRATED", "SERVICE_NOT_INTEGRATED"}:
            final_status = "not_integrated"
            failure_code = "SERVICE_NOT_INTEGRATED"

        finished = now_utc()
        duration_ms = int((finished - started).total_seconds() * 1000)
        record.status = final_status
        record.failure_code = failure_code
        record.finished_at = finished
        record.duration_ms = duration_ms
        if final_status == "success":
            record.result_summary = (
                "已完成 submit_example 真实提交脚本执行。"
                if real_log_submit
                else "已按 submit_example 模板完成本地干跑验收，未请求真实目标服务器。"
                if is_log_auto_submit
                else "已完成日志自动提交模拟流程。"
            )
            next_sequence = len(steps) + 1
            if real_log_submit:
                next_sequence = (db.scalar(select(ServiceExecutionLog.sequence).where(ServiceExecutionLog.service_request_id == record.service_request_id).order_by(ServiceExecutionLog.sequence.desc()).limit(1)) or 0) + 1
            _append_log(db, record, next_sequence, "info", "done", record.result_summary, student_account)
        else:
            record.result_summary = TERMINAL_FAILURE_SUMMARIES.get(failure_code or "UNKNOWN_ERROR")
            _append_log(db, record, len(steps) + 1, "warn", "failed", record.result_summary or "服务执行失败。", student_account)
        db.commit()
    except Exception as exc:  # noqa: BLE001 - background task needs a final persisted state.
        record = db.scalar(
            select(ServiceRequest).where(ServiceRequest.service_request_id == service_request_public_id)
        )
        if record is not None:
            finished = now_utc()
            record.status = "failed"
            record.failure_code = "SCRIPT_ERROR"
            record.result_summary = "自动提交服务运行异常，请联系管理员。"
            record.finished_at = finished
            record.duration_ms = int((finished - (record.started_at or started)).total_seconds() * 1000)
            _append_log(db, record, 99, "error", "exception", str(exc), student_account)
            db.commit()
    finally:
        # Keep the raw credential lifetime scoped to this call.
        student_account = ""
        student_password = ""
        raw_task_config = {}
        db.close()


def service_request_expiry() -> Any:
    return now_utc() + timedelta(days=180)


def _failure_summary_with_detail(failure_code: str, detail: str, *, student_account: str | None = None) -> str:
    base = TERMINAL_FAILURE_SUMMARIES.get(failure_code, TERMINAL_FAILURE_SUMMARIES["SCRIPT_ERROR"])
    cleaned = sanitize_text((detail or "").strip(), student_account=student_account)
    if not cleaned:
        return base
    if len(cleaned) > 220:
        cleaned = cleaned[:220].rstrip() + "..."
    return f"{base} {cleaned}"


def reconcile_pending_requests_after_startup() -> None:
    db = SessionLocal()
    try:
        records = list(db.scalars(select(ServiceRequest).where(ServiceRequest.status.in_(["pending", "running"]))).all())
        if not records:
            return
        finished = now_utc()
        for record in records:
            record.status = "failed"
            record.failure_code = "VALIDATION_ERROR"
            record.finished_at = finished
            record.duration_ms = int((finished - (record.started_at or record.created_at)).total_seconds() * 1000)
            record.result_summary = "服务重启后当次执行凭证已失效，请重新提交。"
            next_sequence = (db.scalar(select(ServiceExecutionLog.sequence).where(ServiceExecutionLog.service_request_id == record.service_request_id).order_by(ServiceExecutionLog.sequence.desc()).limit(1)) or 0) + 1
            _append_log(db, record, next_sequence, "error", "startup", record.result_summary, None)
        db.commit()
    finally:
        db.close()
