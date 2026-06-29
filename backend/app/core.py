from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import re
import secrets
import string
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

try:
    from argon2 import PasswordHasher
    from argon2.exceptions import InvalidHashError, VerifyMismatchError, VerificationError
except ImportError:  # pragma: no cover - requirements include argon2-cffi.
    PasswordHasher = None  # type: ignore[assignment]
    InvalidHashError = VerifyMismatchError = VerificationError = Exception  # type: ignore[misc,assignment]

from .config import settings


ERROR_HTTP_STATUS = {
    "BAD_REQUEST": status.HTTP_400_BAD_REQUEST,
    "UNAUTHORIZED": status.HTTP_401_UNAUTHORIZED,
    "FORBIDDEN": status.HTTP_403_FORBIDDEN,
    "NOT_FOUND": status.HTTP_404_NOT_FOUND,
    "CONFLICT": status.HTTP_409_CONFLICT,
    "RATE_LIMITED": status.HTTP_429_TOO_MANY_REQUESTS,
    "PAYLOAD_TOO_LARGE": status.HTTP_413_CONTENT_TOO_LARGE,
    "INTERNAL_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
    "SERVICE_NOT_INTEGRATED": status.HTTP_501_NOT_IMPLEMENTED,
}


_PASSWORD_HASHER = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2) if PasswordHasher else None


class ApiError(HTTPException):
    def __init__(self, code: str, message: str, status_code: int | None = None):
        super().__init__(
            status_code=status_code or ERROR_HTTP_STATUS.get(code, status.HTTP_400_BAD_REQUEST),
            detail={"code": code, "message": message},
        )


def now_utc() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def iso(dt: datetime | None) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.isoformat()


def public_request_id() -> str:
    return "req_api_" + now_utc().strftime("%Y%m%d_%H%M%S_") + secrets.token_hex(4)


def service_request_id() -> str:
    return "svc_req_" + now_utc().strftime("%Y%m%d_%H%M%S_") + secrets.token_hex(4)


def prefixed_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


def make_response(data: Any, message: str = "success", code: str = "OK", request: Request | None = None) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "data": data,
        "request_id": getattr(getattr(request, "state", None), "request_id", None) or public_request_id(),
    }


def created(data: Any, message: str = "创建成功。", request: Request | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=make_response(data, message=message, code="CREATED", request=request),
    )


def error_response(request: Request, code: str, message: str, http_status: int) -> JSONResponse:
    return JSONResponse(
        status_code=http_status,
        content=make_response(None, message=message, code=code, request=request),
    )


def hash_password(password: str) -> str:
    if _PASSWORD_HASHER is not None:
        return "argon2id$" + _PASSWORD_HASHER.hash(password)
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 180_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    if stored.startswith("argon2id$") and _PASSWORD_HASHER is not None:
        try:
            return _PASSWORD_HASHER.verify(stored.removeprefix("argon2id$"), password)
        except (InvalidHashError, VerificationError, VerifyMismatchError):
            return False
    if stored.startswith("$argon2id$") and _PASSWORD_HASHER is not None:
        try:
            return _PASSWORD_HASHER.verify(stored, password)
        except (InvalidHashError, VerificationError, VerifyMismatchError):
            return False
    try:
        algorithm, salt, digest = stored.split("$", 2)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 180_000).hex()
    return hmac.compare_digest(candidate, digest)


def password_needs_rehash(stored: str) -> bool:
    if not stored.startswith("argon2id$") or _PASSWORD_HASHER is None:
        return True
    try:
        return _PASSWORD_HASHER.check_needs_rehash(stored.removeprefix("argon2id$"))
    except (InvalidHashError, VerificationError):
        return True


def secure_hash(value: str) -> str:
    return hmac.new(settings.secret_key.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    return secure_hash(ip)


def summarize_user_agent(user_agent: str | None) -> str | None:
    if not user_agent:
        return None
    return user_agent[:160]


def request_meta(request: Request) -> tuple[str | None, str | None]:
    real_ip = request.headers.get("x-real-ip")
    ip = real_ip.strip() if real_ip else (request.client.host if request.client else None)
    return hash_ip(ip), summarize_user_agent(request.headers.get("user-agent"))


def generate_invite_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    left = "".join(secrets.choice(alphabet) for _ in range(4))
    right = "".join(secrets.choice(alphabet) for _ in range(4))
    return f"LUMI-{left}-{right}"


def mask_account(account: str) -> str:
    value = account.strip()
    if not value:
        return ""
    if "@" in value:
        name, domain = value.split("@", 1)
        if len(name) <= 1:
            return f"*@{domain}"
        return f"{name[0]}***@{domain}"
    if len(value) <= 4:
        return value[0] + "***" if value else "***"
    if len(value) <= 8:
        return value[:2] + "****" + value[-2:]
    return value[:4] + "****" + value[-4:]


SENSITIVE_KEY_RE = re.compile(
    r"(?i)\b(password|pwd|student_password|token|cookie|authorization|bearer|session|deepseek_api_key)\b\s*[:=]\s*[^,\s;]+"
)
BEARER_RE = re.compile(r"(?i)\bbearer\s+[a-z0-9._\-]+")
AUTH_HEADER_RE = re.compile(r"(?i)\b(authorization|cookie|set-cookie|x-api-key|token)\b\s*[:=]\s*[^\r\n,;]+")
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]{2,}@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
LONG_NUMBER_RE = re.compile(r"\b\d{8,}\b")


def sanitize_text(value: str, student_account: str | None = None) -> str:
    text = value
    if student_account:
        text = text.replace(student_account, mask_account(student_account))
    text = SENSITIVE_KEY_RE.sub(lambda m: f"{m.group(1)}=[REDACTED]", text)
    text = AUTH_HEADER_RE.sub(lambda m: f"{m.group(1)}=[REDACTED]", text)
    text = BEARER_RE.sub("Bearer [REDACTED]", text)
    text = EMAIL_RE.sub(lambda m: mask_account(m.group(0)), text)
    text = LONG_NUMBER_RE.sub(lambda m: mask_account(m.group(0)), text)
    return text


def sanitize_payload(value: Any) -> Any:
    if isinstance(value, BaseModel):
        value = value.model_dump()
    if isinstance(value, dict):
        safe: dict[str, Any] = {}
        for key, item in value.items():
            lower = key.lower()
            if any(token in lower for token in ["password", "pwd", "token", "cookie", "authorization", "deepseek_api_key"]):
                continue
            if key == "student_account":
                safe["student_account_masked"] = mask_account(str(item))
                continue
            safe[key] = sanitize_payload(item)
        return safe
    if isinstance(value, list):
        return [sanitize_payload(item) for item in value]
    if isinstance(value, str):
        return sanitize_text(value)
    return value


def parse_tags(tags: Any) -> list[str]:
    if tags is None:
        return []
    if isinstance(tags, list):
        return [str(tag) for tag in tags if str(tag).strip()]
    if isinstance(tags, str):
        try:
            parsed = json.loads(tags)
            if isinstance(parsed, list):
                return [str(tag) for tag in parsed]
        except json.JSONDecodeError:
            return [part.strip() for part in tags.split(",") if part.strip()]
    return []


def json_list(value: list[str]) -> str:
    return json.dumps(value, ensure_ascii=False)


def paginate_query(db: Session, statement: Select[Any], page: int, page_size: int) -> tuple[list[Any], int]:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    total = db.scalar(select(func.count()).select_from(statement.order_by(None).subquery())) or 0
    items = list(db.scalars(statement.offset((page - 1) * page_size).limit(page_size)).all())
    return items, total


def paginated(items: list[Any], total: int, page: int, page_size: int) -> dict[str, Any]:
    return {"items": items, "page": page, "page_size": page_size, "total": total}


def csv_response(filename: str, rows: list[dict[str, Any]], fieldnames: list[str]) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({key: csv_safe_cell(sanitize_text(str(row.get(key, "")))) for key in fieldnames})
    data = io.BytesIO(buffer.getvalue().encode("utf-8-sig"))
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(data, media_type="text/csv; charset=utf-8", headers=headers)


def csv_safe_cell(value: str) -> str:
    if value and value[0] in {"=", "+", "-", "@", "\t", "\r", "\n"}:
        return "'" + value
    return value


def new_uuid() -> str:
    return str(uuid.uuid4())
