from __future__ import annotations

import json
from typing import Any

from .core import iso, parse_tags
from .models import (
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


def user_public(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "displayName": user.display_name,
        "role": user.role,
        "status": user.status,
        "created_at": iso(user.created_at),
        "updated_at": iso(user.updated_at),
        "last_login_at": iso(user.last_login_at),
    }


def invite_public(invite: InviteCode) -> dict[str, Any]:
    return {
        "id": invite.id,
        "code": invite.code,
        "usage_limit": invite.usage_limit,
        "used_count": invite.used_count,
        "status": invite.status,
        "expires_at": iso(invite.expires_at),
        "remark": invite.remark,
        "created_at": iso(invite.created_at),
        "updated_at": iso(invite.updated_at),
    }


def invite_usage_public(usage: InviteCodeUsage) -> dict[str, Any]:
    return {
        "id": usage.id,
        "invite_code_id": usage.invite_code_id,
        "user_id": usage.user_id,
        "used_at": iso(usage.used_at),
        "user_agent_summary": usage.user_agent_summary,
    }


def attachment_public(attachment: ContentAttachment, admin: bool = False) -> dict[str, Any]:
    data = {
        "id": attachment.id,
        "filename": attachment.filename,
        "file_size": attachment.file_size,
        "file_type": attachment.file_type,
        "can_download": bool(attachment.allow_download) or admin,
        "allow_download": bool(attachment.allow_download),
        "checksum": attachment.checksum if admin else None,
        "created_at": iso(attachment.created_at),
    }
    return data


def content_public(item: ContentItem, detail: bool = False, admin: bool = False) -> dict[str, Any]:
    tags = parse_tags(item.tags_json)
    data: dict[str, Any] = {
        "id": item.id,
        "type": item.type,
        "title": item.title,
        "summary": item.summary,
        "desc": item.summary,
        "language": item.language,
        "category": item.category,
        "tag": item.language or item.category or (tags[0] if tags else None),
        "tags": tags,
        "status": item.status,
        "updated_at": iso(item.updated_at),
        "updatedAt": item.updated_at.date().isoformat() if item.updated_at else None,
    }
    if detail:
        data.update(
            {
                "body": item.body,
                "code": item.code,
                "usage": item.body,
                "notes": [line for line in (item.body or "").splitlines() if line.strip()][:6],
                "allow_copy": bool(item.allow_copy),
                "downloadable": any(bool(att.allow_download) for att in item.attachments),
                "highlights": tags,
                "attachments": [attachment_public(att, admin=admin) for att in item.attachments if not att.deleted_at],
            }
        )
    return data


def message_public(message: Message, admin: bool = False) -> dict[str, Any]:
    data = {
        "id": message.id,
        "nickname": message.nickname,
        "content": message.content,
        "status": message.status,
        "created_at": iso(message.created_at),
        "createdAt": message.created_at.strftime("%Y-%m-%d %H:%M") if message.created_at else None,
    }
    if admin:
        data["moderated_at"] = iso(message.moderated_at)
        data["moderated_by"] = message.moderated_by
    return data


def service_public(service: WorkstationService, detail: bool = False, frontend_status: bool = True) -> dict[str, Any]:
    try:
        schema = json.loads(service.input_schema_json or "[]")
    except json.JSONDecodeError:
        schema = []
    status_map = {"enabled": "active", "disabled": "offline"}
    data: dict[str, Any] = {
        "id": service.id,
        "name": service.name,
        "summary": service.summary,
        "description": service.description if detail else service.summary,
        "status": status_map.get(service.status, service.status) if frontend_status else service.status,
        "api_status": service.status,
        "updated_at": iso(service.updated_at),
        "updatedAt": service.updated_at.date().isoformat() if service.updated_at else None,
        "route": f"/workstation/services/{service.id}",
        "script_key": service.script_key,
        "script_version": service.script_version,
    }
    if detail:
        data["input_schema"] = schema
    return data


def request_public(record: ServiceRequest) -> dict[str, Any]:
    status_map = {"running": "executing", "failed": "failure"}
    duration = f"{record.duration_ms / 1000:.1f}s" if record.duration_ms is not None else "-"
    return {
        "id": record.id,
        "service_request_id": record.service_request_id,
        "requestId": record.service_request_id,
        "service_id": record.service_id,
        "service_name": record.service_name_snapshot,
        "serviceName": record.service_name_snapshot,
        "status": record.status,
        "ui_status": status_map.get(record.status, record.status),
        "failure_code": record.failure_code,
        "failureCategory": record.failure_code,
        "submitted_at": iso(record.created_at),
        "submittedAt": record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else None,
        "finished_at": iso(record.finished_at),
        "duration_ms": record.duration_ms,
        "duration": duration,
        "result_summary": record.result_summary,
        "summary": record.result_summary,
        "student_account_masked": record.student_account_masked,
        "accountMask": record.student_account_masked,
        "can_retry": record.status in {"failed", "timeout", "not_integrated"},
        "canRetry": record.status in {"failed", "timeout", "not_integrated"},
        "retry_of_service_request_id": record.retry_of_service_request_id,
    }


def log_public(log: ServiceExecutionLog) -> dict[str, Any]:
    return {
        "sequence": log.sequence,
        "level": log.log_level,
        "time": iso(log.created_at),
        "step_name": log.step_name,
        "message": log.message_sanitized,
    }


def audit_public(audit: AuditLog) -> dict[str, Any]:
    try:
        metadata = json.loads(audit.metadata_sanitized_json or "null")
    except json.JSONDecodeError:
        metadata = None
    return {
        "id": audit.id,
        "actor_user_id": audit.actor_user_id,
        "actor_role": audit.actor_role,
        "action": audit.action,
        "resource_type": audit.resource_type,
        "resource_id": audit.resource_id,
        "service_request_id": audit.service_request_id,
        "result": audit.result,
        "metadata_sanitized": metadata,
        "user_agent_summary": audit.user_agent_summary,
        "created_at": iso(audit.created_at),
    }


def snapshot_public(snapshot: DailyMetricSnapshot) -> dict[str, Any]:
    return {
        "date": snapshot.snapshot_date,
        "user_count": snapshot.user_count,
        "developer_count": snapshot.developer_count,
        "visit_count": snapshot.visit_count,
        "work_count": snapshot.work_count,
        "script_count": snapshot.script_count,
        "blog_count": snapshot.blog_count,
        "message_count": snapshot.message_count,
        "service_count": snapshot.service_count,
        "generated_at": iso(snapshot.generated_at),
    }
