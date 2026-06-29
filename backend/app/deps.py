from __future__ import annotations

import secrets
from datetime import timedelta

from fastapi import Depends, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .config import settings
from .core import ApiError, as_naive_utc, now_utc, prefixed_id, secure_hash
from .database import get_db
from .models import SessionRecord, User


SESSION_TTL = timedelta(days=7)
CSRF_TTL_SECONDS = int(SESSION_TTL.total_seconds())


def purge_expired_sessions(db: Session) -> None:
    db.execute(delete(SessionRecord).where(SessionRecord.expires_at < now_utc()))


def create_session(db: Session, response: Response, user: User) -> str:
    purge_expired_sessions(db)
    token = prefixed_id("sess") + "." + prefixed_id("token")
    csrf_token = secrets.token_urlsafe(32)
    record = SessionRecord(
        id=prefixed_id("session"),
        token_hash=secure_hash(token),
        user_id=user.id,
        expires_at=now_utc() + SESSION_TTL,
    )
    db.add(record)
    db.commit()
    response.set_cookie(
        settings.session_cookie_name,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=int(SESSION_TTL.total_seconds()),
        path="/",
    )
    response.set_cookie(
        settings.csrf_cookie_name,
        csrf_token,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=CSRF_TTL_SECONDS,
        path="/",
    )
    return token


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(settings.session_cookie_name, path="/", secure=settings.cookie_secure, samesite="lax")
    response.delete_cookie(settings.csrf_cookie_name, path="/", secure=settings.cookie_secure, samesite="lax")


def delete_user_sessions(db: Session, user_id: str) -> None:
    db.execute(delete(SessionRecord).where(SessionRecord.user_id == user_id))


def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> User | None:
    purge_expired_sessions(db)
    db.commit()
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    session = db.scalar(select(SessionRecord).where(SessionRecord.token_hash == secure_hash(token)))
    if not session:
        return None
    if as_naive_utc(session.expires_at) < now_utc():
        db.execute(delete(SessionRecord).where(SessionRecord.id == session.id))
        db.commit()
        return None
    user = db.get(User, session.user_id)
    if not user or user.deleted_at is not None:
        return None
    return user


def require_auth(user: User | None = Depends(get_current_user_optional)) -> User:
    if user is None:
        raise ApiError("UNAUTHORIZED", "请先登录后再访问。")
    if user.status != "active":
        raise ApiError("FORBIDDEN", "账号不可用。")
    return user


def require_invited_or_admin(user: User = Depends(require_auth)) -> User:
    if user.role not in {"invited_user", "admin"}:
        raise ApiError("FORBIDDEN", "无权限访问。")
    return user


def require_admin(user: User = Depends(require_auth)) -> User:
    if user.role != "admin":
        raise ApiError("FORBIDDEN", "无权限访问。")
    return user
