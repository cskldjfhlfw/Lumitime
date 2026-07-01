from __future__ import annotations

import re
import shutil
import subprocess
import uuid
from datetime import UTC
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import select

from backend.app.main import _csrf_tokens_match, app
from backend.app.config import Settings, settings
from backend.app.core import csv_safe_cell, hash_password, request_meta, secure_hash
from backend.app.database import SessionLocal
from backend.app.log_submit import prepare_log_content
from backend.app.models import User, WorkstationService
from backend.app.real_log_submit import _safe_float
from backend.app.runner import _failure_summary_with_detail


def _uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _login(client: TestClient, username: str, password: str) -> None:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    assert client.cookies.get("lumitime_csrf")


def _csrf_headers(client: TestClient) -> dict[str, str]:
    token = client.cookies.get("lumitime_csrf")
    assert token
    return {"x-csrf-token": token}


def _logout(client: TestClient) -> None:
    client.post("/api/v1/auth/logout", headers=_csrf_headers(client))


def _create_admin_invite(client: TestClient, usage_limit: int = 1) -> str:
    _login(client, "admin", "admin")
    response = client.post("/api/v1/admin/invite-codes", json={"usage_limit": usage_limit, "remark": "pytest"}, headers=_csrf_headers(client))
    assert response.status_code == 201, response.text
    invite_code = response.json()["data"]["code"]
    _logout(client)
    return invite_code


def _create_member(client: TestClient, display_name: str | None = None) -> tuple[str, str, str]:
    invite_code = _create_admin_invite(client)
    username = _uid("member")
    display_name = display_name or username.title()
    password = _uid("pass")
    response = client.post(
        "/api/v1/auth/register-with-invite",
        json={
            "invite_code": invite_code,
            "username": username,
            "display_name": display_name,
            "password": password,
        },
    )
    assert response.status_code == 201, response.text
    return username, password, display_name


def test_auth_register_change_password_and_role_gates() -> None:
    with TestClient(app) as client:
        username, password, _ = _create_member(client)

        _login(client, username, password)
        me = client.get("/api/v1/auth/me")
        assert me.status_code == 200
        assert me.json()["data"]["username"] == username

        new_password = _uid("newpass")
        changed = client.patch("/api/v1/auth/password", json={"old_password": password, "new_password": new_password}, headers=_csrf_headers(client))
        assert changed.status_code == 200
        _logout(client)

        old_login = client.post("/api/v1/auth/login", json={"username": username, "password": password})
        assert old_login.status_code == 401
        new_login = client.post("/api/v1/auth/login", json={"username": username, "password": new_password})
        assert new_login.status_code == 200

        _logout(client)
        rate_username = _uid("ghost")
        for _ in range(5):
            failed = client.post("/api/v1/auth/login", json={"username": rate_username, "password": "wrong"})
            assert failed.status_code == 401
        limited = client.post("/api/v1/auth/login", json={"username": rate_username, "password": "wrong"})
        assert limited.status_code == 429
        assert limited.json()["code"] == "RATE_LIMITED"

        _login(client, username, new_password)
        assert client.get("/api/v1/admin/users").status_code == 403
        _logout(client)

        assert client.get("/api/v1/scripts").status_code == 401
        assert client.get("/api/v1/workstation/services").status_code == 401


def test_login_rate_limit_ignores_spoofed_x_forwarded_for() -> None:
    with TestClient(app) as client:
        username = _uid("ghost")
        for index in range(5):
            failed = client.post(
                "/api/v1/auth/login",
                json={"username": username, "password": "wrong"},
                headers={"x-forwarded-for": f"198.51.100.{index}", "x-real-ip": "203.0.113.10"},
            )
            assert failed.status_code == 401

        limited = client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": "wrong"},
            headers={"x-forwarded-for": "198.51.100.99", "x-real-ip": "203.0.113.10"},
        )
        assert limited.status_code == 429
        assert limited.json()["code"] == "RATE_LIMITED"


def test_request_meta_uses_real_ip_not_forwarded_for() -> None:
    request = SimpleNamespace(
        headers={
            "x-forwarded-for": "198.51.100.1",
            "x-real-ip": "203.0.113.10",
            "user-agent": "pytest",
        },
        client=SimpleNamespace(host="192.0.2.55"),
    )

    ip_hash, ua = request_meta(request)

    assert ip_hash == secure_hash("203.0.113.10")
    assert ip_hash != secure_hash("198.51.100.1")
    assert ua == "pytest"


def test_nginx_template_overwrites_forwarded_for_header() -> None:
    from pathlib import Path

    template = Path("deploy/nginx/lumitime.conf.template").read_text(encoding="utf-8")

    assert "$proxy_add_x_forwarded_for" not in template
    assert template.count("proxy_pass http://api:8000;") == 4
    assert template.count("proxy_set_header X-Forwarded-For $remote_addr;") == 4


def test_bootstrap_admin_requires_token_and_reactivates_existing_demo_admin() -> None:
    with SessionLocal() as db:
        admin = db.scalar(select(User).where(User.username == "admin"))
        assert admin is not None
        admin.status = "disabled"
        db.commit()

    try:
        with TestClient(app) as client:
            denied = client.post(
                "/api/v1/auth/bootstrap-admin",
                json={
                    "bootstrap_token": "wrong-bootstrap-token",
                    "username": "admin",
                    "display_name": "Admin",
                    "password": "new-admin-password",
                },
            )
            assert denied.status_code == 403

            bootstrapped = client.post(
                "/api/v1/auth/bootstrap-admin",
                json={
                    "bootstrap_token": "pytest-bootstrap-token",
                    "username": "admin",
                    "display_name": "Bootstrap Admin",
                    "password": "new-admin-password",
                },
            )
            assert bootstrapped.status_code == 201, bootstrapped.text
            assert bootstrapped.json()["data"]["user"]["role"] == "admin"

            login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "new-admin-password"})
            assert login.status_code == 200

            with SessionLocal() as db:
                soft_deleted = User(
                    id=f"user_{uuid.uuid4().hex[:8]}",
                    username="soft_deleted_admin",
                    display_name="Soft Deleted",
                    role="admin",
                    password_hash=hash_password("irrelevant-password"),
                    status="active",
                    deleted_at=__import__("datetime").datetime.utcnow(),
                )
                db.add(soft_deleted)
                admin_row = db.scalar(select(User).where(User.username == "admin"))
                assert admin_row is not None
                admin_row.status = "disabled"
                db.commit()

            reused = client.post(
                "/api/v1/auth/bootstrap-admin",
                json={
                    "bootstrap_token": "pytest-bootstrap-token",
                    "username": "soft_deleted_admin",
                    "display_name": "Soft Deleted",
                    "password": "another-admin-password",
                },
            )
            assert reused.status_code == 409
            assert reused.json()["code"] == "CONFLICT"
    finally:
        with SessionLocal() as db:
            admin = db.scalar(select(User).where(User.username == "admin"))
            if admin is not None:
                admin.display_name = "Admin"
                admin.password_hash = hash_password("admin")
                admin.status = "active"
                db.commit()


def test_csrf_required_for_authenticated_write_requests() -> None:
    with TestClient(app) as client:
        _login(client, "admin", "admin")

        denied = client.post("/api/v1/admin/invite-codes", json={"usage_limit": 1, "remark": "missing csrf"})
        assert denied.status_code == 403
        assert denied.json()["code"] == "FORBIDDEN"

        allowed = client.post(
            "/api/v1/admin/invite-codes",
            json={"usage_limit": 1, "remark": "has csrf"},
            headers=_csrf_headers(client),
        )
        assert allowed.status_code == 201, allowed.text


def test_csrf_non_ascii_values_do_not_raise_type_error() -> None:
    assert _csrf_tokens_match("令牌", "令牌")
    assert not _csrf_tokens_match("令牌", "令牌2")


def test_password_changes_revoke_existing_sessions() -> None:
    with TestClient(app) as setup_client:
        username, password, _ = _create_member(setup_client)
    new_password = _uid("newpass")

    with TestClient(app) as old_client, TestClient(app) as current_client:
        _login(old_client, username, password)
        _login(current_client, username, password)

        changed = current_client.patch(
            "/api/v1/auth/password",
            json={"old_password": password, "new_password": new_password},
            headers=_csrf_headers(current_client),
        )
        assert changed.status_code == 200, changed.text
        assert current_client.get("/api/v1/auth/me").status_code == 200
        assert old_client.get("/api/v1/auth/me").status_code == 401


def test_authenticated_session_accepts_timezone_aware_expiry() -> None:
    with TestClient(app) as client:
        _login(client, "admin", "admin")
        token_hash = secure_hash(client.cookies.get("lumitime_session") or "")

        with SessionLocal() as db:
            from backend.app.models import SessionRecord

            session = db.scalar(select(SessionRecord).where(SessionRecord.token_hash == token_hash))
            assert session is not None
            session.expires_at = session.expires_at.replace(tzinfo=UTC)
            db.commit()

        response = client.get("/api/v1/auth/me")
        assert response.status_code == 200, response.text
        assert response.json()["data"]["username"] == "admin"


def test_admin_reset_password_revokes_user_sessions() -> None:
    with TestClient(app) as setup_client:
        username, password, _ = _create_member(setup_client)

    with TestClient(app) as member_client, TestClient(app) as admin_client:
        _login(member_client, username, password)
        _login(admin_client, "admin", "admin")

        users = admin_client.get(f"/api/v1/admin/users?keyword={username}")
        assert users.status_code == 200
        user_id = users.json()["data"]["items"][0]["id"]

        reset = admin_client.patch(
            f"/api/v1/admin/users/{user_id}/reset-password",
            json={"new_password": _uid("resetpass")},
            headers=_csrf_headers(admin_client),
        )
        assert reset.status_code == 200, reset.text
        assert member_client.get("/api/v1/auth/me").status_code == 401


def test_content_crud_and_attachment_download() -> None:
    with TestClient(app) as client:
        _login(client, "admin", "admin")

        title = _uid("work")
        created = client.post(
            "/api/v1/admin/contents",
            headers=_csrf_headers(client),
            json={
                "type": "work",
                "title": title,
                "summary": "attachment download test",
                "body": "body",
                "category": "project",
                "tags": ["pytest"],
                "status": "draft",
                "allow_copy": False,
            },
        )
        assert created.status_code == 201, created.text
        content_id = created.json()["data"]["id"]

        published = client.patch(f"/api/v1/admin/contents/{content_id}/publish", headers=_csrf_headers(client))
        assert published.status_code == 200

        upload = client.post(
            f"/api/v1/admin/works/{content_id}/attachments?filename={title}.zip&allow_download=true",
            files={"file": (f"{title}.zip", b"lumitime attachment bytes", "application/zip")},
            headers=_csrf_headers(client),
        )
        assert upload.status_code == 201, upload.text
        attachment_id = upload.json()["data"]["id"]

        hidden_upload = client.post(
            f"/api/v1/admin/works/{content_id}/attachments?filename={title}-locked.zip&allow_download=false",
            files={"file": (f"{title}-locked.zip", b"locked", "application/zip")},
            headers=_csrf_headers(client),
        )
        assert hidden_upload.status_code == 201
        locked_attachment_id = hidden_upload.json()["data"]["id"]

        _logout(client)
        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)

        work_detail = client.get(f"/api/v1/works/{content_id}")
        assert work_detail.status_code == 200
        assert any(att["id"] == attachment_id for att in work_detail.json()["data"]["attachments"])

        download = client.get(f"/api/v1/works/{content_id}/attachments/{attachment_id}/download")
        assert download.status_code == 200
        assert download.content == b"lumitime attachment bytes"

        denied = client.get(f"/api/v1/works/{content_id}/attachments/{locked_attachment_id}/download")
        assert denied.status_code == 403


def test_public_home_showcase_only_returns_published_showcase_items() -> None:
    with TestClient(app) as client:
        _login(client, "admin", "admin")

        showcase_title = _uid("showcase")
        ordinary_title = _uid("ordinary")
        created_showcase = client.post(
            "/api/v1/admin/contents",
            headers=_csrf_headers(client),
            json={
                "type": "work",
                "title": showcase_title,
                "summary": "public home card",
                "body": "body that should not be returned from list serializer",
                "category": "project",
                "tags": ["home"],
                "status": "published",
                "visibility": "home_showcase",
            },
        )
        assert created_showcase.status_code == 201, created_showcase.text

        created_ordinary = client.post(
            "/api/v1/admin/contents",
            headers=_csrf_headers(client),
            json={
                "type": "work",
                "title": ordinary_title,
                "summary": "invited only",
                "body": "private body",
                "category": "project",
                "tags": ["private"],
                "status": "published",
                "visibility": "invited_only",
            },
        )
        assert created_ordinary.status_code == 201, created_ordinary.text

        _logout(client)

        response = client.get("/api/v1/home/showcase?limit=20")
        assert response.status_code == 200, response.text
        items = response.json()["data"]
        titles = {item["title"] for item in items}
        assert showcase_title in titles
        assert ordinary_title not in titles
        showcase_item = next(item for item in items if item["title"] == showcase_title)
        assert showcase_item["visibility"] == "home_showcase"
        assert "body" not in showcase_item
        assert len(items) <= 8


def test_attachment_upload_rejects_empty_and_oversized_files() -> None:
    with TestClient(app) as client:
        _login(client, "admin", "admin")
        created = client.post(
            "/api/v1/admin/contents",
            headers=_csrf_headers(client),
            json={"type": "work", "title": _uid("upload"), "summary": "upload limits", "status": "draft"},
        )
        assert created.status_code == 201, created.text
        content_id = created.json()["data"]["id"]

        empty = client.post(
            f"/api/v1/admin/works/{content_id}/attachments",
            files={"file": ("empty.txt", b"", "text/plain")},
            headers=_csrf_headers(client),
        )
        assert empty.status_code == 400
        assert empty.json()["code"] == "BAD_REQUEST"

        original_limit = settings.max_upload_bytes
        object.__setattr__(settings, "max_upload_bytes", 4)
        try:
            too_large = client.post(
                f"/api/v1/admin/works/{content_id}/attachments",
                files={"file": ("big.txt", b"12345", "text/plain")},
                headers=_csrf_headers(client),
            )
        finally:
            object.__setattr__(settings, "max_upload_bytes", original_limit)
        assert too_large.status_code == 413
        assert too_large.json()["code"] == "PAYLOAD_TOO_LARGE"


def test_message_moderation_and_rate_limit() -> None:
    with TestClient(app) as client:
        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)
        headers = {"x-real-ip": f"10.20.{int(uuid.uuid4().hex[:2], 16)}.{int(uuid.uuid4().hex[2:4], 16)}"}
        message_ids: list[str] = []
        for idx in range(3):
            response = client.post(
                "/api/v1/messages",
                json={"nickname": f"guest{idx}", "content": _uid("message")},
                headers={**headers, **_csrf_headers(client)},
            )
            assert response.status_code == 201, response.text
            message_ids.append(response.json()["data"]["id"])
        limited = client.post(
            "/api/v1/messages",
            json={"nickname": "guest4", "content": _uid("message")},
            headers={**headers, **_csrf_headers(client)},
        )
        assert limited.status_code == 429

        _logout(client)
        _login(client, "admin", "admin")
        hidden = client.patch(f"/api/v1/admin/messages/{message_ids[0]}/hide", headers=_csrf_headers(client))
        assert hidden.status_code == 200
        visible_list = client.get("/api/v1/admin/messages?status=visible&page=1&page_size=1")
        assert visible_list.status_code == 200
        assert visible_list.json()["data"]["page_size"] == 1

        hidden_list = client.get("/api/v1/admin/messages?status=hidden&page=1&page_size=10")
        assert hidden_list.status_code == 200
        assert any(item["id"] == message_ids[0] for item in hidden_list.json()["data"]["items"])

        restored = client.patch(f"/api/v1/admin/messages/{message_ids[0]}/restore", headers=_csrf_headers(client))
        assert restored.status_code == 200
        deleted = client.delete(f"/api/v1/admin/messages/{message_ids[0]}", headers=_csrf_headers(client))
        assert deleted.status_code == 200


def test_public_dashboard_requires_login_and_guest_messages_are_readonly() -> None:
    with TestClient(app) as client:
        assert client.get("/api/v1/messages").status_code == 200

        guest_create = client.post("/api/v1/messages", json={"nickname": "visitor", "content": _uid("message")})
        assert guest_create.status_code == 401
        assert guest_create.json()["code"] == "UNAUTHORIZED"

        guest_dashboard = client.get("/api/v1/dashboard/metrics")
        assert guest_dashboard.status_code == 401
        assert guest_dashboard.json()["code"] == "UNAUTHORIZED"

        member_name, member_password, display_name = _create_member(client)
        _login(client, member_name, member_password)
        member_create = client.post(
            "/api/v1/messages",
            json={"nickname": display_name, "content": _uid("message")},
            headers=_csrf_headers(client),
        )
        assert member_create.status_code == 201, member_create.text
        assert client.get("/api/v1/dashboard/metrics").status_code == 200


def test_register_rate_limit_is_scoped_to_invite_and_ip() -> None:
    with TestClient(app) as client:
        _login(client, "admin", "admin")
        invite_response = client.post(
            "/api/v1/admin/invite-codes",
            json={"usage_limit": 10, "remark": "pytest-rate-limit"},
            headers=_csrf_headers(client),
        )
        assert invite_response.status_code == 201, invite_response.text
        invite_code = invite_response.json()["data"]["code"]
        _logout(client)

        headers = {"x-real-ip": f"10.21.{int(uuid.uuid4().hex[:2], 16)}.{int(uuid.uuid4().hex[2:4], 16)}"}
        for index in range(3):
            created = client.post(
                "/api/v1/auth/register-with-invite",
                json={
                    "invite_code": invite_code,
                    "username": _uid(f"rate_member_{index}"),
                    "display_name": f"Rate Member {index}",
                    "password": _uid("ratepass"),
                },
                headers=headers,
            )
            assert created.status_code == 201, created.text

        limited = client.post(
            "/api/v1/auth/register-with-invite",
            json={
                "invite_code": invite_code,
                "username": _uid("rate_member_4"),
                "display_name": "Rate Member 4",
                "password": _uid("ratepass"),
            },
            headers=headers,
        )
        assert limited.status_code == 429
        assert limited.json()["code"] == "RATE_LIMITED"


def test_rate_limit_store_prunes_stale_and_caps_total_buckets(monkeypatch) -> None:
    from backend.app import rate_limit

    monkeypatch.setattr(rate_limit, "MAX_RATE_LIMIT_BUCKETS", 3)
    monkeypatch.setattr(rate_limit, "monotonic", lambda: 100.0)
    rate_limit._BUCKETS.clear()

    limit = rate_limit.RateLimit(max_attempts=10, window_seconds=30.0)
    rate_limit.check_rate_limit("stale", limit)
    rate_limit._BUCKETS["stale"].clear()
    rate_limit._BUCKETS["stale"].append(1.0)

    for index in range(5):
        rate_limit.check_rate_limit(f"bucket-{index}", limit)

    assert "stale" not in rate_limit._BUCKETS
    assert len(rate_limit._BUCKETS) <= 3


def test_workstation_states_and_retry() -> None:
    with TestClient(app) as client:
        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)

        service_detail = client.get("/api/v1/workstation/services/service_log_auto_submit")
        assert service_detail.status_code == 200
        input_schema = service_detail.json()["data"]["input_schema"]
        schema_names = {item["name"] for item in input_schema}
        assert {
            "student_account",
            "student_password",
            "display_name",
            "target_date",
            "sxrz_text",
            "station_activity_text",
            "deepseek_api_key",
            "deepseek_base_url",
            "deepseek_model",
            "pacing_total_sec",
            "request_spacing_sec",
        }.issubset(schema_names)
        deepseek_model_field = next(item for item in input_schema if item["name"] == "deepseek_model")
        assert deepseek_model_field["placeholder"] == "deepseek-v4-flash"

        success = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "202312345678",
                "student_password": "success-secret",
                "task_config": {
                    "display_name": "模板测试姓名",
                    "target_date": "2026-06-16",
                    "sxrz_text": "今天完成一次本地模板验收，不触碰真实目标服务器。",
                    "pacing_total_sec": "0",
                    "request_spacing_sec": "0",
                },
            },
        )
        assert success.status_code == 201, success.text
        success_id = success.json()["data"]["service_request_id"]
        success_detail = client.get(f"/api/v1/workstation/service-requests/{success_id}")
        assert success_detail.status_code == 200
        assert success_detail.json()["data"]["status"] == "success"
        assert "本地干跑验收" in success_detail.json()["data"]["result_summary"]

        _logout(client)
        _login(client, "admin", "admin")
        success_logs = client.get(f"/api/v1/admin/service-requests/{success_id}/logs")
        assert success_logs.status_code == 200
        success_logs_text = success_logs.text
        assert "本地验收干跑" in success_logs_text
        assert "sso_login" in success_logs_text
        assert "jw_do_save" in success_logs_text
        assert "202312345678" not in success_logs_text
        assert "success-secret" not in success_logs_text
        _logout(client)
        _login(client, member_name, member_password)

        library = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "202312345682",
                "student_password": "library-secret",
                "task_config": {
                    "target_date": "2026-06-17",
                    "log_dates": ["2026-06-17", "2026-06-18"],
                    "display_name": "日志库测试",
                },
            },
        )
        assert library.status_code == 201
        library_id = library.json()["data"]["service_request_id"]
        _logout(client)
        _login(client, "admin", "admin")
        library_logs = client.get(f"/api/v1/admin/service-requests/{library_id}/logs")
        assert library_logs.status_code == 200
        assert "本地日志库随机抽取" in library_logs.text
        assert "提交日期数=2" in library_logs.text
        assert "library-secret" not in library_logs.text
        _logout(client)
        _login(client, member_name, member_password)

        failed = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "fail-user@example.com",
                "student_password": "failed-secret",
                "task_config": {"target_date": "2026-06-16"},
            },
        )
        assert failed.status_code == 201
        failed_id = failed.json()["data"]["service_request_id"]
        failed_detail = client.get(f"/api/v1/workstation/service-requests/{failed_id}")
        assert failed_detail.status_code == 200
        assert failed_detail.json()["data"]["status"] == "failed"
        assert failed_detail.json()["data"]["failure_code"] == "AUTH_FAILED"

        retry = client.post(
            f"/api/v1/workstation/service-requests/{failed_id}/retry",
            json={"student_account": "202312345679", "student_password": "retry-secret"},
            headers=_csrf_headers(client),
        )
        assert retry.status_code == 201
        assert retry.json()["data"]["service_request_id"] != failed_id

        timeout = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "timeout-user@example.com",
                "student_password": "timeout-secret",
                "task_config": {},
            },
        )
        assert timeout.status_code == 201
        timeout_detail = client.get(f"/api/v1/workstation/service-requests/{timeout.json()['data']['service_request_id']}")
        assert timeout_detail.json()["data"]["status"] == "timeout"

        not_integrated = client.post(
            "/api/v1/workstation/services/service_script_run/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "202312345680",
                "student_password": "not-integrated-secret",
                "task_config": {},
            },
        )
        assert not_integrated.status_code == 404

        my_records = client.get("/api/v1/workstation/service-requests/my?page=1&page_size=2")
        assert my_records.status_code == 200
        assert my_records.json()["data"]["page_size"] == 2


def test_workstation_rejects_reserved_dosave_fields_from_client_task_config() -> None:
    with TestClient(app) as client:
        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)

        tampered = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "202312349001",
                "student_password": "reserved-field-secret",
                "task_config": {
                    "target_date": "2026-06-16",
                    "display_name": "保留字段测试",
                    "XNXQ": "20242025-1",
                    "SXJXRW_ID": "client-forged-task",
                    "SY_CREATEUSER": "client-forged-account",
                },
            },
        )
        assert tampered.status_code == 400
        assert tampered.json()["code"] == "BAD_REQUEST"
        assert "XNXQ" in tampered.json()["message"]
        assert "SXJXRW_ID" in tampered.json()["message"]

        failed = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "fail-user@example.com",
                "student_password": "failed-secret",
                "task_config": {"target_date": "2026-06-16"},
            },
        )
        assert failed.status_code == 201
        failed_id = failed.json()["data"]["service_request_id"]

        retry = client.post(
            f"/api/v1/workstation/service-requests/{failed_id}/retry",
            headers=_csrf_headers(client),
            json={
                "student_account": "202312349002",
                "student_password": "retry-secret",
                "task_config": {
                    "target_date": "2026-06-16",
                    "SY_CREATEUSER": "client-forged-account",
                },
            },
        )
        assert retry.status_code == 400
        assert retry.json()["code"] == "BAD_REQUEST"
        assert "SY_CREATEUSER" in retry.json()["message"]


def test_privacy_and_exports_are_sanitized() -> None:
    with TestClient(app) as client:
        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)

        raw_account = "secret.user@example.com"
        raw_password = "student-secret-password"
        raw_display_name = "隐私测试姓名"
        raw_sxrz = "这是一段不应该进入审计和执行日志的实习日志正文。"
        raw_activity = "这是一段不应该进入审计和执行日志的今日记事。"
        create = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": raw_account,
                "student_password": raw_password,
                "task_config": {
                    "authorization": "Bearer token-secret",
                    "cookie": "lumitime-cookie-secret",
                    "display_name": raw_display_name,
                    "sxrz_text": raw_sxrz,
                    "station_activity_text": raw_activity,
                    "nested": {"password": "inner-secret", "student_account": raw_account},
                },
            },
        )
        assert create.status_code == 201, create.text
        assert raw_account not in create.text
        assert raw_password not in create.text
        request_id = create.json()["data"]["service_request_id"]

        _logout(client)
        _login(client, "admin", "admin")

        logs = client.get(f"/api/v1/admin/service-requests/{request_id}/logs")
        assert logs.status_code == 200
        assert raw_account not in logs.text
        assert raw_password not in logs.text
        assert raw_display_name not in logs.text
        assert raw_sxrz not in logs.text
        assert raw_activity not in logs.text
        assert "Bearer token-secret" not in logs.text
        assert "lumitime-cookie-secret" not in logs.text

        export = client.get("/api/v1/admin/exports/service-requests.csv")
        assert export.status_code == 200
        assert raw_account not in export.text
        assert raw_password not in export.text
        assert raw_display_name not in export.text
        assert raw_sxrz not in export.text
        assert raw_activity not in export.text
        assert "Bearer token-secret" not in export.text

        audit_list = client.get(f"/api/v1/admin/audit-logs?service_request_id={request_id}&page=1&page_size=10")
        assert audit_list.status_code == 200
        audit_items = audit_list.json()["data"]["items"]
        assert audit_items
        audit_id = audit_items[0]["id"]
        audit_detail = client.get(f"/api/v1/admin/audit-logs/{audit_id}")
        assert audit_detail.status_code == 200
        assert raw_account not in audit_detail.text
        assert raw_password not in audit_detail.text
        assert raw_display_name not in audit_detail.text
        assert raw_sxrz not in audit_detail.text
        assert raw_activity not in audit_detail.text
        assert "student_password" not in audit_detail.text

        from backend.app.routes import public as public_routes

        original = public_routes.current_dashboard_totals

        def boom(db):  # noqa: ANN001
            raise RuntimeError("boom secret should be hidden")

        public_routes.current_dashboard_totals = boom
        try:
            with TestClient(app, raise_server_exceptions=False) as error_client:
                _login(error_client, "admin", "admin")
                failure = error_client.get("/api/v1/dashboard/metrics")
                assert failure.status_code == 500
                payload = failure.json()
                assert payload["code"] == "INTERNAL_ERROR"
                assert "boom secret" not in failure.text
                assert payload["message"] == "系统异常，请稍后再试。"
        finally:
            public_routes.current_dashboard_totals = original


def test_log_library_uses_distinct_templates_for_multiple_days() -> None:
    content = prepare_log_content(
        {"log_dates": ["2026-06-18", "2026-06-19"]},
        {},
    )

    assert content.target_dates == ("2026-06-18", "2026-06-19")
    assert len(content.texts_by_date) == 2
    assert len(set(content.texts_by_date.values())) == 2


def test_failure_summary_masks_student_account_in_detail() -> None:
    summary = _failure_summary_with_detail(
        "SCRIPT_ERROR",
        "提交失败，账号 202312345683 被目标系统拒绝。",
        student_account="202312345683",
    )

    assert "202312345683" not in summary
    assert "2023****5683" in summary


def test_safe_float_rejects_non_finite_values() -> None:
    assert _safe_float("NaN", 3.0) == 3.0
    assert _safe_float("Infinity", 3.0) == 3.0
    assert _safe_float("-Infinity", 3.0) == 3.0
    assert _safe_float("2.5", 3.0) == 2.5


def test_manual_log_text_takes_priority_over_deepseek(monkeypatch) -> None:
    from backend.app import log_submit

    def fail_generate(**_kwargs):  # noqa: ANN003, ANN202
        raise AssertionError("DeepSeek should not be called when sxrz_text is provided")

    monkeypatch.setattr(log_submit, "generate_internship_log_via_deepseek", fail_generate)
    content = prepare_log_content(
        {
            "target_date": "2026-06-18",
            "sxrz_text": "这是手写实习日志正文，应当优先使用。",
            "station_activity_text": "协助整理台账。",
            "deepseek_api_key": "sk-local-browser-only",
        },
        {},
    )

    assert content.source == "manual"
    assert content.texts_by_date["2026-06-18"] == "这是手写实习日志正文，应当优先使用。"


def test_log_submit_deepseek_generation_uses_memory_only(monkeypatch) -> None:
    from backend.app import log_submit

    calls: list[list[str]] = []

    def fake_generate(**kwargs):  # noqa: ANN003, ANN202
        assert kwargs["activity"] == "协助民警整理台账并参与社区宣传。"
        assert kwargs["api_key"] == "sk-local-browser-only"
        assert kwargs["model"] == "deepseek-v4-flash"
        dates = [item.isoformat() for item in kwargs["log_dates"]]
        calls.append(dates)
        return f"{dates[0]} 今日在派出所协助整理接处警台账，并参与社区安全宣传，进一步熟悉基层警务流程。"

    monkeypatch.setattr(log_submit, "generate_internship_log_via_deepseek", fake_generate)

    with TestClient(app) as client:
        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)
        created = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "202312345683",
                "student_password": "deepseek-submit-secret",
                "task_config": {
                    "target_date": "2026-06-18",
                    "log_dates": ["2026-06-18", "2026-06-19"],
                    "display_name": "DeepSeek 测试姓名",
                    "station_activity_text": "协助民警整理台账并参与社区宣传。",
                    "deepseek_api_key": "sk-local-browser-only",
                    "deepseek_base_url": "https://api.deepseek.com",
                },
            },
        )
        assert created.status_code == 201, created.text
        assert calls == [["2026-06-18"], ["2026-06-19"]]
        request_id = created.json()["data"]["service_request_id"]
        assert "sk-local-browser-only" not in created.text
        _logout(client)

        _login(client, "admin", "admin")
        logs = client.get(f"/api/v1/admin/service-requests/{request_id}/logs")
        assert logs.status_code == 200
        assert "DeepSeek 逐日生成" in logs.text
        assert "提交日期数=2" in logs.text
        assert "sk-local-browser-only" not in logs.text
        assert "deepseek-submit-secret" not in logs.text

        audit = client.get(f"/api/v1/admin/audit-logs?service_request_id={request_id}&page=1&page_size=10")
        assert audit.status_code == 200
        assert "sk-local-browser-only" not in audit.text
        assert "协助民警整理台账并参与社区宣传" not in audit.text


def test_deepseek_base_url_rejects_unapproved_internal_destination(monkeypatch) -> None:
    from backend.app import log_submit

    def fail_post(*_args, **_kwargs):  # noqa: ANN002, ANN003, ANN202
        raise AssertionError("blocked DeepSeek Base URL should not reach httpx.post")

    monkeypatch.setattr(log_submit.httpx, "post", fail_post)

    try:
        log_submit.generate_internship_log_via_deepseek(
            activity="协助整理台账。",
            api_key="sk-test",
            base_url="http://127.0.0.1:8000",
            log_dates=[],
        )
    except RuntimeError as exc:
        assert "允许列表" in str(exc)
    else:  # pragma: no cover - assertion branch only used on failure.
        raise AssertionError("unapproved internal DeepSeek Base URL was accepted")


def test_deepseek_default_base_url_is_still_allowed(monkeypatch) -> None:
    from backend.app import log_submit

    calls: list[str] = []

    class FakeResponse:
        status_code = 200

        def json(self):  # noqa: ANN201
            return {"choices": [{"message": {"content": "今日协助整理台账并参与社区宣传。"}}]}

    def fake_post(url, **_kwargs):  # noqa: ANN001, ANN003, ANN202
        calls.append(url)
        return FakeResponse()

    monkeypatch.setattr(log_submit.httpx, "post", fake_post)

    content = log_submit.generate_internship_log_via_deepseek(
        activity="协助整理台账。",
        api_key="sk-test",
        base_url="https://api.deepseek.com/",
        log_dates=[],
    )

    assert content == "今日协助整理台账并参与社区宣传。"
    assert calls == ["https://api.deepseek.com/v1/chat/completions"]


def test_csv_cells_are_formula_safe() -> None:
    assert csv_safe_cell("=cmd|' /C calc'!A0") == "'=cmd|' /C calc'!A0"
    assert csv_safe_cell("+SUM(1,2)") == "'+SUM(1,2)"
    assert csv_safe_cell("-10") == "'-10"
    assert csv_safe_cell("@HYPERLINK(\"http://example.test\")") == "'@HYPERLINK(\"http://example.test\")"
    assert csv_safe_cell("normal text") == "normal text"


def test_real_submit_adapter_path_is_mockable_without_network(monkeypatch) -> None:
    from backend.app import runner
    from backend.app.log_submit import PreparedLogContent
    from backend.app.real_log_submit import RealSubmitEvent, RealSubmitResult

    calls: list[dict[str, object]] = []

    def fake_real_submit(**kwargs):  # noqa: ANN003, ANN202
        calls.append(kwargs)
        return RealSubmitResult(
            content=PreparedLogContent(
                source="manual",
                source_label="手写正文",
                han_chars=18,
                target_dates=("2026-06-18",),
                texts_by_date={"2026-06-18": "这是手写实习日志正文。"},
            ),
            events=[
                RealSubmitEvent("real_submit", "mock submit_example real path"),
                RealSubmitEvent("jw_do_save", "mock doSave success"),
            ],
        )

    monkeypatch.setattr(type(runner.settings), "real_log_submit_enabled", property(lambda _self: True))
    monkeypatch.setattr(type(runner.settings), "dry_run_log_submit_enabled", property(lambda _self: False))
    monkeypatch.setattr(runner, "run_real_log_submit", fake_real_submit)

    with TestClient(app) as client:
        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)
        created = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "202312345684",
                "student_password": "real-path-secret",
                "task_config": {
                    "target_date": "2026-06-18",
                    "display_name": "真实脚本测试",
                    "sxrz_text": "这是手写实习日志正文。",
                },
            },
        )
        assert created.status_code == 201, created.text
        request_id = created.json()["data"]["service_request_id"]
        detail = client.get(f"/api/v1/workstation/service-requests/{request_id}")
        assert detail.status_code == 200
        assert detail.json()["data"]["status"] == "success"
        assert "真实提交脚本" in detail.json()["data"]["result_summary"]
        assert calls
        assert calls[0]["student_password"] == "real-path-secret"
        _logout(client)

        _login(client, "admin", "admin")
        logs = client.get(f"/api/v1/admin/service-requests/{request_id}/logs")
        assert logs.status_code == 200
        assert "mock submit_example real path" in logs.text
        assert "mock doSave success" in logs.text
        assert "real-path-secret" not in logs.text


def test_real_canary_runs_real_submit_for_admin_only(monkeypatch) -> None:
    from backend.app import runner
    from backend.app.log_submit import PreparedLogContent
    from backend.app.real_log_submit import RealSubmitEvent, RealSubmitResult

    calls: list[dict[str, object]] = []

    def fake_real_submit(**kwargs):  # noqa: ANN003, ANN202
        calls.append(kwargs)
        return RealSubmitResult(
            content=PreparedLogContent(
                source="manual",
                source_label="手写正文",
                han_chars=18,
                target_dates=("2026-06-18",),
                texts_by_date={"2026-06-18": "这是灰度真实提交测试。"},
            ),
            events=[RealSubmitEvent("real_submit", "canary real path")],
        )

    monkeypatch.setattr(runner, "settings", Settings(environment="development", log_submit_mode="real_canary"))
    monkeypatch.setattr(runner, "run_real_log_submit", fake_real_submit)

    with TestClient(app) as client:
        _login(client, "admin", "admin")
        created = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "202312345686",
                "student_password": "admin-canary-secret",
                "task_config": {
                    "target_date": "2026-06-18",
                    "display_name": "管理员灰度",
                    "sxrz_text": "这是灰度真实提交测试。",
                },
            },
        )
        assert created.status_code == 201, created.text
        admin_request_id = created.json()["data"]["service_request_id"]
        admin_detail = client.get(f"/api/v1/workstation/service-requests/{admin_request_id}")
        assert admin_detail.status_code == 200
        assert admin_detail.json()["data"]["status"] == "success"
        assert "真实提交脚本" in admin_detail.json()["data"]["result_summary"]
        _logout(client)

        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)
        created_member = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "202312345687",
                "student_password": "member-dry-run-secret",
                "task_config": {
                    "target_date": "2026-06-18",
                    "display_name": "普通用户灰度",
                    "sxrz_text": "这是普通用户灰度干跑测试。",
                },
            },
        )
        assert created_member.status_code == 201, created_member.text
        member_request_id = created_member.json()["data"]["service_request_id"]
        member_detail = client.get(f"/api/v1/workstation/service-requests/{member_request_id}")
        assert member_detail.status_code == 200
        assert member_detail.json()["data"]["status"] == "success"
        assert "本地干跑验收" in member_detail.json()["data"]["result_summary"]

    assert len(calls) == 1
    assert calls[0]["student_password"] == "admin-canary-secret"


def test_real_canary_allows_named_username(monkeypatch) -> None:
    from backend.app import runner

    canary_settings = Settings(environment="development", log_submit_mode="real_canary")
    object.__setattr__(canary_settings, "log_submit_canary_usernames", ("allowed_member",))
    monkeypatch.setattr(runner, "settings", canary_settings)

    with SessionLocal() as db:
        service = db.get(WorkstationService, "service_log_auto_submit")
        assert service is not None
        user = User(
            id=_uid("user"),
            username="allowed_member",
            display_name="Allowed Member",
            role="invited_user",
            password_hash=hash_password("member-pass"),
            status="active",
        )
        db.add(user)
        db.commit()
        assert runner._real_log_submit_allowed(service, user) is True  # noqa: SLF001


def test_api_image_includes_real_submit_runtime_assets() -> None:
    dockerfile = Path("deploy/docker/Dockerfile.api").read_text(encoding="utf-8")

    assert "nodejs" in dockerfile
    assert "COPY submit_example /app/submit_example" in dockerfile


def test_deploy_workflow_sets_canary_mode_and_preflights_real_submit_image() -> None:
    workflow = Path(".github/workflows/ci-cd.yml").read_text(encoding="utf-8")

    assert "LOG_SUBMIT_MODE:" in workflow
    assert "real_canary" in workflow
    assert "LUMITIME_LOG_SUBMIT_CANARY_USERNAMES" in workflow
    assert "Real submit image preflight" in workflow
    assert "_preflight_submit_example_resources" in workflow


def test_log_auto_submit_service_metadata_mentions_real_canary() -> None:
    with TestClient(app):
        pass

    with SessionLocal() as db:
        service = db.get(WorkstationService, "service_log_auto_submit")

    assert service is not None
    assert service.script_version == "v0.2.0-real-canary"
    assert "real_canary" in (service.description or "")


def test_real_submit_preflight_fails_before_network_when_resources_missing(monkeypatch) -> None:
    from backend.app import runner
    from submit_example import sso_cppu

    monkeypatch.setattr(type(runner.settings), "real_log_submit_enabled", property(lambda _self: True))
    monkeypatch.setattr(type(runner.settings), "dry_run_log_submit_enabled", property(lambda _self: False))
    monkeypatch.setattr(sso_cppu, "_TOOLS", Path("backend/resources/__missing_encrypt_password.cjs"))
    monkeypatch.setattr(sso_cppu, "_RSA_DEPENDENCIES", (Path("backend/resources/__missing_加密.js"),))

    with TestClient(app) as client:
        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)
        created = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "202312345685",
                "student_password": "preflight-secret",
                "task_config": {
                    "target_date": "2026-06-18",
                    "display_name": "预检测试",
                    "sxrz_text": "这是手写实习日志正文。",
                },
            },
        )
        assert created.status_code == 201, created.text
        request_id = created.json()["data"]["service_request_id"]
        detail = client.get(f"/api/v1/workstation/service-requests/{request_id}")
        assert detail.status_code == 200
        payload = detail.json()["data"]
        assert payload["status"] == "failed"
        assert payload["failure_code"] == "SCRIPT_ERROR"
        assert "真实提交脚本资源缺失" in payload["result_summary"]
        assert "preflight-secret" not in detail.text
        _logout(client)

        _login(client, "admin", "admin")
        logs = client.get(f"/api/v1/admin/service-requests/{request_id}/logs")
        assert logs.status_code == 200
        assert "script_preflight" in logs.text
        assert "sso_login_page" not in logs.text
        assert "preflight-secret" not in logs.text


def test_dosave_template_does_not_pin_personal_identity() -> None:
    from pathlib import Path

    from submit_example import jw_chain

    template_path = Path("backend/resources/dosave.txt")
    template = template_path.read_text(encoding="utf-8")

    assert "2023160169" not in template
    assert "2026-05-13" not in template
    assert "今日跟随民警" not in template
    assert "Key=XSXH; Value=" in template
    assert "Key=BGRQ; Value=" in template
    assert "Key=SXRZ; Value=" in template
    assert "Key=OPERATETIME; Value=" in template
    assert "Key=SY_CREATEUSER; Value=" in template
    assert "Key=XNXQ; Value=20252026-2" in template
    assert "Key=XSDB; Value=1" in template
    assert "Key=BX; Value=智慧警务学院" in template
    assert "Key=XYD_NAME; Value=智慧警务二队" in template
    assert "Key=XYD_COED; Value=1032010" in template
    assert "Key=SXLX; Value=07" in template
    assert "Key=TJZT; Value=1" in template
    assert Path(jw_chain._DOSAVE_TEMPLATE).resolve() == template_path.resolve()  # noqa: SLF001


def test_dosave_runtime_values_keep_template_order() -> None:
    from submit_example import jw_chain

    pairs = jw_chain._parse_dosave_template(jw_chain._DOSAVE_TEMPLATE)  # noqa: SLF001
    form = {key: value for key, value in pairs if key not in jw_chain.RUNTIME_FORM_FIELDS}
    form.update(
        {
            "XSXM": "运行时姓名",
            "XSXH": "202399990001",
            "BGRQ": "2026-06-18",
            "SXRZ": "运行时日志正文",
            "OPERATETIME": "2026-06-18 18:30:00",
            "SY_CREATEUSER": "202399990001",
            "SY_CREATEUSERNAME": "运行时姓名",
            "SXJXRW_ID": "runtime-task-id",
            "XY_ID": "runtime-xy-id",
            "OPERATERCODE": "runtime-operator-code",
            "SY_CREATEUSERID": "runtime-create-user-id",
        }
    )

    ordered = jw_chain._ordered_dosave_pairs(form, pairs)  # noqa: SLF001
    ordered_keys = [key for key, _value in ordered]
    template_keys = [key for key, _value in pairs]
    preview = jw_chain._dosave_kv_preview(ordered)  # noqa: SLF001

    assert ordered_keys[:len(template_keys)] == template_keys
    assert ordered_keys.index("XSXM") == template_keys.index("XSXM")
    assert ordered_keys.index("XSXH") == template_keys.index("XSXH")
    assert ordered_keys.index("BGRQ") == template_keys.index("BGRQ")
    assert ordered_keys.index("SXRZ") == template_keys.index("SXRZ")
    assert "Key=XSXM; Value=运行时姓名" in preview
    assert "Key=XSXH; Value=202399990001" in preview
    assert "Key=SY_CREATEUSER; Value=202399990001" in preview
    assert "Key=SY_CREATEUSERNAME; Value=运行时姓名" in preview
    assert "Key=SXJXRW_ID; Value=runtime-task-id" in preview
    assert "Key=XY_ID; Value=runtime-xy-id" in preview
    assert "Key=OPERATERCODE; Value=runtime-operator-code" in preview
    assert "Key=SY_CREATEUSERID; Value=runtime-create-user-id" in preview


def test_encrypt_password_script_is_loaded_from_backend_resources() -> None:
    from submit_example import sso_cppu

    tool_path = Path("backend/resources/encrypt_password.cjs")
    encrypt_path = Path("backend/resources/加密.js")
    login_path = Path("backend/resources/登录.js")

    assert tool_path.is_file()
    assert encrypt_path.is_file()
    assert login_path.is_file()
    assert Path(sso_cppu._TOOLS).resolve() == tool_path.resolve()  # noqa: SLF001
    assert tuple(Path(path).resolve() for path in sso_cppu._RSA_DEPENDENCIES) == (  # noqa: SLF001
        encrypt_path.resolve(),
        login_path.resolve(),
    )


def test_encrypt_password_script_uses_backend_login_resources() -> None:
    tool_path = Path("backend/resources/encrypt_password.cjs")
    login_source = Path("backend/resources/登录.js").read_text(encoding="utf-8")
    modulus = re.search(r'getKeyPair\("010001",\s*\'\',\s*"([^"]+)"\)', login_source)
    node = shutil.which("node")

    assert modulus is not None
    if node is None:
        pytest.skip("node is not installed")

    encrypted = subprocess.run(
        [node, str(tool_path), "local-test-password"],
        capture_output=True,
        text=True,
        timeout=30,
        cwd=str(Path.cwd()),
    )

    assert encrypted.returncode == 0, encrypted.stderr
    assert encrypted.stdout.strip()
    assert encrypted.stdout.strip() != "local-test-password"
    assert re.fullmatch(r"[0-9a-f]+", encrypted.stdout.strip())


def test_sso_login_page_parser_uses_action_captcha_and_hidden_fields() -> None:
    from submit_example import sso_cppu

    html = """
    <html>
      <body>
        <form id="fm1" action="/tpass/login;jsessionid=abc">
          <input type="hidden" name="execution" value="e1s1" />
          <input type="hidden" name="lt" value="login-ticket" />
          <input type="hidden" name="encrypted" value="true" />
          <input type="text" name="username" />
          <input type="password" name="password" />
          <input type="text" name="authcode" />
        </form>
        <img id="captcha" src="/tpass/captcha.jpg?seed=1" />
      </body>
    </html>
    """

    page = sso_cppu._parse_login_page(html, "https://sso.cppu.edu.cn/tpass/login?service=x")  # noqa: SLF001

    assert page.execution == "e1s1"
    assert page.post_url == "https://sso.cppu.edu.cn/tpass/login;jsessionid=abc"
    assert page.captcha_url == "https://sso.cppu.edu.cn/tpass/captcha.jpg?seed=1"
    assert page.hidden_fields["lt"] == "login-ticket"
    assert page.hidden_fields["encrypted"] == "true"
    assert "password" not in page.hidden_fields
    assert "username" not in page.hidden_fields


def test_real_submit_preflight_passes_with_backend_login_resources() -> None:
    from backend.app.real_log_submit import RealSubmitEvent, _preflight_submit_example_resources

    events: list[RealSubmitEvent] = []

    _preflight_submit_example_resources(events)

    assert events[-1].step == "script_preflight"
    assert "预检通过" in events[-1].message


def test_production_settings_reject_unsafe_defaults() -> None:
    local = Settings(environment="development")
    assert local.enable_inline_worker is True
    assert local.inline_worker_enabled is True

    for kwargs in [
        {"secret_key": "lumitime-dev-secret-change-me", "cookie_secure": True, "cors_origins": ("https://example.com",)},
        {"secret_key": "short", "cookie_secure": True, "cors_origins": ("https://example.com",)},
        {"secret_key": "x" * 32, "cookie_secure": False, "cors_origins": ("https://example.com",)},
        {"secret_key": "x" * 32, "cookie_secure": True, "cors_origins": ()},
        {"secret_key": "x" * 32, "cookie_secure": True, "cors_origins": ("*",)},
    ]:
        try:
            Settings(environment="production", **kwargs)
        except RuntimeError:
            pass
        else:  # pragma: no cover - assertion branch only used on failure.
            raise AssertionError(f"unsafe production settings accepted: {kwargs}")

    secure = Settings(
        environment="production",
        secret_key="x" * 32,
        cookie_secure=True,
        cors_origins=("https://lumitime.example.com",),
    )
    assert secure.is_production
    assert secure.inline_worker_enabled is True
    assert secure.dry_run_log_submit_enabled is False

    dry_run = Settings(
        environment="production",
        secret_key="x" * 32,
        cookie_secure=True,
        cors_origins=("https://lumitime.example.com",),
        log_submit_mode="dry_run",
    )
    assert dry_run.inline_worker_enabled is True
    assert dry_run.dry_run_log_submit_enabled is True


def test_admin_filters_and_pagination() -> None:
    with TestClient(app) as client:
        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)
        created_request = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "202312345681",
                "student_password": "filter-secret",
                "task_config": {},
            },
        )
        assert created_request.status_code == 201
        request_id = created_request.json()["data"]["service_request_id"]
        _logout(client)

        _login(client, "admin", "admin")

        contents = client.get("/api/v1/admin/contents?type=script&page=1&page_size=1")
        assert contents.status_code == 200
        assert contents.json()["data"]["page_size"] == 1
        assert contents.json()["data"]["total"] >= 1

        capped_contents = client.get("/api/v1/admin/contents?type=script&page=1&page_size=1000")
        assert capped_contents.status_code == 200
        assert capped_contents.json()["data"]["page_size"] == 100

        messages = client.get("/api/v1/admin/messages?status=visible&page=1&page_size=1")
        assert messages.status_code == 200
        assert messages.json()["data"]["page_size"] == 1

        services = client.get("/api/v1/admin/workstation/services?status=enabled&page=1&page_size=1")
        assert services.status_code == 200
        assert services.json()["data"]["page_size"] == 1

        service_requests = client.get("/api/v1/admin/service-requests?status=success&page=1&page_size=1")
        assert service_requests.status_code == 200
        assert service_requests.json()["data"]["page_size"] == 1

        filtered_requests = client.get(f"/api/v1/admin/service-requests?service_request_id={request_id}&page=1&page_size=1")
        assert filtered_requests.status_code == 200
        assert filtered_requests.json()["data"]["total"] >= 1

        audit_logs = client.get("/api/v1/admin/audit-logs?action=login_success&page=1&page_size=1")
        assert audit_logs.status_code == 200
        assert audit_logs.json()["data"]["page_size"] == 1

        snapshots = client.get("/api/v1/admin/dashboard/snapshots?page=1&page_size=1")
        assert snapshots.status_code == 200
        assert snapshots.json()["data"]["page_size"] == 1
