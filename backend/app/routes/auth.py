from __future__ import annotations

import hmac
from collections import defaultdict, deque
from time import monotonic

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..audit import write_audit
from ..config import settings
from ..core import ApiError, as_naive_utc, created, hash_password, make_response, now_utc, password_needs_rehash, prefixed_id, request_meta, verify_password
from ..database import get_db
from ..deps import clear_session_cookie, create_session, delete_user_sessions, require_auth
from ..models import InviteCode, InviteCodeUsage, SessionRecord, User
from ..schemas import BootstrapAdminBody, ChangePasswordBody, LoginBody, RegisterWithInviteBody
from ..serializers import user_public

router = APIRouter(prefix="/auth", tags=["auth"])

_LOGIN_ATTEMPTS: defaultdict[str, deque[float]] = defaultdict(deque)
_LOGIN_LIMIT = 5
_LOGIN_WINDOW_SECONDS = 60.0


def _login_bucket(request: Request, username: str) -> str:
    ip_hash, _ = request_meta(request)
    return f"{username.lower()}:{ip_hash or 'unknown'}"


def _check_login_rate_limit(bucket: str) -> None:
    now = monotonic()
    attempts = _LOGIN_ATTEMPTS[bucket]
    while attempts and now - attempts[0] > _LOGIN_WINDOW_SECONDS:
        attempts.popleft()
    if len(attempts) >= _LOGIN_LIMIT:
        raise ApiError("RATE_LIMITED", "登录尝试过于频繁，请稍后再试。")
    attempts.append(now)


def _reset_login_bucket(bucket: str) -> None:
    _LOGIN_ATTEMPTS.pop(bucket, None)


@router.post("/bootstrap-admin")
def bootstrap_admin(body: BootstrapAdminBody, request: Request, db: Session = Depends(get_db)):
    if not settings.bootstrap_token:
        raise ApiError("FORBIDDEN", "系统初始化未启用。")
    if not hmac.compare_digest(body.bootstrap_token, settings.bootstrap_token):
        raise ApiError("FORBIDDEN", "初始化令牌无效。")

    active_admin = db.scalar(select(User).where(User.role == "admin", User.status == "active", User.deleted_at.is_(None)))
    if active_admin is not None:
        raise ApiError("CONFLICT", "系统已存在可用管理员。")

    existing_any = db.scalar(select(User).where(User.username == body.username))
    if existing_any is not None and existing_any.deleted_at is not None:
        raise ApiError("CONFLICT", "用户名已被删除，不能复用。")
    if existing_any is not None and existing_any.role != "admin":
        raise ApiError("CONFLICT", "用户名已存在。")

    user = existing_any or User(
        id=prefixed_id("user"),
        username=body.username,
        display_name=body.display_name,
        role="admin",
        password_hash=hash_password(body.password),
        status="active",
    )
    user.display_name = body.display_name
    user.role = "admin"
    user.password_hash = hash_password(body.password)
    user.status = "active"
    user.deleted_at = None
    db.add(user)
    db.flush()
    write_audit(db, request=request, actor=user, action="bootstrap_admin", resource_type="user", resource_id=user.id, metadata={"username": user.username})
    db.commit()
    return created({"user": user_public(user)}, message="管理员初始化完成。", request=request)


@router.post("/login")
def login(body: LoginBody, request: Request, response: Response, db: Session = Depends(get_db)):
    bucket = _login_bucket(request, body.username)
    _check_login_rate_limit(bucket)
    user = db.scalar(select(User).where(User.username == body.username, User.deleted_at.is_(None)))
    if user is None or not verify_password(body.password, user.password_hash):
        write_audit(
            db,
            request=request,
            actor=None,
            action="login_failed",
            resource_type="user",
            result="failed",
            metadata={"username": body.username},
        )
        db.commit()
        raise ApiError("UNAUTHORIZED", "账号或密码错误。")
    if user.status != "active":
        write_audit(db, request=request, actor=user, action="login_failed_disabled", resource_type="user", resource_id=user.id, result="failed")
        db.commit()
        raise ApiError("FORBIDDEN", "账号不可用。")

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)

    user.last_login_at = now_utc()
    create_session(db, response, user)
    _reset_login_bucket(bucket)
    write_audit(db, request=request, actor=user, action="login_success", resource_type="user", resource_id=user.id)
    db.commit()
    redirect_to = "/admin" if user.role == "admin" else "/"
    return make_response({"user": user_public(user), "redirect_to": redirect_to}, message="登录成功。", request=request)


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        from ..core import secure_hash

        db.execute(delete(SessionRecord).where(SessionRecord.token_hash == secure_hash(token)))
        db.commit()
    clear_session_cookie(response)
    return make_response(None, message="已退出登录。", request=request)


@router.get("/me")
def me(request: Request, user: User = Depends(require_auth)):
    return make_response(user_public(user), request=request)


@router.post("/register-with-invite")
def register_with_invite(body: RegisterWithInviteBody, request: Request, db: Session = Depends(get_db)):
    exists = db.scalar(select(User).where(User.username == body.username))
    if exists:
        raise ApiError("CONFLICT", "用户名已存在。")

    invite = db.scalar(select(InviteCode).where(InviteCode.code == body.invite_code))
    if invite is None or invite.status != "active":
        raise ApiError("BAD_REQUEST", "邀请码不可用。")
    if invite.expires_at is not None and as_naive_utc(invite.expires_at) < now_utc():
        invite.status = "expired"
        db.commit()
        raise ApiError("BAD_REQUEST", "邀请码已过期。")
    if invite.used_count >= invite.usage_limit:
        raise ApiError("BAD_REQUEST", "邀请码使用次数已达上限。")

    user = User(
        id=prefixed_id("user"),
        username=body.username,
        display_name=body.display_name,
        role="invited_user",
        password_hash=hash_password(body.password),
        status="active",
    )
    ip_hash, ua = request_meta(request)
    invite.used_count += 1
    usage = InviteCodeUsage(
        id=prefixed_id("invite_usage"),
        invite_code_id=invite.id,
        user_id=user.id,
        source_ip_hash=ip_hash,
        user_agent_summary=ua,
    )
    db.add_all([user, usage])
    write_audit(db, request=request, actor=user, action="register_with_invite", resource_type="user", resource_id=user.id)
    db.commit()
    return created({"user_id": user.id, "role": user.role}, message="注册成功。", request=request)


@router.patch("/password")
def change_password(body: ChangePasswordBody, request: Request, response: Response, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    if not verify_password(body.old_password, user.password_hash):
        raise ApiError("BAD_REQUEST", "旧密码不正确。")
    user.password_hash = hash_password(body.new_password)
    delete_user_sessions(db, user.id)
    create_session(db, response, user)
    write_audit(db, request=request, actor=user, action="change_password", resource_type="user", resource_id=user.id)
    db.commit()
    return make_response(None, message="密码已更新。", request=request)
