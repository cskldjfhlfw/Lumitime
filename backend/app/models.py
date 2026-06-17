from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .core import now_utc
from .database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(32), index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sessions: Mapped[list[SessionRecord]] = relationship(back_populates="user", cascade="all, delete-orphan")


class SessionRecord(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    user: Mapped[User] = relationship(back_populates="sessions")


class InviteCode(Base, TimestampMixin):
    __tablename__ = "invite_codes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    usage_limit: Mapped[int] = mapped_column(Integer, default=1)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remark: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)

    usages: Mapped[list[InviteCodeUsage]] = relationship(back_populates="invite", cascade="all, delete-orphan")


class InviteCodeUsage(Base):
    __tablename__ = "invite_code_usages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    invite_code_id: Mapped[str] = mapped_column(ForeignKey("invite_codes.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)
    source_ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent_summary: Mapped[str | None] = mapped_column(String(180), nullable=True)

    invite: Mapped[InviteCode] = relationship(back_populates="usages")


class ContentItem(Base, TimestampMixin):
    __tablename__ = "content_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    type: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    code: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(80), nullable=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    tags_json: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    visibility: Mapped[str] = mapped_column(String(32), default="invited_only")
    allow_copy: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    attachments: Mapped[list[ContentAttachment]] = relationship(back_populates="content", cascade="all, delete-orphan")


class ContentAttachment(Base, TimestampMixin):
    __tablename__ = "content_attachments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    content_id: Mapped[str] = mapped_column(ForeignKey("content_items.id"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    storage_key: Mapped[str] = mapped_column(String(255))
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    allow_download: Mapped[int] = mapped_column(Integer, default=0, index=True)
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    content: Mapped[ContentItem] = relationship(back_populates="attachments")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    nickname: Mapped[str] = mapped_column(String(80))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="visible", index=True)
    source_ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    user_agent_summary: Mapped[str | None] = mapped_column(String(180), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)
    moderated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    moderated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WorkstationService(Base, TimestampMixin):
    __tablename__ = "workstation_services"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="enabled", index=True)
    service_type: Mapped[str] = mapped_column(String(32), default="automation")
    script_key: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    script_version: Mapped[str | None] = mapped_column(String(80), nullable=True)
    input_schema_json: Mapped[str] = mapped_column(Text, default="[]")
    result_display_mode: Mapped[str] = mapped_column(String(32), default="summary_only")
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ServiceRequest(Base):
    __tablename__ = "service_requests"
    __table_args__ = (UniqueConstraint("service_request_id", name="uq_service_request_public_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    service_request_id: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    service_id: Mapped[str] = mapped_column(ForeignKey("workstation_services.id"), index=True)
    service_name_snapshot: Mapped[str] = mapped_column(String(160))
    lumitime_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    failure_code: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    result_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    student_account_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    student_account_masked: Mapped[str | None] = mapped_column(String(120), nullable=True)
    task_config_sanitized_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_of_service_request_id: Mapped[str | None] = mapped_column(String(96), nullable=True)
    script_version: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent_summary: Mapped[str | None] = mapped_column(String(180), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class ServiceExecutionLog(Base):
    __tablename__ = "service_execution_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    service_request_id: Mapped[str] = mapped_column(String(96), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    log_level: Mapped[str] = mapped_column(String(20), default="info")
    step_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    message_sanitized: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    actor_role: Mapped[str] = mapped_column(String(32), default="visitor")
    action: Mapped[str] = mapped_column(String(80), index=True)
    resource_type: Mapped[str] = mapped_column(String(80), index=True)
    resource_id: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    result: Mapped[str] = mapped_column(String(32), default="success")
    metadata_sanitized_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    service_request_id: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    source_ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent_summary: Mapped[str | None] = mapped_column(String(180), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)


class DailyMetricSnapshot(Base):
    __tablename__ = "daily_metric_snapshots"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    snapshot_date: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    user_count: Mapped[int] = mapped_column(Integer, default=0)
    developer_count: Mapped[int] = mapped_column(Integer, default=0)
    visit_count: Mapped[int] = mapped_column(Integer, default=0)
    work_count: Mapped[int] = mapped_column(Integer, default=0)
    script_count: Mapped[int] = mapped_column(Integer, default=0)
    blog_count: Mapped[int] = mapped_column(Integer, default=0)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    service_count: Mapped[int] = mapped_column(Integer, default=0)
    deltas_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
