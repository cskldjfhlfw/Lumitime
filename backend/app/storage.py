from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path

from .config import settings


SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._\-\u4e00-\u9fff]+")


def upload_root() -> Path:
    root = settings.upload_dir
    if not root.is_absolute():
        root = Path.cwd() / root
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def safe_filename(filename: str | None) -> str:
    name = Path(filename or "attachment.bin").name.strip() or "attachment.bin"
    return SAFE_FILENAME_RE.sub("_", name)[:180]


def store_attachment_bytes(attachment_id: str, filename: str, content: bytes) -> tuple[str, str, int, str]:
    digest = hashlib.sha256(content).hexdigest()
    stored_name = safe_filename(filename)
    relative = Path("attachments") / attachment_id / stored_name
    target = upload_root() / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return relative.as_posix(), stored_name, len(content), digest


def resolve_storage_key(storage_key: str) -> Path | None:
    root = upload_root()
    target = (root / storage_key).resolve()
    try:
        if os.path.commonpath([str(root), str(target)]) != str(root):
            return None
    except ValueError:
        return None
    return target


def ensure_seed_attachment(storage_key: str, filename: str) -> tuple[int, str]:
    target = resolve_storage_key(storage_key)
    if target is None:
        return 0, ""
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(f"Lumitime seed attachment: {filename}\n".encode("utf-8"))
    content = target.read_bytes()
    return len(content), hashlib.sha256(content).hexdigest()
