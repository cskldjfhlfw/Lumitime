from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.main import app
from backend.app.core import hash_password
from backend.app.database import SessionLocal
from backend.app.models import User


def _uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _login(client: TestClient, username: str, password: str) -> None:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text


def _logout(client: TestClient) -> None:
    client.post("/api/v1/auth/logout")


def _create_admin_invite(client: TestClient, usage_limit: int = 1) -> str:
    _login(client, "admin", "admin")
    response = client.post("/api/v1/admin/invite-codes", json={"usage_limit": usage_limit, "remark": "pytest"})
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
        changed = client.patch("/api/v1/auth/password", json={"old_password": password, "new_password": new_password})
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


def test_content_crud_and_attachment_download() -> None:
    with TestClient(app) as client:
        _login(client, "admin", "admin")

        title = _uid("work")
        created = client.post(
            "/api/v1/admin/contents",
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

        published = client.patch(f"/api/v1/admin/contents/{content_id}/publish")
        assert published.status_code == 200

        upload = client.post(
            f"/api/v1/admin/works/{content_id}/attachments?filename={title}.zip&allow_download=true",
            files={"file": (f"{title}.zip", b"lumitime attachment bytes", "application/zip")},
        )
        assert upload.status_code == 201, upload.text
        attachment_id = upload.json()["data"]["id"]

        hidden_upload = client.post(
            f"/api/v1/admin/works/{content_id}/attachments?filename={title}-locked.zip&allow_download=false",
            files={"file": (f"{title}-locked.zip", b"locked", "application/zip")},
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


def test_message_moderation_and_rate_limit() -> None:
    with TestClient(app) as client:
        headers = {"x-forwarded-for": f"10.20.{int(uuid.uuid4().hex[:2], 16)}.{int(uuid.uuid4().hex[2:4], 16)}"}
        message_ids: list[str] = []
        for idx in range(3):
            response = client.post("/api/v1/messages", json={"nickname": f"guest{idx}", "content": _uid("message")}, headers=headers)
            assert response.status_code == 201, response.text
            message_ids.append(response.json()["data"]["id"])
        limited = client.post("/api/v1/messages", json={"nickname": "guest4", "content": _uid("message")}, headers=headers)
        assert limited.status_code == 429

        _login(client, "admin", "admin")
        hidden = client.patch(f"/api/v1/admin/messages/{message_ids[0]}/hide")
        assert hidden.status_code == 200
        visible_list = client.get("/api/v1/admin/messages?status=visible&page=1&page_size=1")
        assert visible_list.status_code == 200
        assert visible_list.json()["data"]["page_size"] == 1

        hidden_list = client.get("/api/v1/admin/messages?status=hidden&page=1&page_size=10")
        assert hidden_list.status_code == 200
        assert any(item["id"] == message_ids[0] for item in hidden_list.json()["data"]["items"])

        restored = client.patch(f"/api/v1/admin/messages/{message_ids[0]}/restore")
        assert restored.status_code == 200
        deleted = client.delete(f"/api/v1/admin/messages/{message_ids[0]}")
        assert deleted.status_code == 200


def test_workstation_states_and_retry() -> None:
    with TestClient(app) as client:
        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)

        success = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            json={
                "student_account": "202312345678",
                "student_password": "success-secret",
                "task_config": {"target_date": "2026-06-16"},
            },
        )
        assert success.status_code == 201, success.text
        success_id = success.json()["data"]["service_request_id"]
        success_detail = client.get(f"/api/v1/workstation/service-requests/{success_id}")
        assert success_detail.status_code == 200
        assert success_detail.json()["data"]["status"] == "success"

        failed = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
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
        )
        assert retry.status_code == 201
        assert retry.json()["data"]["service_request_id"] != failed_id

        timeout = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
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
            json={
                "student_account": "202312345680",
                "student_password": "not-integrated-secret",
                "task_config": {},
            },
        )
        assert not_integrated.status_code == 201
        not_integrated_detail = client.get(f"/api/v1/workstation/service-requests/{not_integrated.json()['data']['service_request_id']}")
        assert not_integrated_detail.json()["data"]["status"] == "not_integrated"
        assert not_integrated_detail.json()["data"]["failure_code"] == "SERVICE_NOT_INTEGRATED"

        my_records = client.get("/api/v1/workstation/service-requests/my?page=1&page_size=2")
        assert my_records.status_code == 200
        assert my_records.json()["data"]["page_size"] == 2


def test_privacy_and_exports_are_sanitized() -> None:
    with TestClient(app) as client:
        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)

        raw_account = "secret.user@example.com"
        raw_password = "student-secret-password"
        create = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            json={
                "student_account": raw_account,
                "student_password": raw_password,
                "task_config": {
                    "authorization": "Bearer token-secret",
                    "cookie": "lumitime-cookie-secret",
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
        assert "Bearer token-secret" not in logs.text
        assert "lumitime-cookie-secret" not in logs.text

        export = client.get("/api/v1/admin/exports/service-requests.csv")
        assert export.status_code == 200
        assert raw_account not in export.text
        assert raw_password not in export.text
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
        assert "student_password" not in audit_detail.text

        from backend.app.routes import public as public_routes

        original = public_routes.current_dashboard_totals

        def boom(db):  # noqa: ANN001
            raise RuntimeError("boom secret should be hidden")

        public_routes.current_dashboard_totals = boom
        try:
            with TestClient(app, raise_server_exceptions=False) as error_client:
                failure = error_client.get("/api/v1/dashboard/metrics")
                assert failure.status_code == 500
                payload = failure.json()
                assert payload["code"] == "INTERNAL_ERROR"
                assert "boom secret" not in failure.text
                assert payload["message"] == "系统异常，请稍后再试。"
        finally:
            public_routes.current_dashboard_totals = original


def test_admin_filters_and_pagination() -> None:
    with TestClient(app) as client:
        member_name, member_password, _ = _create_member(client)
        _login(client, member_name, member_password)
        created_request = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
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
