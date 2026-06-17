from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class LoginBody(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=200)


class BootstrapAdminBody(BaseModel):
    bootstrap_token: str = Field(min_length=16, max_length=512)
    username: str = Field(min_length=3, max_length=80)
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=10, max_length=200)


class RegisterWithInviteBody(BaseModel):
    invite_code: str = Field(min_length=4, max_length=64)
    username: str = Field(min_length=3, max_length=80)
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=6, max_length=200)


class ChangePasswordBody(BaseModel):
    old_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=6, max_length=200)


class CreateInviteBody(BaseModel):
    usage_limit: int = Field(default=1, ge=1, le=100)
    expires_at: datetime | None = None
    remark: str | None = Field(default=None, max_length=255)


class ResetPasswordBody(BaseModel):
    new_password: str = Field(min_length=6, max_length=200)


class ContentCreateBody(BaseModel):
    type: str = Field(pattern="^(script|work|blog)$")
    title: str = Field(min_length=1, max_length=200)
    summary: str | None = None
    body: str | None = None
    code: str | None = None
    language: str | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    status: str = Field(default="draft", pattern="^(draft|published|unpublished)$")
    allow_copy: bool = True


class ContentPatchBody(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    summary: str | None = None
    body: str | None = None
    code: str | None = None
    language: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    status: str | None = Field(default=None, pattern="^(draft|published|unpublished)$")
    allow_copy: bool | None = None


class AttachmentPatchBody(BaseModel):
    allow_download: bool


class MessageCreateBody(BaseModel):
    nickname: str = Field(min_length=1, max_length=30)
    content: str = Field(min_length=1, max_length=500)


class ServiceCreateBody(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    summary: str | None = None
    description: str | None = None
    status: str = Field(default="enabled", pattern="^(enabled|disabled)$")
    script_key: str | None = None
    script_version: str | None = None
    input_schema: list[dict[str, Any]] = Field(default_factory=list)


class ServicePatchBody(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    summary: str | None = None
    description: str | None = None
    status: str | None = Field(default=None, pattern="^(enabled|disabled)$")
    script_key: str | None = None
    script_version: str | None = None
    input_schema: list[dict[str, Any]] | None = None


class ServiceRequestCreateBody(BaseModel):
    model_config = ConfigDict(extra="allow")

    student_account: str = Field(min_length=1, max_length=160)
    student_password: str = Field(min_length=1, max_length=256)
    task_config: dict[str, Any] = Field(default_factory=dict)


class ServiceRetryBody(BaseModel):
    student_account: str = Field(min_length=1, max_length=160)
    student_password: str = Field(min_length=1, max_length=256)
    task_config: dict[str, Any] | None = None
