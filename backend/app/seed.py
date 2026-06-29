from __future__ import annotations

import json
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .core import hash_password, json_list, now_utc, prefixed_id, verify_password
from .database import SessionLocal
from .models import (
    ContentAttachment,
    ContentItem,
    DailyMetricSnapshot,
    InviteCode,
    Message,
    ServiceExecutionLog,
    ServiceRequest,
    User,
    WorkstationService,
)
from .storage import ensure_seed_attachment


def seed_runtime_data() -> None:
    with SessionLocal() as db:
        seed_data(db)


def seed_runtime_workstation_services() -> None:
    with SessionLocal() as db:
        _ensure_production_workstation_service(db)
        _disable_unintegrated_services(db)
        db.commit()


def init_db() -> None:
    seed_runtime_data()


def seed_data(db: Session) -> None:
    if not settings.demo_seed_enabled:
        _ensure_production_workstation_service(db)
        _disable_known_demo_artifacts(db)
        _disable_unintegrated_services(db)
        db.commit()
        return

    admin = db.scalar(select(User).where(User.username == "admin"))
    if admin is None:
        admin = User(
            id="user_admin",
            username="admin",
            display_name="Admin",
            role="admin",
            password_hash=hash_password("admin"),
            status="active",
        )
        db.add(admin)
    member = db.scalar(select(User).where(User.username == "member"))
    if member is None:
        member = User(
            id="user_member",
            username="member",
            display_name="Member",
            role="invited_user",
            password_hash=hash_password("member123"),
            status="active",
        )
        db.add(member)
    db.commit()

    if not db.scalar(select(InviteCode).where(InviteCode.code == "LUMI-A1B2")):
        db.add(
            InviteCode(
                id="invite_demo",
                code="LUMI-A1B2",
                status="active",
                usage_limit=20,
                used_count=0,
                expires_at=now_utc() + timedelta(days=365),
                remark="默认演示邀请码",
                created_by=admin.id,
            )
        )

    if db.scalar(select(ContentItem).limit(1)) is None:
        _seed_content(db, admin.id)

    if db.scalar(select(Message).limit(1)) is None:
        db.add_all(
            [
                Message(id="msg_001", nickname="路过的访客", content="公开入口很清楚。", status="visible"),
                Message(id="msg_002", nickname="Alice", content="服务记录里 request_id 很好查。", status="visible"),
                Message(id="msg_003", nickname="匿名", content="这条用于演示隐藏状态。", status="hidden"),
            ]
        )

    _seed_or_update_services(db, admin.id)
    db.commit()

    if db.scalar(select(ServiceRequest).limit(1)) is None:
        _seed_records(db, member.id)

    if db.scalar(select(DailyMetricSnapshot).limit(1)) is None:
        _seed_snapshots(db)

    _ensure_seed_attachment_files(db)

    db.commit()


def _disable_known_demo_artifacts(db: Session) -> None:
    admin = db.scalar(select(User).where(User.username == "admin", User.deleted_at.is_(None)))
    if admin is not None and admin.role == "admin" and verify_password("admin", admin.password_hash):
        admin.status = "disabled"

    member = db.scalar(select(User).where(User.username == "member", User.deleted_at.is_(None)))
    if member is not None and member.role == "invited_user" and verify_password("member123", member.password_hash):
        member.status = "disabled"

    demo_invite = db.scalar(select(InviteCode).where(InviteCode.code == "LUMI-A1B2"))
    if demo_invite is not None:
        demo_invite.status = "disabled"


def _disable_unintegrated_services(db: Session) -> None:
    if settings.inline_worker_enabled:
        return
    services = db.scalars(select(WorkstationService).where(WorkstationService.deleted_at.is_(None))).all()
    for service in services:
        if service.script_key in {"log_auto_submit", "not_integrated"} or service.script_version == "v0.1.0-mock":
            service.status = "disabled"


def _ensure_production_workstation_service(db: Session) -> None:
    admin = db.scalar(select(User).where(User.role == "admin", User.status == "active", User.deleted_at.is_(None)))
    if admin is None:
        return
    _seed_or_update_services(db, admin.id)


def _seed_content(db: Session, admin_id: str) -> None:
    now = now_utc()
    items = [
        ContentItem(
            id="script_service_polling",
            type="script",
            title="日志提交状态轮询",
            summary="根据 service_request_id 轮询服务执行状态，包含超时处理和错误分类。",
            body="提交后立即返回 request_id\n超过最大等待时间后引导用户到提交记录页\n不在前端缓存学生学习 App 密码",
            code='pollServiceRequest("svc_req_20260612_000001", { timeout: 120000 })',
            language="TypeScript",
            category="tool",
            tags_json=json_list(["状态轮询", "工作站"]),
            status="published",
            created_by=admin_id,
            published_at=now,
        ),
        ContentItem(
            id="script_account_mask",
            type="script",
            title="账号掩码工具",
            summary="将学生学习 App 账号转为安全展示格式，避免完整账号出现在界面中。",
            body="仅展示掩码结果\n完整账号不进入日志与导出\n失败重试仍需用户重新输入凭证",
            code='maskAccount("202312348912") // 2023****8912',
            language="Security",
            category="security",
            tags_json=json_list(["安全", "脱敏"]),
            status="published",
            created_by=admin_id,
            published_at=now,
        ),
        ContentItem(
            id="work_lumitime_workstation",
            type="work",
            title="Lumitime 个人工作站",
            summary="围绕脚本、作品、随记、工作服务构建的个人效率空间。",
            body="公开展示与邀请访问分层\n服务提交记录可追溯\n黑白微光视觉系统",
            category="Web App",
            tags_json=json_list(["项目", "Web App", "工作站"]),
            status="published",
            created_by=admin_id,
            published_at=now,
        ),
        ContentItem(
            id="work_service_traceability",
            type="work",
            title="服务请求追溯方案",
            summary="以 request_id 串联用户反馈、后台记录和脱敏执行日志。",
            body="用户只看自己的记录\n管理员查看完整脱敏日志\n敏感凭证不保存不导出",
            category="Design",
            tags_json=json_list(["Design", "审计"]),
            status="published",
            created_by=admin_id,
            published_at=now,
        ),
        ContentItem(
            id="blog_no_password_storage",
            type="blog",
            title="为什么工作站需要“只保存记录，不保存密码”",
            summary="从隐私、审计和用户信任三个角度拆解日志自动提交的边界。",
            body="工作站服务会接触外部系统账号，但 Lumitime 的边界必须更清楚：服务可以处理一次请求，却不拥有用户的长期凭证。\n提交记录只需要保存服务名称、状态、request_id、耗时、结果摘要和账号掩码。\n这样的设计让失败重试更麻烦一点，但换来的是更明确的信任关系。",
            category="安全设计",
            tags_json=json_list(["安全设计", "隐私"]),
            status="published",
            created_by=admin_id,
            published_at=now,
        ),
        ContentItem(
            id="blog_login_motion_meaning",
            type="blog",
            title="从下坠到向上：登录动效的产品语义",
            summary="让动画服务于 Lumitime 的情绪转折，而不是只做装饰。",
            body="登录前的光束和人物剪影表达的是误以为自己在向下。\n这个动效不应该拖慢效率，所以它必须短、轻、可降级。\n品牌叙事最好的位置是入口，而工具页面要重新回到清晰、轻量和可读。",
            category="交互",
            tags_json=json_list(["交互", "登录"]),
            status="published",
            created_by=admin_id,
            published_at=now,
        ),
    ]
    db.add_all(items)
    db.add_all(
        [
            ContentAttachment(
                id="att_lumitime_zip",
                content_id="work_lumitime_workstation",
                filename="lumitime-workstation.zip",
                file_size=1024,
                storage_key="seed/lumitime-workstation.zip",
                allow_download=1,
                uploaded_by=admin_id,
            ),
            ContentAttachment(
                id="att_traceability_zip",
                content_id="work_service_traceability",
                filename="service-traceability.zip",
                file_size=2048,
                storage_key="seed/service-traceability.zip",
                allow_download=0,
                uploaded_by=admin_id,
            ),
        ]
    )


def _seed_or_update_services(db: Session, admin_id: str) -> None:
    log_input_schema = [
        {
            "name": "student_account",
            "label": "教务账号",
            "type": "text",
            "required": True,
            "placeholder": "仅用于本次本地验收请求",
        },
        {
            "name": "student_password",
            "label": "教务密码",
            "type": "password",
            "required": True,
            "placeholder": "不会入库，不会写入日志",
        },
        {
            "name": "display_name",
            "label": "姓名",
            "type": "text",
            "required": True,
            "placeholder": "按模板填写，后端只保存是否已填写",
        },
        {"name": "target_date", "label": "提交日期（可多选）", "type": "date", "required": True},
        {
            "name": "sxrz_text",
            "label": "实习日志正文",
            "type": "textarea",
            "required": False,
            "placeholder": "可手写正文；留空时按本地模板库模拟生成",
        },
        {
            "name": "station_activity_text",
            "label": "今日记事",
            "type": "textarea",
            "required": False,
            "placeholder": "填写后配合 DeepSeek API Key 自动生成正文",
        },
        {
            "name": "deepseek_api_key",
            "label": "DeepSeek API Key",
            "type": "password",
            "required": False,
            "placeholder": "仅保存在本地浏览器，仅用于本次生成",
        },
        {
            "name": "deepseek_base_url",
            "label": "DeepSeek Base URL",
            "type": "text",
            "required": False,
            "placeholder": "https://api.deepseek.com",
        },
        {
            "name": "deepseek_model",
            "label": "DeepSeek 模型",
            "type": "text",
            "required": False,
            "placeholder": "deepseek-v4-flash",
        },
        {
            "name": "pacing_total_sec",
            "label": "多日总等待秒数",
            "type": "number",
            "required": False,
            "placeholder": "0",
        },
        {
            "name": "request_spacing_sec",
            "label": "请求间隔秒数",
            "type": "number",
            "required": False,
            "placeholder": "0",
        },
    ]
    service_specs = [
        {
            "id": "service_log_auto_submit",
            "name": "日志自动提交",
            "summary": "按日志填报模板执行本地验收流程。",
            "description": "输入模板所需字段后，后端执行本地日志提交验收流程，生成脱敏执行记录；dry_run 模式不会请求真实学校系统。",
            "status": "enabled" if settings.inline_worker_enabled else "disabled",
            "script_key": "log_auto_submit",
            "script_version": "v0.1.0-mock",
            "input_schema_json": json.dumps(log_input_schema, ensure_ascii=False),
        },
        {
            "id": "service_script_run",
            "name": "脚本执行引擎",
            "summary": "在线运行授权脚本并返回脱敏结果。",
            "description": "在线运行自定义脚本，支持定时任务与参数配置。",
            "status": "disabled",
            "script_key": "not_integrated",
            "script_version": "v0.2.0",
            "input_schema_json": json.dumps(
                [{"name": "target_date", "label": "运行日期", "type": "date", "required": False}],
                ensure_ascii=False,
            ),
        },
        {
            "id": "service_data_sync",
            "name": "数据同步服务",
            "summary": "跨平台同步个人数据，当前维护中。",
            "description": "跨平台数据同步，保持多端一致性，支持增量更新。",
            "status": "disabled",
            "script_key": "data_sync",
            "script_version": "v0.1.4",
            "input_schema_json": json.dumps(
                [{"name": "target_date", "label": "同步日期", "type": "date", "required": False}],
                ensure_ascii=False,
            ),
        },
        {
            "id": "service_monitor",
            "name": "站点监控",
            "summary": "实时监测服务可用性和历史趋势。",
            "description": "实时监测服务可用性，异常告警通知，历史记录查看。",
            "status": "disabled",
            "script_key": "not_integrated",
            "script_version": "v0.3.1",
            "input_schema_json": "[]",
        },
        {
            "id": "service_content_export",
            "name": "内容导出工具",
            "summary": "导出个人内容包，当前停用。",
            "description": "批量导出作品、博客、随记，支持多种格式。",
            "status": "disabled",
            "script_key": "content_export",
            "script_version": "v0.1.0",
            "input_schema_json": "[]",
        },
        {
            "id": "service_api_proxy",
            "name": "API 代理网关",
            "summary": "统一管理外部 API 调用，提供限流与追踪。",
            "description": "统一管理外部 API 调用，限流、鉴权、日志一体化。",
            "status": "disabled",
            "script_key": "not_integrated",
            "script_version": "v0.2.3",
            "input_schema_json": "[]",
        },
    ]
    for spec in service_specs:
        service = db.get(WorkstationService, spec["id"])
        if service is None:
            db.add(WorkstationService(created_by=admin_id, **spec))
            continue
        for key, value in spec.items():
            setattr(service, key, value)


def _seed_records(db: Session, member_id: str) -> None:
    now = now_utc()
    success = ServiceRequest(
        id="svc_record_001",
        service_request_id="svc_req_seed_success",
        service_id="service_log_auto_submit",
        service_name_snapshot="日志自动提交",
        lumitime_user_id=member_id,
        status="success",
        result_summary="成功提交 3 条学习日志，系统返回确认。",
        student_account_hash="seed_hash",
        student_account_masked="s***@edu.cn",
        task_config_sanitized_json=json.dumps({"target_date": now.date().isoformat()}),
        script_version="v0.1.0-mock",
        started_at=now - timedelta(seconds=5),
        finished_at=now,
        duration_ms=4200,
        created_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=179),
    )
    failure = ServiceRequest(
        id="svc_record_002",
        service_request_id="svc_req_seed_failure",
        service_id="service_log_auto_submit",
        service_name_snapshot="日志自动提交",
        lumitime_user_id=member_id,
        status="failed",
        failure_code="AUTH_FAILED",
        result_summary="账号密码验证失败，无法完成提交。",
        student_account_hash="seed_hash_2",
        student_account_masked="s***@edu.cn",
        task_config_sanitized_json=json.dumps({"target_date": now.date().isoformat()}),
        script_version="v0.1.0-mock",
        started_at=now - timedelta(days=2, seconds=8),
        finished_at=now - timedelta(days=2),
        duration_ms=8100,
        created_at=now - timedelta(days=2),
        expires_at=now + timedelta(days=178),
    )
    db.add_all([success, failure])
    db.add_all(
        [
            ServiceExecutionLog(
                id=prefixed_id("svc_log"),
                service_request_id="svc_req_seed_success",
                sequence=1,
                log_level="info",
                step_name="login",
                message_sanitized="开始登录，账号=s***@edu.cn，password=[REDACTED_PASSWORD]",
                expires_at=success.expires_at,
            ),
            ServiceExecutionLog(
                id=prefixed_id("svc_log"),
                service_request_id="svc_req_seed_failure",
                sequence=1,
                log_level="warn",
                step_name="login",
                message_sanitized="账号密码验证失败，账号=s***@edu.cn，password=[REDACTED_PASSWORD]",
                expires_at=failure.expires_at,
            ),
        ]
    )


def _seed_snapshots(db: Session) -> None:
    today = now_utc().date()
    for idx in range(7):
        day = today - timedelta(days=6 - idx)
        db.add(
            DailyMetricSnapshot(
                id=f"snapshot_{day.isoformat()}",
                snapshot_date=day.isoformat(),
                user_count=2 + idx,
                developer_count=1,
                visit_count=1200 + idx * 150,
                work_count=2,
                script_count=2,
                blog_count=2,
                message_count=2 + idx,
                service_count=2,
            )
        )


def _ensure_seed_attachment_files(db: Session) -> None:
    attachments = db.scalars(select(ContentAttachment).where(ContentAttachment.storage_key.like("seed/%"))).all()
    for attachment in attachments:
        size, checksum = ensure_seed_attachment(attachment.storage_key, attachment.filename)
        if size:
            attachment.file_size = size
            attachment.checksum = checksum
