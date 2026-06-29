from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import write_audit
from ..core import ApiError, make_response, paginated, paginate_query
from ..database import get_db
from ..deps import require_invited_or_admin
from ..models import ContentAttachment, ContentItem, User
from ..serializers import content_public
from ..storage import resolve_storage_key

router = APIRouter(tags=["content"])

TYPE_ROUTE = {
    "scripts": "script",
    "works": "work",
    "blogs": "blog",
}


def _list_content(kind: str, request: Request, page: int, page_size: int, keyword: str | None, db: Session, user: User):
    content_type = TYPE_ROUTE[kind]
    statement = select(ContentItem).where(
        ContentItem.type == content_type,
        ContentItem.status == "published",
        ContentItem.deleted_at.is_(None),
    ).order_by(ContentItem.updated_at.desc())
    if keyword:
        statement = statement.where(ContentItem.title.contains(keyword))
    items, total = paginate_query(db, statement, page, page_size)
    return make_response(paginated([content_public(item, admin=user.role == "admin") for item in items], total, page, page_size), request=request)


def _detail_content(kind: str, content_id: str, request: Request, db: Session, user: User):
    content_type = TYPE_ROUTE[kind]
    item = db.scalar(
        select(ContentItem).where(
            ContentItem.id == content_id,
            ContentItem.type == content_type,
            ContentItem.status == "published",
            ContentItem.deleted_at.is_(None),
        )
    )
    if item is None:
        raise ApiError("NOT_FOUND", "内容不存在。")
    return make_response(content_public(item, detail=True, admin=user.role == "admin"), request=request)


@router.get("/scripts")
def list_scripts(request: Request, page: int = 1, page_size: int = 20, keyword: str | None = None, db: Session = Depends(get_db), user: User = Depends(require_invited_or_admin)):
    return _list_content("scripts", request, page, page_size, keyword, db, user)


@router.get("/scripts/{script_id}")
def script_detail(script_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(require_invited_or_admin)):
    return _detail_content("scripts", script_id, request, db, user)


@router.get("/works")
def list_works(request: Request, page: int = 1, page_size: int = 20, keyword: str | None = None, db: Session = Depends(get_db), user: User = Depends(require_invited_or_admin)):
    return _list_content("works", request, page, page_size, keyword, db, user)


@router.get("/works/{work_id}")
def work_detail(work_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(require_invited_or_admin)):
    return _detail_content("works", work_id, request, db, user)


@router.get("/works/{work_id}/attachments/{attachment_id}/download")
def download_attachment(work_id: str, attachment_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(require_invited_or_admin)):
    statement = select(ContentItem).where(
        ContentItem.id == work_id,
        ContentItem.type == "work",
        ContentItem.deleted_at.is_(None),
    )
    if user.role != "admin":
        statement = statement.where(ContentItem.status == "published")
    work = db.scalar(statement)
    if work is None:
        raise ApiError("NOT_FOUND", "作品不存在。")
    attachment = db.scalar(
        select(ContentAttachment).where(
            ContentAttachment.id == attachment_id,
            ContentAttachment.content_id == work_id,
            ContentAttachment.deleted_at.is_(None),
        )
    )
    if attachment is None:
        raise ApiError("NOT_FOUND", "附件不存在。")
    if user.role != "admin" and not attachment.allow_download:
        raise ApiError("FORBIDDEN", "该附件暂不开放下载。")
    path = resolve_storage_key(attachment.storage_key)
    if path is None or not path.is_file():
        raise ApiError("NOT_FOUND", "附件文件不存在。")
    write_audit(db, request=request, actor=user, action="download_attachment", resource_type="content_attachment", resource_id=attachment.id)
    db.commit()
    return FileResponse(
        path,
        media_type=attachment.file_type or "application/octet-stream",
        filename=attachment.filename,
        headers={"X-Content-Type-Options": "nosniff"},
        content_disposition_type="attachment",
    )


@router.get("/blogs")
def list_blogs(request: Request, page: int = 1, page_size: int = 20, keyword: str | None = None, db: Session = Depends(get_db), user: User = Depends(require_invited_or_admin)):
    return _list_content("blogs", request, page, page_size, keyword, db, user)


@router.get("/blogs/{blog_id}")
def blog_detail(blog_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(require_invited_or_admin)):
    return _detail_content("blogs", blog_id, request, db, user)
