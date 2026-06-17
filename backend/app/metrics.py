from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import AuditLog, ContentItem, Message, User, WorkstationService


def current_dashboard_totals(db: Session) -> dict[str, int]:
    return {
        "user_count": db.scalar(select(func.count()).select_from(User).where(User.deleted_at.is_(None))) or 0,
        "developer_count": db.scalar(select(func.count()).select_from(User).where(User.role == "admin", User.deleted_at.is_(None))) or 0,
        "visit_count": db.scalar(select(func.count()).select_from(AuditLog)) or 0,
        "work_count": db.scalar(select(func.count()).select_from(ContentItem).where(ContentItem.type == "work", ContentItem.status == "published", ContentItem.deleted_at.is_(None))) or 0,
        "script_count": db.scalar(select(func.count()).select_from(ContentItem).where(ContentItem.type == "script", ContentItem.status == "published", ContentItem.deleted_at.is_(None))) or 0,
        "blog_count": db.scalar(select(func.count()).select_from(ContentItem).where(ContentItem.type == "blog", ContentItem.status == "published", ContentItem.deleted_at.is_(None))) or 0,
        "message_count": db.scalar(select(func.count()).select_from(Message).where(Message.deleted_at.is_(None), Message.status == "visible")) or 0,
        "service_count": db.scalar(select(func.count()).select_from(WorkstationService).where(WorkstationService.deleted_at.is_(None), WorkstationService.status == "enabled")) or 0,
    }
