from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import settings
from .core import ApiError, error_response, make_response, public_request_id
from .db_lifecycle import initialize_database_for_runtime
from .routes import admin, auth, content, public, workstation
from .runner import reconcile_pending_requests_after_startup
from .seed import seed_runtime_data


@asynccontextmanager
async def lifespan(app_: FastAPI):
    initialize_database_for_runtime()
    if settings.demo_seed_enabled:
        seed_runtime_data()
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
