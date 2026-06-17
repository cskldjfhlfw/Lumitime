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


@router.get("/services")
def list_services(request: Request, db: Session = Depends(get_db), user: User = Depends(require_invited_or_admin)):
    services = list(
        db.scalars(
            select(WorkstationService).where(
                WorkstationService.status == "enabled",
                WorkstationService.deleted_at.is_(None),
            ).order_by(WorkstationService.updated_at.desc())
        ).all()
    )
    services = [service for service in services if _service_available_to_users(service)]
    return make_response({"items": [service_public(service) for service in services]}, request=request)


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
    sanitized_config = sanitize_payload(body.task_config)
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
            "task_config": body.task_config,
        },
    )
    db.commit()
    if settings.inline_worker_enabled:
        enqueue_service_credentials(public_id, body.student_account, body.student_password)
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
    record = ServiceRequest(
        id=prefixed_id("svc_record"),
        service_request_id=public_id,
        service_id=service.id,
        service_name_snapshot=service.name,
        lumitime_user_id=old.lumitime_user_id,
        status="pending",
        student_account_hash=secure_hash(body.student_account),
        student_account_masked=mask_account(body.student_account),
        task_config_sanitized_json=json.dumps(sanitize_payload(task_config), ensure_ascii=False),
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
        enqueue_service_credentials(public_id, body.student_account, body.student_password)
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

