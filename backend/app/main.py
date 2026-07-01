from __future__ import annotations

import hmac
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import settings
from .core import ApiError, error_response, make_response, public_request_id
from .db_lifecycle import initialize_database_for_runtime
from .rate_limit import RateLimit, check_rate_limit, rate_limit_key
from .routes import admin, auth, content, public, workstation
from .runner import reconcile_pending_requests_after_startup
from .seed import seed_runtime_data, seed_runtime_workstation_services


CSRF_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
GLOBAL_API_RATE_LIMIT = RateLimit(max_attempts=900, window_seconds=60.0)
CSRF_EXEMPT_PATHS = {
    f"{settings.api_prefix}/auth/bootstrap-admin",
    f"{settings.api_prefix}/auth/login",
    f"{settings.api_prefix}/auth/register-with-invite",
    f"{settings.api_prefix}/health",
    "/health",
}


def _csrf_tokens_match(csrf_cookie: str, csrf_header: str) -> bool:
    return hmac.compare_digest(csrf_cookie.encode("utf-8"), csrf_header.encode("utf-8"))


@asynccontextmanager
async def lifespan(app_: FastAPI):
    initialize_database_for_runtime()
    if settings.demo_seed_enabled:
        seed_runtime_data()
    else:
        seed_runtime_workstation_services()
    reconcile_pending_requests_after_startup()
    yield


app = FastAPI(title="Lumitime API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request.state.request_id = request.headers.get("x-request-id") or public_request_id()
    response = await call_next(request)
    response.headers["x-request-id"] = request.state.request_id
    return response


@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    if (
        request.method.upper() not in CSRF_SAFE_METHODS
        and request.url.path not in CSRF_EXEMPT_PATHS
        and request.cookies.get(settings.session_cookie_name)
    ):
        csrf_cookie = request.cookies.get(settings.csrf_cookie_name)
        csrf_header = request.headers.get("x-csrf-token")
        if not csrf_cookie or not csrf_header or not _csrf_tokens_match(csrf_cookie, csrf_header):
            return error_response(request, "FORBIDDEN", "CSRF 校验失败。", 403)
    return await call_next(request)


@app.middleware("http")
async def global_rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith(settings.api_prefix):
        try:
            check_rate_limit(rate_limit_key(request, "global"), GLOBAL_API_RATE_LIMIT)
        except ApiError as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            return error_response(
                request,
                detail.get("code", "RATE_LIMITED"),
                detail.get("message", "请求过于频繁，请稍后再试。"),
                exc.status_code,
            )
    return await call_next(request)


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    detail = exc.detail if isinstance(exc.detail, dict) else {}
    return error_response(
        request,
        detail.get("code", "BAD_REQUEST"),
        detail.get("message", "请求参数错误。"),
        exc.status_code,
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return error_response(request, "BAD_REQUEST", "请求参数错误。", 400)


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException):
    code = "NOT_FOUND" if exc.status_code == 404 else "BAD_REQUEST"
    message = "资源不存在。" if exc.status_code == 404 else str(exc.detail)
    return error_response(request, code, message, exc.status_code)


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    return error_response(request, "INTERNAL_ERROR", "系统异常，请稍后再试。", 500)


@app.get("/health")
def health_root():
    return {"status": "ok"}


@app.get(settings.api_prefix + "/health")
def health(request: Request):
    return make_response({"status": "ok"}, request=request)


app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(public.router, prefix=settings.api_prefix)
app.include_router(content.router, prefix=settings.api_prefix)
app.include_router(workstation.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)
