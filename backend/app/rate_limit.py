from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from time import monotonic

from fastapi import Request

from .core import ApiError, request_meta


@dataclass(frozen=True)
class RateLimit:
    max_attempts: int
    window_seconds: float


_BUCKETS: defaultdict[str, deque[float]] = defaultdict(deque)
MAX_RATE_LIMIT_BUCKETS = 20_000


def rate_limit_key(request: Request, *parts: str) -> str:
    ip_hash, _ = request_meta(request)
    bucket_parts = [part.lower().strip() for part in parts if part.strip()]
    bucket_parts.append(ip_hash or "unknown")
    return ":".join(bucket_parts)


def check_rate_limit(key: str, limit: RateLimit, message: str = "请求过于频繁，请稍后再试。") -> None:
    now = monotonic()
    _prune_buckets(now, limit.window_seconds)
    attempts = _BUCKETS[key]
    while attempts and now - attempts[0] > limit.window_seconds:
        attempts.popleft()
    if len(attempts) >= limit.max_attempts:
        raise ApiError("RATE_LIMITED", message)
    attempts.append(now)
    _prune_buckets(now, limit.window_seconds)


def reset_rate_limit(key: str) -> None:
    _BUCKETS.pop(key, None)


def _prune_buckets(now: float, window_seconds: float) -> None:
    stale_keys = [
        key
        for key, attempts in _BUCKETS.items()
        if not attempts or now - attempts[-1] > window_seconds
    ]
    for key in stale_keys:
        _BUCKETS.pop(key, None)

    overflow = len(_BUCKETS) - MAX_RATE_LIMIT_BUCKETS
    if overflow <= 0:
        return

    oldest_keys = sorted(
        _BUCKETS,
        key=lambda bucket_key: _BUCKETS[bucket_key][-1] if _BUCKETS[bucket_key] else 0,
    )
    for key in oldest_keys[:overflow]:
        _BUCKETS.pop(key, None)
