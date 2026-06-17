from __future__ import annotations

import json
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from .core import prefixed_id, request_meta, sanitize_payload
from .models import AuditLog, User


AUDIT_METADATA_ALLOWLIST = {
    "username",
    "service_id",
    "student_account_hash",
    "task_config",
    "retry_of",
    "type",
    "status",
    "allow_copy",
    "allow_download",
    "script_key",
    "script_version",
    "failure_code",
    "page",
    "page_size",
}


def _audit_metadata(metadata: Any) -> Any:
    sanitized = sanitize_payload(metadata)
    if not isinstance(sanitized, dict):
        return sanitized
    return {key: sanitized[key] for key in AUDIT_METADATA_ALLOWLIST if key in sanitized}


def write_audit(
    db: Session,
    *,
    request: Request | None,
    actor: User | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    result: str = "success",
    metadata: Any = None,
    service_request_id: str | None = None,
) -> None:
    ip_hash, ua = request_meta(request) if request is not None else (None, None)
    row = AuditLog(
        id=prefixed_id("audit"),
        actor_user_id=actor.id if actor else None,
        actor_role=actor.role if actor else "visitor",
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        result=result,
        metadata_sanitized_json=json.dumps(_audit_metadata(metadata), ensure_ascii=False) if metadata is not None else None,
        service_request_id=service_request_id,
        source_ip_hash=ip_hash,
        user_agent_summary=ua,
    )
    db.add(row)
