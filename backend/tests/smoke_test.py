from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app


def _csrf_headers(client: TestClient) -> dict[str, str]:
    token = client.cookies.get("lumitime_csrf")
    assert token
    return {"x-csrf-token": token}


def test_core_contract_and_privacy() -> None:
    with TestClient(app) as client:
        assert client.get("/api/v1/dashboard/metrics").status_code == 200
        assert client.get("/api/v1/messages").status_code == 200

        guest_scripts = client.get("/api/v1/scripts")
        assert guest_scripts.status_code == 401
        assert guest_scripts.json()["code"] == "UNAUTHORIZED"

        login = client.post("/api/v1/auth/login", json={"username": "member", "password": "member123"})
        assert login.status_code == 200
        assert login.json()["data"]["user"]["role"] == "invited_user"

        assert client.get("/api/v1/admin/users").status_code == 403
        assert client.get("/api/v1/scripts").status_code == 200

        create = client.post(
            "/api/v1/workstation/services/service_log_auto_submit/requests",
            headers=_csrf_headers(client),
            json={
                "student_account": "fail-user@example.com",
                "student_password": "pw-secret",
                "task_config": {"target_date": "2026-06-16"},
            },
        )
        assert create.status_code == 201
        assert "pw-secret" not in create.text
        assert "student_password" not in create.text

        service_request_id = create.json()["data"]["service_request_id"]
        detail = client.get(f"/api/v1/workstation/service-requests/{service_request_id}")
        assert detail.status_code == 200
        assert detail.json()["data"]["status"] == "failed"

        retry = client.post(
            f"/api/v1/workstation/service-requests/{service_request_id}/retry",
            json={"student_account": "202312348912", "student_password": "retry-secret"},
            headers=_csrf_headers(client),
        )
        assert retry.status_code == 201

        client.post("/api/v1/auth/logout", headers=_csrf_headers(client))
        admin_login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin"})
        assert admin_login.status_code == 200

        logs = client.get(f"/api/v1/admin/service-requests/{service_request_id}/logs")
        assert logs.status_code == 200
        assert "pw-secret" not in logs.text
        assert "fail-user@example.com" not in logs.text

        export = client.get("/api/v1/admin/exports/service-requests.csv")
        assert export.status_code == 200
        assert "pw-secret" not in export.text
        assert "fail-user@example.com" not in export.text
