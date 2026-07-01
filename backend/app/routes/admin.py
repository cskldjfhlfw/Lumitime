from __future__ import annotations

import json
from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import write_audit
from ..config import settings
from ..core import (
    ApiError,
    created,
    csv_response,
    generate_invite_code,
    hash_password,
    json_list,
    make_response,
    now_utc,
    paginated,
    paginate_query,
    prefixed_id,
)
from ..database import get_db
from ..deps import delete_user_sessions, require_admin
from ..metrics import current_dashboard_totals
from ..models import (
    AuditLog,
    ContentAttachment,
    ContentItem,
    DailyMetricSnapshot,
    InviteCode,
    InviteCodeUsage,
    Message,
    ServiceExecutionLog,
    ServiceRequest,
    User,
    WorkstationService,
)
from ..schemas import (
    AttachmentPatchBody,
    ContentCreateBody,
    ContentPatchBody,
    CreateInviteBody,
    ResetPasswordBody,
    ServiceCreateBody,
    ServicePatchBody,
)
from ..serializers import (
    audit_public,
    content_public,
    invite_public,
    invite_usage_public,
    log_public,
    message_public,
    request_public,
    service_public,
    snapshot_public,
    user_public,
)
from ..storage import store_attachment_bytes

router = APIRouter(prefix="/admin", tags=["admin"])
UPLOAD_CHUNK_SIZE = 1024 * 1024


def _read_upload_with_limit(file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = file.file.read(UPLOAD_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > settings.max_upload_bytes:
            raise ApiError("PAYLOAD_TOO_LARGE", "附件大小超过上传限制。")
        chunks.append(chunk)
    if total == 0:
        raise ApiError("BAD_REQUEST", "附件不能为空。")
    return b"".join(chunks)


@router.post("/invite-codes")
def create_invite(body: CreateInviteBody, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    code = generate_invite_code()
    while db.scalar(select(InviteCode).where(InviteCode.code == code)):
        code = generate_invite_code()
    invite = InviteCode(
        id=prefixed_id("invite"),
        code=code,
        usage_limit=body.usage_limit,
        used_count=0,
        status="active",
        expires_at=body.expires_at,
        remark=body.remark,
        created_by=admin.id,
    )
    db.add(invite)
    write_audit(db, request=request, actor=admin, action="create_invite_code", resource_type="invite_code", resource_id=invite.id)
    db.commit()
    return created(invite_public(invite), message="邀请码已创建。", request=request)


@router.get("/invite-codes")
def list_invites(request: Request, status: str | None = None, keyword: str | None = None, page: int = 1, page_size: int = 20, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    statement = select(InviteCode).order_by(InviteCode.created_at.desc())
    if status:
        statement = statement.where(InviteCode.status == status)
    if keyword:
        statement = statement.where(InviteCode.code.contains(keyword))
    items, total = paginate_query(db, statement, page, page_size)
    return make_response(paginated([invite_public(item) for item in items], total, page, page_size), request=request)


@router.patch("/invite-codes/{invite_code_id}/disable")
def disable_invite(invite_code_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    invite = db.get(InviteCode, invite_code_id)
    if invite is None:
        raise ApiError("NOT_FOUND", "邀请码不存在。")
    invite.status = "disabled"
    write_audit(db, request=request, actor=admin, action="disable_invite_code", resource_type="invite_code", resource_id=invite.id)
    db.commit()
    return make_response(invite_public(invite), message="邀请码已禁用。", request=request)


@router.get("/invite-codes/{invite_code_id}/usage-records")
def invite_usage(invite_code_id: str, request: Request, page: int = 1, page_size: int = 20, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if db.get(InviteCode, invite_code_id) is None:
        raise ApiError("NOT_FOUND", "邀请码不存在。")
    statement = select(InviteCodeUsage).where(InviteCodeUsage.invite_code_id == invite_code_id).order_by(InviteCodeUsage.used_at.desc())
    items, total = paginate_query(db, statement, page, page_size)
    return make_response(paginated([invite_usage_public(item) for item in items], total, page, page_size), request=request)


@router.get("/contents")
def list_admin_contents(
    request: Request,
    type: str | None = None,  # noqa: A002 - API field name.
    status: str | None = None,
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    statement = select(ContentItem).where(ContentItem.deleted_at.is_(None)).order_by(ContentItem.updated_at.desc())
    if type:
        statement = statement.where(ContentItem.type == type)
    if status:
        statement = statement.where(ContentItem.status == status)
    if keyword:
        statement = statement.where(ContentItem.title.contains(keyword))
    items, total = paginate_query(db, statement, page, page_size)
    return make_response(paginated([content_public(item, admin=True) for item in items], total, page, page_size), request=request)


@router.get("/contents/{content_id}")
def admin_content_detail(content_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    item = db.get(ContentItem, content_id)
    if item is None or item.deleted_at is not None:
        raise ApiError("NOT_FOUND", "内容不存在。")
    return make_response(content_public(item, detail=True, admin=True), request=request)


@router.get("/users")
def list_users(request: Request, status: str | None = None, role: str | None = None, keyword: str | None = None, page: int = 1, page_size: int = 20, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    statement = select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.desc())
    if status:
        statement = statement.where(User.status == status)
    if role:
        statement = statement.where(User.role == role)
    if keyword:
        statement = statement.where(User.username.contains(keyword))
    items, total = paginate_query(db, statement, page, page_size)
    return make_response(paginated([user_public(item) for item in items], total, page, page_size), request=request)


@router.patch("/users/{user_id}/disable")
def disable_user(user_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if user is None:
        raise ApiError("NOT_FOUND", "用户不存在。")
    if user.role == "admin":
        raise ApiError("BAD_REQUEST", "不能禁用管理员账号。")
    user.status = "disabled"
    write_audit(db, request=request, actor=admin, action="disable_user", resource_type="user", resource_id=user.id)
    db.commit()
    return make_response(user_public(user), message="用户已禁用。", request=request)


@router.patch("/users/{user_id}/enable")
def enable_user(user_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if user is None:
        raise ApiError("NOT_FOUND", "用户不存在。")
    user.status = "active"
    write_audit(db, request=request, actor=admin, action="enable_user", resource_type="user", resource_id=user.id)
    db.commit()
    return make_response(user_public(user), message="用户已启用。", request=request)


@router.patch("/users/{user_id}/reset-password")
def reset_password(user_id: str, body: ResetPasswordBody, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if user is None:
        raise ApiError("NOT_FOUND", "用户不存在。")
    user.password_hash = hash_password(body.new_password)
    delete_user_sessions(db, user.id)
    write_audit(db, request=request, actor=admin, action="reset_user_password", resource_type="user", resource_id=user.id)
    db.commit()
    return make_response(None, message="密码已重置。", request=request)


@router.post("/contents")
def create_content(body: ContentCreateBody, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if body.type == "script" and not body.code:
        raise ApiError("BAD_REQUEST", "脚本内容必须填写 code。")
    item = ContentItem(
        id=prefixed_id("content"),
        type=body.type,
        title=body.title,
        summary=body.summary,
        body=body.body,
        code=body.code,
        language=body.language,
        category=body.category,
        tags_json=json_list(body.tags),
        status=body.status,
        visibility=body.visibility,
        allow_copy=1 if body.allow_copy else 0,
        created_by=admin.id,
        published_at=now_utc() if body.status == "published" else None,
    )
    db.add(item)
    write_audit(db, request=request, actor=admin, action="create_content", resource_type="content", resource_id=item.id)
    db.commit()
    return created(content_public(item, detail=True, admin=True), message="内容已创建。", request=request)


@router.patch("/contents/{content_id}")
def patch_content(content_id: str, body: ContentPatchBody, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    item = db.get(ContentItem, content_id)
    if item is None or item.deleted_at is not None:
        raise ApiError("NOT_FOUND", "内容不存在。")
    data = body.model_dump(exclude_unset=True)
    tags = data.pop("tags", None)
    for key, value in data.items():
        if key == "allow_copy":
            setattr(item, key, 1 if value else 0)
        else:
            setattr(item, key, value)
    if tags is not None:
        item.tags_json = json_list(tags)
    if item.status == "published" and item.published_at is None:
        item.published_at = now_utc()
    write_audit(db, request=request, actor=admin, action="patch_content", resource_type="content", resource_id=item.id, metadata=data)
    db.commit()
    return make_response(content_public(item, detail=True, admin=True), message="内容已更新。", request=request)


@router.patch("/contents/{content_id}/publish")
def publish_content(content_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    item = db.get(ContentItem, content_id)
    if item is None or item.deleted_at is not None:
        raise ApiError("NOT_FOUND", "内容不存在。")
    item.status = "published"
    item.published_at = item.published_at or now_utc()
    write_audit(db, request=request, actor=admin, action="publish_content", resource_type="content", resource_id=item.id)
    db.commit()
    return make_response(content_public(item, detail=True, admin=True), message="内容已发布。", request=request)


@router.patch("/contents/{content_id}/unpublish")
def unpublish_content(content_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    item = db.get(ContentItem, content_id)
    if item is None or item.deleted_at is not None:
        raise ApiError("NOT_FOUND", "内容不存在。")
    item.status = "unpublished"
    write_audit(db, request=request, actor=admin, action="unpublish_content", resource_type="content", resource_id=item.id)
    db.commit()
    return make_response(content_public(item, detail=True, admin=True), message="内容已下架。", request=request)


@router.delete("/contents/{content_id}")
def delete_content(content_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    item = db.get(ContentItem, content_id)
    if item is None or item.deleted_at is not None:
        raise ApiError("NOT_FOUND", "内容不存在。")
    item.deleted_at = now_utc()
    write_audit(db, request=request, actor=admin, action="delete_content", resource_type="content", resource_id=item.id)
    db.commit()
    return make_response(None, message="内容已删除。", request=request)


@router.post("/works/{work_id}/attachments")
def upload_attachment(
    work_id: str,
    request: Request,
    filename: str | None = None,
    allow_download: bool = False,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    work = db.get(ContentItem, work_id)
    if work is None or work.type != "work" or work.deleted_at is not None:
        raise ApiError("NOT_FOUND", "作品不存在。")
    content = _read_upload_with_limit(file)
    attachment_id = prefixed_id("att")
    attachment_filename = filename or file.filename or "attachment.bin"
    storage_key, stored_filename, file_size, checksum = store_attachment_bytes(attachment_id, attachment_filename, content)
    attachment = ContentAttachment(
        id=attachment_id,
        content_id=work.id,
        filename=stored_filename,
        file_type=file.content_type,
        file_size=file_size,
        storage_key=storage_key,
        checksum=checksum,
        allow_download=1 if allow_download else 0,
        uploaded_by=admin.id,
    )
    db.add(attachment)
    write_audit(db, request=request, actor=admin, action="upload_attachment", resource_type="content_attachment", resource_id=attachment.id)
    db.commit()
    return created({"id": attachment.id, "filename": attachment.filename, "file_size": attachment.file_size, "checksum": attachment.checksum, "allow_download": bool(attachment.allow_download)}, message="附件已上传。", request=request)


@router.patch("/works/{work_id}/attachments/{attachment_id}")
def patch_attachment(work_id: str, attachment_id: str, body: AttachmentPatchBody, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    attachment = db.scalar(select(ContentAttachment).where(ContentAttachment.id == attachment_id, ContentAttachment.content_id == work_id, ContentAttachment.deleted_at.is_(None)))
    if attachment is None:
        raise ApiError("NOT_FOUND", "附件不存在。")
    attachment.allow_download = 1 if body.allow_download else 0
    write_audit(db, request=request, actor=admin, action="patch_attachment", resource_type="content_attachment", resource_id=attachment.id)
    db.commit()
    return make_response({"id": attachment.id, "allow_download": bool(attachment.allow_download)}, message="附件权限已更新。", request=request)


@router.patch("/messages/{message_id}/hide")
def hide_message(message_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    message = db.get(Message, message_id)
    if message is None or message.deleted_at is not None:
        raise ApiError("NOT_FOUND", "留言不存在。")
    message.status = "hidden"
    message.moderated_by = admin.id
    message.moderated_at = now_utc()
    write_audit(db, request=request, actor=admin, action="hide_message", resource_type="message", resource_id=message.id)
    db.commit()
    return make_response(message_public(message, admin=True), message="留言已隐藏。", request=request)


@router.patch("/messages/{message_id}/restore")
def restore_message(message_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    message = db.get(Message, message_id)
    if message is None or message.deleted_at is not None:
        raise ApiError("NOT_FOUND", "留言不存在。")
    message.status = "visible"
    message.moderated_by = admin.id
    message.moderated_at = now_utc()
    write_audit(db, request=request, actor=admin, action="restore_message", resource_type="message", resource_id=message.id)
    db.commit()
    return make_response(message_public(message, admin=True), message="留言已恢复。", request=request)


@router.delete("/messages/{message_id}")
def delete_message(message_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    message = db.get(Message, message_id)
    if message is None or message.deleted_at is not None:
        raise ApiError("NOT_FOUND", "留言不存在。")
    message.status = "deleted"
    message.deleted_at = now_utc()
    message.moderated_by = admin.id
    message.moderated_at = now_utc()
    write_audit(db, request=request, actor=admin, action="delete_message", resource_type="message", resource_id=message.id)
    db.commit()
    return make_response(None, message="留言已删除。", request=request)


@router.get("/messages")
def list_admin_messages(
    request: Request,
    status: str | None = None,
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    statement = select(Message).where(Message.deleted_at.is_(None)).order_by(Message.created_at.desc())
    if status:
        statement = statement.where(Message.status == status)
    if keyword:
        statement = statement.where(Message.content.contains(keyword) | Message.nickname.contains(keyword))
    items, total = paginate_query(db, statement, page, page_size)
    return make_response(paginated([message_public(item, admin=True) for item in items], total, page, page_size), request=request)


@router.get("/workstation/services")
def list_admin_services(
    request: Request,
    status: str | None = None,
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    statement = select(WorkstationService).where(WorkstationService.deleted_at.is_(None)).order_by(WorkstationService.updated_at.desc())
    if status:
        statement = statement.where(WorkstationService.status == status)
    if keyword:
        statement = statement.where(WorkstationService.name.contains(keyword))
    items, total = paginate_query(db, statement, page, page_size)
    return make_response(paginated([service_public(item, detail=True, frontend_status=False) for item in items], total, page, page_size), request=request)


@router.get("/workstation/services/{service_id}")
def admin_service_detail(service_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    service = db.get(WorkstationService, service_id)
    if service is None or service.deleted_at is not None:
        raise ApiError("NOT_FOUND", "服务不存在。")
    return make_response(service_public(service, detail=True, frontend_status=False), request=request)


@router.post("/workstation/services")
def create_service(body: ServiceCreateBody, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    service = WorkstationService(
        id=prefixed_id("service"),
        name=body.name,
        summary=body.summary,
        description=body.description,
        status=body.status,
        script_key=body.script_key,
        script_version=body.script_version,
        input_schema_json=json.dumps(body.input_schema, ensure_ascii=False),
        created_by=admin.id,
    )
    db.add(service)
    write_audit(db, request=request, actor=admin, action="create_workstation_service", resource_type="workstation_service", resource_id=service.id)
    db.commit()
    return created(service_public(service, detail=True), message="服务已创建。", request=request)


@router.patch("/workstation/services/{service_id}")
def patch_service(service_id: str, body: ServicePatchBody, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    service = db.get(WorkstationService, service_id)
    if service is None or service.deleted_at is not None:
        raise ApiError("NOT_FOUND", "服务不存在。")
    data = body.model_dump(exclude_unset=True)
    input_schema = data.pop("input_schema", None)
    for key, value in data.items():
        setattr(service, key, value)
    if input_schema is not None:
        service.input_schema_json = json.dumps(input_schema, ensure_ascii=False)
    write_audit(db, request=request, actor=admin, action="patch_workstation_service", resource_type="workstation_service", resource_id=service.id, metadata=data)
    db.commit()
    return make_response(service_public(service, detail=True), message="服务已更新。", request=request)


@router.patch("/workstation/services/{service_id}/enable")
def enable_service(service_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    service = db.get(WorkstationService, service_id)
    if service is None or service.deleted_at is not None:
        raise ApiError("NOT_FOUND", "服务不存在。")
    service.status = "enabled"
    write_audit(db, request=request, actor=admin, action="enable_workstation_service", resource_type="workstation_service", resource_id=service.id)
    db.commit()
    return make_response(service_public(service, detail=True), message="服务已启用。", request=request)


@router.patch("/workstation/services/{service_id}/disable")
def disable_service(service_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    service = db.get(WorkstationService, service_id)
    if service is None or service.deleted_at is not None:
        raise ApiError("NOT_FOUND", "服务不存在。")
    service.status = "disabled"
    write_audit(db, request=request, actor=admin, action="disable_workstation_service", resource_type="workstation_service", resource_id=service.id)
    db.commit()
    return make_response(service_public(service, detail=True), message="服务已停用。", request=request)


@router.delete("/workstation/services/{service_id}")
def delete_service(service_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    service = db.get(WorkstationService, service_id)
    if service is None or service.deleted_at is not None:
        raise ApiError("NOT_FOUND", "服务不存在。")
    service.deleted_at = now_utc()
    write_audit(db, request=request, actor=admin, action="delete_workstation_service", resource_type="workstation_service", resource_id=service.id)
    db.commit()
    return make_response(None, message="服务已删除。", request=request)


def _parse_day_start(value: str):
    return datetime.combine(datetime.fromisoformat(value[:10]).date(), time.min)


def _parse_day_end(value: str):
    return datetime.combine(datetime.fromisoformat(value[:10]).date(), time.max)


@router.get("/service-requests")
def list_service_requests(request: Request, service_id: str | None = None, user_id: str | None = None, status: str | None = None, failure_code: str | None = None, service_request_id: str | None = None, start_date: str | None = None, end_date: str | None = None, page: int = 1, page_size: int = 20, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    statement = select(ServiceRequest).order_by(ServiceRequest.created_at.desc())
    if service_id:
        statement = statement.where(ServiceRequest.service_id == service_id)
    if user_id:
        statement = statement.where(ServiceRequest.lumitime_user_id == user_id)
    if status:
        statement = statement.where(ServiceRequest.status == status)
    if failure_code:
        statement = statement.where(ServiceRequest.failure_code == failure_code)
    if service_request_id:
        statement = statement.where(ServiceRequest.service_request_id.contains(service_request_id))
    if start_date:
        statement = statement.where(ServiceRequest.created_at >= _parse_day_start(start_date))
    if end_date:
        statement = statement.where(ServiceRequest.created_at <= _parse_day_end(end_date))
    items, total = paginate_query(db, statement, page, page_size)
    return make_response(paginated([request_public(item) for item in items], total, page, page_size), request=request)


@router.get("/service-requests/{service_request_public_id}")
def admin_service_request_detail(service_request_public_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    record = db.scalar(select(ServiceRequest).where(ServiceRequest.service_request_id == service_request_public_id))
    if record is None:
        raise ApiError("NOT_FOUND", "服务请求不存在。")
    return make_response(request_public(record), request=request)


@router.get("/service-requests/{service_request_public_id}/logs")
def admin_service_request_logs(service_request_public_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    record = db.scalar(select(ServiceRequest).where(ServiceRequest.service_request_id == service_request_public_id))
    if record is None:
        raise ApiError("NOT_FOUND", "服务请求不存在。")
    logs = list(db.scalars(select(ServiceExecutionLog).where(ServiceExecutionLog.service_request_id == service_request_public_id).order_by(ServiceExecutionLog.sequence)).all())
    write_audit(db, request=request, actor=admin, action="view_service_logs", resource_type="service_request", resource_id=service_request_public_id, service_request_id=service_request_public_id)
    db.commit()
    return make_response({"service_request_id": service_request_public_id, "logs": [log_public(log) for log in logs]}, request=request)


@router.get("/dashboard/snapshots")
def list_snapshots(request: Request, page: int = 1, page_size: int = 30, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    statement = select(DailyMetricSnapshot).order_by(DailyMetricSnapshot.snapshot_date.desc())
    items, total = paginate_query(db, statement, page, page_size)
    today = now_utc().date().isoformat()
    if page == 1 and not any(item.snapshot_date == today for item in items):
        current = current_dashboard_totals(db)
        items = list(items)
        items.insert(0, DailyMetricSnapshot(id=f"snapshot_{today}", snapshot_date=today, generated_at=now_utc(), deltas_json=None, **current))
        items = items[: max(page_size, 1)]
        total += 1
    return make_response(paginated([snapshot_public(item) for item in items], total, page, page_size), request=request)


@router.get("/exports/dashboard-snapshots.csv")
def export_dashboard_snapshots(request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    rows = [snapshot_public(item) for item in db.scalars(select(DailyMetricSnapshot).order_by(DailyMetricSnapshot.snapshot_date.desc())).all()]
    today = now_utc().date().isoformat()
    if not any(row["date"] == today for row in rows):
        rows.insert(0, {"date": today, **current_dashboard_totals(db), "generated_at": now_utc().isoformat()})
    write_audit(db, request=request, actor=admin, action="export_dashboard_snapshots", resource_type="export")
    db.commit()
    return csv_response("dashboard-snapshots.csv", rows, ["date", "user_count", "developer_count", "visit_count", "work_count", "script_count", "blog_count", "message_count", "service_count", "generated_at"])


@router.get("/exports/service-requests.csv")
def export_service_requests(request: Request, service_id: str | None = None, user_id: str | None = None, status: str | None = None, failure_code: str | None = None, start_date: str | None = None, end_date: str | None = None, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    statement = select(ServiceRequest).order_by(ServiceRequest.created_at.desc())
    if service_id:
        statement = statement.where(ServiceRequest.service_id == service_id)
    if user_id:
        statement = statement.where(ServiceRequest.lumitime_user_id == user_id)
    if status:
        statement = statement.where(ServiceRequest.status == status)
    if failure_code:
        statement = statement.where(ServiceRequest.failure_code == failure_code)
    if start_date:
        statement = statement.where(ServiceRequest.created_at >= _parse_day_start(start_date))
    if end_date:
        statement = statement.where(ServiceRequest.created_at <= _parse_day_end(end_date))
    records = db.scalars(statement).all()
    rows = [
        {
            "service_request_id": item.service_request_id,
            "service_name": item.service_name_snapshot,
            "lumitime_user_id": item.lumitime_user_id,
            "status": item.status,
            "failure_code": item.failure_code,
            "result_summary": item.result_summary,
            "student_account_masked": item.student_account_masked,
            "started_at": item.started_at.isoformat() if item.started_at else "",
            "finished_at": item.finished_at.isoformat() if item.finished_at else "",
            "duration_ms": item.duration_ms,
            "script_version": item.script_version,
        }
        for item in records
    ]
    write_audit(db, request=request, actor=admin, action="export_service_requests", resource_type="export")
    db.commit()
    return csv_response("service-requests.csv", rows, ["service_request_id", "service_name", "lumitime_user_id", "status", "failure_code", "result_summary", "student_account_masked", "started_at", "finished_at", "duration_ms", "script_version"])


@router.get("/audit-logs")
def list_audit_logs(request: Request, actor_user_id: str | None = None, action: str | None = None, resource_type: str | None = None, resource_id: str | None = None, service_request_id: str | None = None, start_date: str | None = None, end_date: str | None = None, page: int = 1, page_size: int = 20, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    statement = select(AuditLog).order_by(AuditLog.created_at.desc())
    if actor_user_id:
        statement = statement.where(AuditLog.actor_user_id == actor_user_id)
    if action:
        statement = statement.where(AuditLog.action == action)
    if resource_type:
        statement = statement.where(AuditLog.resource_type == resource_type)
    if resource_id:
        statement = statement.where(AuditLog.resource_id == resource_id)
    if service_request_id:
        statement = statement.where(AuditLog.service_request_id == service_request_id)
    if start_date:
        statement = statement.where(AuditLog.created_at >= _parse_day_start(start_date))
    if end_date:
        statement = statement.where(AuditLog.created_at <= _parse_day_end(end_date))
    items, total = paginate_query(db, statement, page, page_size)
    return make_response(paginated([audit_public(item) for item in items], total, page, page_size), request=request)


@router.get("/audit-logs/{audit_log_id}")
def audit_detail(audit_log_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    audit = db.get(AuditLog, audit_log_id)
    if audit is None:
        raise ApiError("NOT_FOUND", "审计记录不存在。")
    return make_response(audit_public(audit), request=request)
