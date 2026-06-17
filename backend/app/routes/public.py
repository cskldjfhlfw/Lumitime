from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..core import ApiError, created, make_response, paginated, paginate_query, prefixed_id, request_meta
from ..database import get_db
from ..deps import get_current_user_optional
from ..metrics import current_dashboard_totals
from ..models import DailyMetricSnapshot, Message, User
from ..schemas import MessageCreateBody
from ..serializers import message_public, snapshot_public

router = APIRouter(tags=["public"])


@router.get("/messages")
def list_messages(request: Request, page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    statement = select(Message).where(Message.status == "visible", Message.deleted_at.is_(None)).order_by(desc(Message.created_at))
    items, total = paginate_query(db, statement, page, page_size)
    return make_response(paginated([message_public(item) for item in items], total, page, page_size), request=request)


@router.post("/messages")
def create_message(body: MessageCreateBody, request: Request, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    ip_hash, ua = request_meta(request)
    latest = db.scalars(select(Message).where(Message.source_ip_hash == ip_hash).order_by(desc(Message.created_at)).limit(3)).all()
    if len(latest) >= 3:
        # Simple development guard. Production should use Redis or a durable limiter.
        recent_seconds = [(latest[0].created_at - item.created_at).total_seconds() for item in latest[1:]]
        if recent_seconds and max(recent_seconds) < 60:
            raise ApiError("RATE_LIMITED", "提交过于频繁。")
    message = Message(
        id=prefixed_id("msg"),
        nickname=body.nickname.strip(),
        content=body.content.strip(),
        status="visible",
        source_ip_hash=ip_hash,
        user_agent_summary=ua,
    )
    db.add(message)
    db.commit()
    return created(message_public(message), message="留言已发布。", request=request)


@router.get("/dashboard/metrics")
def dashboard_metrics(request: Request, range: str = "7d", db: Session = Depends(get_db)):  # noqa: A002 - API field name.
    days = {"7d": 7, "30d": 30, "90d": 90}.get(range, 7)
    snapshots = list(db.scalars(select(DailyMetricSnapshot).order_by(desc(DailyMetricSnapshot.snapshot_date)).limit(days)).all())
    snapshots.reverse()
    totals = current_dashboard_totals(db)
    daily_changes = [snapshot_public(snapshot) for snapshot in snapshots]
    today = datetime.now(UTC).date().isoformat()
    if not daily_changes or daily_changes[-1].get("date") != today:
        daily_changes.append({"date": today, **totals})
    daily_changes = daily_changes[-days:]
    return make_response({"totals": totals, "daily_changes": daily_changes}, request=request)
