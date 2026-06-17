from __future__ import annotations

import json
import time
from datetime import timedelta
from threading import Lock
from time import monotonic
from typing import Any

from sqlalchemy import select

from .core import mask_account, now_utc, prefixed_id, sanitize_text
from .database import SessionLocal
from .models import ServiceExecutionLog, ServiceRequest, WorkstationService


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

CREDENTIAL_TTL_SECONDS = 300.0
_CREDENTIALS: dict[str, tuple[str, str, float]] = {}
_CREDENTIAL_LOCK = Lock()


def enqueue_service_credentials(service_request_public_id: str, student_account: str, student_password: str) -> None:
    expires_at = monotonic() + CREDENTIAL_TTL_SECONDS
    with _CREDENTIAL_LOCK:
        _CREDENTIALS[service_request_public_id] = (student_account, student_password, expires_at)


def _pop_service_credentials(service_request_public_id: str) -> tuple[str, str] | None:
    with _CREDENTIAL_LOCK:
        credentials = _CREDENTIALS.pop(service_request_public_id, None)
    if credentials is None:
        return None
    student_account, student_password, expires_at = credentials
    if monotonic() > expires_at:
        student_account = ""
        student_password = ""
        return None
    return student_account, student_password


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
    student_account, student_password = credentials
    try:
        _run_service_request_with_credentials(service_request_public_id, student_account, student_password)
    finally:
        student_account = ""
        student_password = ""


def run_service_request(service_request_public_id: str, student_account: str, student_password: str) -> None:
    enqueue_service_credentials(service_request_public_id, student_account, student_password)
    run_queued_service_request(service_request_public_id)


def _run_service_request_with_credentials(service_request_public_id: str, student_account: str, student_password: str) -> None:
    """Run a simulated workstation request.

    Credentials are passed in memory by FastAPI background tasks and are never saved.
    The function deliberately avoids logging the raw password.
    """
    del student_password
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

        steps: list[tuple[str, str]] = [
            ("validate", f"开始校验服务输入，账号={mask_account(student_account)}"),
            ("login", f"开始登录学生学习 App，账号={student_account}，password=[REDACTED_PASSWORD]"),
            ("prepare", "准备学习日志提交参数。"),
            ("submit", "提交学习日志。"),
        ]

        for idx, (step, message) in enumerate(steps, start=1):
            _append_log(db, record, idx, "info", step, message, student_account)
            db.commit()
            time.sleep(0.08)

        forced = str(task_config.get("force_result") or task_config.get("simulate") or "").upper()
        failure_code: str | None = None
        final_status = "success"
        if service is None or service.deleted_at is not None or service.script_key in {None, "not_integrated"}:
            final_status = "not_integrated"
            failure_code = "SERVICE_NOT_INTEGRATED"
        elif record.script_version and record.script_version != "v0.1.0-mock":
            final_status = "not_integrated"
            failure_code = "SERVICE_NOT_INTEGRATED"
        elif "TIMEOUT" in forced or "timeout" in account_lower:
            final_status = "timeout"
            failure_code = "TIMEOUT"
        elif "AUTH" in forced or "fail" in account_lower:
            final_status = "failed"
            failure_code = "AUTH_FAILED"
        elif forced in TERMINAL_FAILURE_SUMMARIES:
            final_status = "failed"
            failure_code = forced
        elif forced in {"NOT_INTEGRATED", "SERVICE_NOT_INTEGRATED"}:
            final_status = "not_integrated"
            failure_code = "SERVICE_NOT_INTEGRATED"

        finished = now_utc()
        duration_ms = int((finished - started).total_seconds() * 1000)
        record.status = final_status
        record.failure_code = failure_code
        record.finished_at = finished
        record.duration_ms = duration_ms
        if final_status == "success":
            record.result_summary = "已完成日志自动提交模拟流程。"
            _append_log(db, record, len(steps) + 1, "info", "done", "服务执行成功。", student_account)
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
        db.close()


def service_request_expiry() -> Any:
    return now_utc() + timedelta(days=180)


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
