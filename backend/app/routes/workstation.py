from __future__ import annotations

import json
from datetime import datetime, time

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import write_audit
from ..config import settings
from ..core import ApiError, created, make_response, mask_account, now_utc, paginated, paginate_query, prefixed_id, request_meta, sanitize_payload, secure_hash, service_request_id
from ..database import get_db
from ..deps import require_invited_or_admin
from ..models import ServiceRequest, User, WorkstationService
from ..runner import enqueue_service_credentials, run_queued_service_request, service_request_expiry
from ..schemas import ServiceRequestCreateBody, ServiceRetryBody
from ..serializers import request_public, service_public

router = APIRouter(prefix="/workstation", tags=["workstation"])
LOG_AUTO_SUBMIT_SCRIPT_KEY = "log_auto_submit"
LOG_TEXT_FIELDS = {"sxrz_text", "station_activity_text"}
LOG_BOOLEAN_FIELDS = {"display_name"}
LOG_NUMBER_FIELDS = {"pacing_total_sec", "request_spacing_sec"}
LOG_DATE_FIELDS = {"target_date", "log_date"}
RESERVED_DOSAVE_FIELDS = frozenset(
    {
        "XNXQ",
        "XSXM",
        "XSXH",
        "XSDB",
        "BX",
        "SXLXMC",
        "XYD_NAME",
        "XYD_COED",
        "SXLX",
        "BGRQ",
        "SXXSDT",
        "QKSM",
        "SFZYXG",
        "SFYC",
        "SXRZ",
        "FJ",
        "JB",
        "TJZT",
        "SXJXRW_ID",
        "SY_AUDFLAG",
        "ID",
        "SY_PIID",
        "XY_ID",
        "SY_PDID",
        "SY_STARTEDUSER",
        "SY_STARTEDUSERNAME",
        "SY_APPROVEDUSERS",
        "SY_APPROVEDUSERNAMES",
        "SY_LASTFLOWINFO",
        "SY_PREAPPROVUSERS",
        "SY_PREAPPROVUSERNAMES",
        "SY_LASTFLOWUSER",
        "OPERATERCODE",
        "SY_LASTFLOWUSERID",
        "OPERATETIME",
        "SY_WFWARN",
        "DELFLAG",
        "SY_WARNFLAG",
        "SY_CURRENTTASK",
        "SY_ACKFLAG",
        "SY_ACKUSERNAME",
        "SY_ACKUSERID",
        "SY_ACKTIME",
        "SY_CREATEUSERID",
        "SY_CREATEUSER",
        "SY_CREATEUSERNAME",
        "TABLECODE",
        "CODEGENFIELDINFO",
        "__ISFUNC__",
        "__APPID__",
        "__FUNCCODE__",
    }
)


def _parse_day_start(value: str):
    return datetime.combine(datetime.fromisoformat(value[:10]).date(), time.min)


def _parse_day_end(value: str):
    return datetime.combine(datetime.fromisoformat(value[:10]).date(), time.max)


def _service_available_to_users(service: WorkstationService) -> bool:
    if service.status != "enabled" or service.deleted_at is not None:
        return False
    if settings.inline_worker_enabled:
        return True
    return service.script_key not in {"log_auto_submit", "not_integrated"} and service.script_version != "v0.1.0-mock"


def _collect_reserved_task_config_fields(value: object) -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            field_name = str(key)
            if field_name.upper() in RESERVED_DOSAVE_FIELDS:
                found.append(field_name)
            found.extend(_collect_reserved_task_config_fields(item))
    elif isinstance(value, list):
        for item in value:
            found.extend(_collect_reserved_task_config_fields(item))
    return found


def _reject_reserved_dosave_fields(service: WorkstationService, task_config: dict) -> None:
    if service.script_key != LOG_AUTO_SUBMIT_SCRIPT_KEY:
        return
    reserved_fields = sorted(set(_collect_reserved_task_config_fields(task_config)), key=str.upper)
    if not reserved_fields:
        return
    preview = "、".join(reserved_fields[:8])
    if len(reserved_fields) > 8:
        preview += f" 等 {len(reserved_fields)} 个字段"
    raise ApiError("BAD_REQUEST", f"task_config 包含后端保留字段，不能由前端提交：{preview}。")


def _sanitize_task_config_for_service(service: WorkstationService, task_config: dict) -> dict:
    sanitized = sanitize_payload(task_config)
    if service.script_key != LOG_AUTO_SUBMIT_SCRIPT_KEY or not isinstance(sanitized, dict):
        return sanitized

    safe: dict[str, object] = {}
    for key in LOG_DATE_FIELDS:
        value = sanitized.get(key)
        if value:
            safe[key] = str(value)[:10]
    if "log_dates" in sanitized and isinstance(sanitized["log_dates"], list):
        safe["log_dates"] = [str(item)[:10] for item in sanitized["log_dates"][:31] if str(item).strip()]
    for key in LOG_BOOLEAN_FIELDS:
        value = sanitized.get(key)
        if value:
            safe[f"{key}_provided"] = True
    for key in LOG_TEXT_FIELDS:
        value = sanitized.get(key)
        if isinstance(value, str) and value.strip():
            safe[f"{key}_chars"] = len(value.strip())
    for key in LOG_NUMBER_FIELDS:
        value = sanitized.get(key)
        if value not in {None, ""}:
            try:
                safe[key] = max(float(value), 0.0)
            except (TypeError, ValueError):
                safe[key] = "invalid"
    for key in ("force_result", "simulate"):
        if key in sanitized:
            safe[key] = sanitized[key]
    return safe


@router.get("/services")
def list_services(
    request: Request,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(require_invited_or_admin),
):
    statement = (
        select(WorkstationService)
        .where(
            WorkstationService.id == "service_log_auto_submit",
            WorkstationService.status == "enabled",
            WorkstationService.deleted_at.is_(None),
        )
        .order_by(WorkstationService.updated_at.desc())
    )
    items, total = paginate_query(db, statement, page, page_size)
    items = [item for item in items if _service_available_to_users(item)]
    return make_response(paginated([service_public(item) for item in items], total, page, page_size), request=request)


@router.get("/services/{service_id}")
def service_detail(service_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(require_invited_or_admin)):
    service = db.get(WorkstationService, service_id)
    if service is None or service.deleted_at is not None or (user.role != "admin" and not _service_available_to_users(service)):
        raise ApiError("NOT_FOUND", "服务不存在。")
    return make_response(service_public(service, detail=True), request=request)


@router.post("/services/{service_id}/requests")
def create_service_request(
    service_id: str,
    body: ServiceRequestCreateBody,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_invited_or_admin),
):
    service = db.get(WorkstationService, service_id)
    if service is None or not _service_available_to_users(service):
        raise ApiError("NOT_FOUND", "服务不存在或未启用。")
    public_id = service_request_id()
    ip_hash, ua = request_meta(request)
    _reject_reserved_dosave_fields(service, body.task_config)
    sanitized_config = _sanitize_task_config_for_service(service, body.task_config)
    record = ServiceRequest(
        id=prefixed_id("svc_record"),
        service_request_id=public_id,
        service_id=service.id,
        service_name_snapshot=service.name,
        lumitime_user_id=user.id,
        status="pending",
        student_account_hash=secure_hash(body.student_account),
        student_account_masked=mask_account(body.student_account),
        task_config_sanitized_json=json.dumps(sanitized_config, ensure_ascii=False),
        script_version=service.script_version,
        source_ip_hash=ip_hash,
        user_agent_summary=ua,
        expires_at=service_request_expiry(),
    )
    db.add(record)
    if not settings.inline_worker_enabled:
        finished = now_utc()
        record.status = "not_integrated"
        record.failure_code = "SERVICE_NOT_INTEGRATED"
        record.result_summary = "本地内联执行器未启用，服务暂未接入真实脚本。"
        record.finished_at = finished
        record.duration_ms = 0
    write_audit(
        db,
        request=request,
        actor=user,
        action="create_service_request",
        resource_type="service_request",
        resource_id=public_id,
        service_request_id=public_id,
        metadata={
            "service_id": service.id,
            "student_account_hash": secure_hash(body.student_account),
            "task_config": sanitized_config,
        },
    )
    db.commit()
    if settings.inline_worker_enabled:
        enqueue_service_credentials(public_id, body.student_account, body.student_password, body.task_config)
        background_tasks.add_task(run_queued_service_request, public_id)
    return created(
        {
            "service_request_id": public_id,
            "status": record.status,
            "polling_url": f"/api/v1/workstation/service-requests/{public_id}",
        },
        message="服务请求已创建。",
        request=request,
    )


@router.get("/service-requests/my")
def my_service_requests(
    request: Request,
    service_id: str | None = None,
    status: str | None = None,
    service_request_id: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(require_invited_or_admin),
):
    statement = select(ServiceRequest).where(ServiceRequest.lumitime_user_id == user.id)
    if service_id:
        statement = statement.where(ServiceRequest.service_id == service_id)
    if status:
        statement = statement.where(ServiceRequest.status == status)
    if service_request_id:
        statement = statement.where(ServiceRequest.service_request_id.contains(service_request_id))
    if start_date:
        statement = statement.where(ServiceRequest.created_at >= _parse_day_start(start_date))
    if end_date:
        statement = statement.where(ServiceRequest.created_at <= _parse_day_end(end_date))
    statement = statement.order_by(ServiceRequest.created_at.desc())
    items, total = paginate_query(db, statement, page, page_size)
    return make_response(paginated([request_public(item) for item in items], total, page, page_size), request=request)


@router.get("/service-requests/{service_request_public_id}")
def service_request_detail(service_request_public_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(require_invited_or_admin)):
    record = db.scalar(select(ServiceRequest).where(ServiceRequest.service_request_id == service_request_public_id))
    if record is None:
        raise ApiError("NOT_FOUND", "服务请求不存在。")
    if user.role != "admin" and record.lumitime_user_id != user.id:
        raise ApiError("FORBIDDEN", "无权限查看该服务请求。")
    write_audit(
        db,
        request=request,
        actor=user,
        action="view_service_request",
        resource_type="service_request",
        resource_id=record.service_request_id,
        service_request_id=record.service_request_id,
    )
    db.commit()
    return make_response(request_public(record), request=request)


@router.post("/service-requests/{service_request_public_id}/retry")
def retry_service_request(
    service_request_public_id: str,
    body: ServiceRetryBody,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_invited_or_admin),
):
    old = db.scalar(select(ServiceRequest).where(ServiceRequest.service_request_id == service_request_public_id))
    if old is None:
        raise ApiError("NOT_FOUND", "服务请求不存在。")
    if user.role != "admin" and old.lumitime_user_id != user.id:
        raise ApiError("FORBIDDEN", "无权限重试该服务请求。")
    if old.status not in {"failed", "timeout", "not_integrated"}:
        raise ApiError("BAD_REQUEST", "当前记录不可重试。")

    service = db.get(WorkstationService, old.service_id)
    if service is None or not _service_available_to_users(service):
        raise ApiError("BAD_REQUEST", "原服务不可用。")

    public_id = service_request_id()
    ip_hash, ua = request_meta(request)
    task_config = body.task_config if body.task_config is not None else json.loads(old.task_config_sanitized_json or "{}")
    _reject_reserved_dosave_fields(service, task_config)
    sanitized_config = _sanitize_task_config_for_service(service, task_config)
    record = ServiceRequest(
        id=prefixed_id("svc_record"),
        service_request_id=public_id,
        service_id=service.id,
        service_name_snapshot=service.name,
        lumitime_user_id=old.lumitime_user_id,
        status="pending",
        student_account_hash=secure_hash(body.student_account),
        student_account_masked=mask_account(body.student_account),
        task_config_sanitized_json=json.dumps(sanitized_config, ensure_ascii=False),
        retry_of_service_request_id=old.service_request_id,
        script_version=service.script_version,
        source_ip_hash=ip_hash,
        user_agent_summary=ua,
        expires_at=service_request_expiry(),
    )
    db.add(record)
    if not settings.inline_worker_enabled:
        finished = now_utc()
        record.status = "not_integrated"
        record.failure_code = "SERVICE_NOT_INTEGRATED"
        record.result_summary = "本地内联执行器未启用，服务暂未接入真实脚本。"
        record.finished_at = finished
        record.duration_ms = 0
    write_audit(
        db,
        request=request,
        actor=user,
        action="retry_service_request",
        resource_type="service_request",
        resource_id=public_id,
        service_request_id=public_id,
        metadata={"retry_of": old.service_request_id, "student_account_hash": secure_hash(body.student_account)},
    )
    db.commit()
    if settings.inline_worker_enabled:
        enqueue_service_credentials(public_id, body.student_account, body.student_password, task_config)
        background_tasks.add_task(run_queued_service_request, public_id)
    return created(
        {
            "service_request_id": public_id,
            "retry_of_service_request_id": old.service_request_id,
            "status": record.status,
            "polling_url": f"/api/v1/workstation/service-requests/{public_id}",
        },
        message="重试请求已创建。",
        request=request,
    )

