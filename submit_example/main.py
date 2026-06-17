from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator, model_validator

from app.deepseek_sxrz import SXRZ_MAX_HAN, generate_internship_log_via_deepseek
from app.han_text import count_han_chars, truncate_to_max_han
from app.log_library import draw_random_entries
from app.orchestrator_stub import execute_stub

_REPO_ROOT = Path(__file__).resolve().parents[2]
_STATIC = Path(__file__).resolve().parents[1] / "static"
_LOG_DIR = _REPO_ROOT / "logs"


def _utc_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _setup_file_logging() -> None:
    _LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = _LOG_DIR / "mvp.log"
    root = logging.getLogger()
    if root.handlers:
        return
    root.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setFormatter(fmt)
    root.addHandler(fh)
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    root.addHandler(ch)
    logging.info("日志文件：%s", log_path)


_setup_file_logging()
log = logging.getLogger("mvp")

app = FastAPI(title="日志填报 MVP（本地）", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LocalSubmitBody(BaseModel):
    """教务登录、姓名、实习日志；可选 DeepSeek 根据派出所记事自动生成 SXRZ。"""

    jw_username: str = Field(min_length=1)
    jw_password: str = Field(min_length=1)
    display_name: str = Field(min_length=1, description="姓名")
    sxrz_text: str | None = Field(
        default=None,
        max_length=8000,
        description="手写实习日志正文；若使用 DeepSeek 生成可留空",
    )
    station_activity_text: str | None = Field(
        default=None,
        max_length=8000,
        description="今日在派出所所做事情的简要纪要，供大模型扩写",
    )
    deepseek_api_key: str | None = Field(
        default=None,
        max_length=256,
        description="DeepSeek API Key（Bearer），仅本次请求使用不入库",
    )
    deepseek_base_url: str = Field(
        default="https://api.deepseek.com",
        max_length=256,
        description="OpenAI 兼容网关，默认官方",
    )
    deepseek_model: str = Field(
        default="deepseek-chat",
        max_length=64,
        description="对话模型名",
    )
    log_dates: list[date] = Field(
        min_length=1,
        description="在日历上勾选的提交日，对应各日 BGRQ；可多天，服务端去重后按日期升序提交",
    )
    pacing_total_sec: float = Field(
        default=0.0,
        ge=0.0,
        le=7200.0,
        description="教务多日提交总等待秒数，在相邻两日之间均分 sleep；0 不等待；单日时在首日请求前 sleep 整段",
    )
    request_spacing_sec: float = Field(
        default=0.0,
        ge=0.0,
        le=120.0,
        description="同一日内相邻教务 XHR（getCurrentTask→doInitForm→doSave）之间的 sleep 秒数，减轻瞬时压力；0 不等待",
    )

    @field_validator("log_dates", mode="after")
    @classmethod
    def _unique_sort_cap(cls, v: list[date]) -> list[date]:
        u = sorted(set(v))
        if not u:
            raise ValueError("至少选择一个日期")
        if len(u) > 31:
            raise ValueError("最多 31 个不重复日期")
        return u

    @field_validator("deepseek_base_url", mode="before")
    @classmethod
    def _default_deepseek_url(cls, v: Any) -> str:
        if v is None:
            return "https://api.deepseek.com"
        s = str(v).strip()
        return s if s else "https://api.deepseek.com"

    @model_validator(mode="after")
    def _sxrz_or_deepseek(self) -> LocalSubmitBody:
        sx = (self.sxrz_text or "").strip()
        act = (self.station_activity_text or "").strip()
        key = (self.deepseek_api_key or "").strip()
        if act and key:
            return self
        if sx:
            return self
        if not act and not key:
            return self
        raise ValueError(
            "使用大模型时需同时填写「今日派出所记事」与 DeepSeek API Key；"
            "或改为只填写「实习日志正文」手写；或清空记事与 Key，由系统从 data/日志库.txt 为每个提交日各随机抽取一条。"
        )


class TaskCreateResponse(BaseModel):
    task_id: str
    status: str


class TaskView(BaseModel):
    task_id: str
    status: str
    step: str | None = None
    error_message: str | None = None


_tasks: dict[str, dict[str, Any]] = {}
_tasks_lock = asyncio.Lock()


def _sse(data: dict[str, Any], event: str = "log") -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _append_event(task_id: str, payload: dict[str, Any]) -> None:
    async with _tasks_lock:
        t = _tasks.get(task_id)
        if not t:
            return
        t["events"].append(payload)


async def _run_task(task_id: str) -> None:
    async def emit(ev: dict[str, Any]) -> None:
        row = {
            "ts": _utc_iso(),
            "level": ev.get("level", "info"),
            "step": ev["step"],
            "message": ev["message"],
            "detail": ev.get("detail"),
        }
        await _append_event(task_id, row)

    try:
        async with _tasks_lock:
            t = _tasks[task_id]
            p: dict[str, Any] = dict(t.get("payload") or {})
            t["status"] = "running"
            t["step"] = "orchestrator"

        act = str(p.get("station_activity_text") or "").strip()
        key = str(p.get("deepseek_api_key") or "").strip()
        base = str(p.get("deepseek_base_url") or "https://api.deepseek.com").strip()
        model = str(p.get("deepseek_model") or "deepseek-chat").strip()
        sx_in = str(p.get("sxrz_text") or "").strip()

        raw_ld = p.get("log_dates") or []
        log_dates: list[date] = []
        for x in raw_ld:
            if isinstance(x, date):
                log_dates.append(x)
            elif isinstance(x, str) and x.strip():
                log_dates.append(date.fromisoformat(x.strip()[:10]))
        log_dates = sorted(set(log_dates))
        if not log_dates:
            raise ValueError("log_dates 为空")

        req_space = float(p.get("request_spacing_sec") or 0.0)

        sxrz_by_bgrq: dict[str, str] | None = None

        if act and key:
            await emit(
                {
                    "level": "info",
                    "step": "llm_sxrz",
                    "message": "正在调用 DeepSeek 生成实习日志（字数由提示词约束，提交时不截断）…",
                    "detail": {"base_url": base, "model": model, "activity_chars": len(act)},
                }
            )
            raw = await asyncio.to_thread(
                generate_internship_log_via_deepseek,
                activity=act,
                api_key=key,
                base_url=base,
                model=model,
                log_dates=log_dates,
            )
            text = raw.strip()
            hc_llm = count_han_chars(text)
            detail_llm: dict[str, Any] = {
                "han_chars": hc_llm,
                "preview": text[:400],
            }
            if hc_llm > SXRZ_MAX_HAN:
                detail_llm["over_prompt_max_han"] = True
                detail_llm["note"] = (
                    f"汉字数 {hc_llm} 已超过提示中的上限 {SXRZ_MAX_HAN}，"
                    "服务端未截断；若教务保存失败请缩短记事或改写后重试。"
                )
            await emit(
                {
                    "level": "warn" if hc_llm > SXRZ_MAX_HAN else "info",
                    "step": "llm_sxrz",
                    "message": "DeepSeek 生成完成，正文原样用于提交（未做截断）",
                    "detail": detail_llm,
                }
            )
        elif sx_in:
            text = truncate_to_max_han(sx_in, 500)
            await emit(
                {
                    "level": "info",
                    "step": "sxrz_manual",
                    "message": "使用手写实习日志正文（各提交日相同）",
                    "detail": {"han_chars": count_han_chars(text), "preview": text[:240]},
                }
            )
        else:
            pairs, lib_total = await asyncio.to_thread(draw_random_entries, len(log_dates))
            sxrz_by_bgrq = {}
            per_day: list[dict[str, Any]] = []
            for d, (raw, pick_idx) in zip(log_dates, pairs):
                bgrq = d.isoformat()
                t = truncate_to_max_han(raw.strip(), 500)
                sxrz_by_bgrq[bgrq] = t
                per_day.append(
                    {
                        "BGRQ": bgrq,
                        "library_pick_1based": pick_idx,
                        "han_chars": count_han_chars(t),
                        "preview": t[:160],
                    }
                )
            text = next(iter(sxrz_by_bgrq.values()))  # 占位，多日时用 sxrz_by_bgrq
            await emit(
                {
                    "level": "info",
                    "step": "log_library",
                    "message": (
                        f"已从 data/日志库.txt 为 {len(log_dates)} 个提交日各随机抽取一条（未调用大模型）"
                    ),
                    "detail": {
                        "library_total": lib_total,
                        "days": per_day,
                        "request_spacing_sec": req_space,
                    },
                },
            )

        han = (
            max(count_han_chars(v) for v in sxrz_by_bgrq.values())
            if sxrz_by_bgrq
            else count_han_chars(text)
        )
        async with _tasks_lock:
            t = _tasks[task_id]
            t["confirmed_text"] = text
            t["han_char_count"] = han
            pl = t.get("payload")
            if isinstance(pl, dict):
                pl.pop("deepseek_api_key", None)

        sn = str(p.get("jw_username", "")).strip()

        pace = float(p.get("pacing_total_sec") or 0)

        await execute_stub(
            jw_username=str(p.get("jw_username", "")).strip(),
            jw_password=str(p.get("jw_password", "")),
            confirmed_text_han=han,
            emit=emit,
            student_no=sn,
            display_name=str(p.get("display_name", "")).strip(),
            sxrz_text=text if sxrz_by_bgrq is None else "",
            sxrz_by_bgrq=sxrz_by_bgrq,
            log_dates=log_dates,
            pacing_total_sec=pace,
            request_spacing_sec=req_space,
        )

        async with _tasks_lock:
            _tasks[task_id]["status"] = "success"
            _tasks[task_id]["step"] = "done"
            _tasks[task_id]["finished"] = True
            done_payload = {"status": "success", "task_id": task_id}
            _tasks[task_id]["events"].append({"event": "done", "data": done_payload})
        log.info("task %s success", task_id)
    except Exception as e:  # noqa: BLE001 — MVP 兜底
        log.exception("task %s failed", task_id)
        async with _tasks_lock:
            if task_id in _tasks:
                _tasks[task_id]["status"] = "failed"
                _tasks[task_id]["error_message"] = str(e)
                _tasks[task_id]["finished"] = True
                _tasks[task_id]["events"].append(
                    {
                        "event": "done",
                        "data": {"status": "failed", "task_id": task_id, "error": str(e)},
                    }
                )


@app.get("/api/v1/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/tasks", response_model=TaskCreateResponse)
async def create_task(body: LocalSubmitBody) -> TaskCreateResponse:
    """教务账号密码、学号姓名、实习日志正文与所选日历日列表；doSave 固定字段由服务端写入。"""
    task_id = str(uuid.uuid4())
    async with _tasks_lock:
        _tasks[task_id] = {
            "status": "queued",
            "step": None,
            "events": [],
            "finished": False,
            "error_message": None,
            "jw_username": body.jw_username,
            "payload": body.model_dump(),
        }
    asyncio.create_task(_run_task(task_id))
    log.info("queued task %s user=%s", task_id, body.jw_username[:1] + "***")
    return TaskCreateResponse(task_id=task_id, status="queued")


@app.get("/api/v1/tasks/{task_id}", response_model=TaskView)
async def get_task(task_id: str) -> TaskView:
    async with _tasks_lock:
        t = _tasks.get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="task not found")
    return TaskView(
        task_id=task_id,
        status=t["status"],
        step=t.get("step"),
        error_message=t.get("error_message"),
    )


@app.get("/api/v1/tasks/{task_id}/events")
async def task_events(task_id: str) -> StreamingResponse:
    async with _tasks_lock:
        if task_id not in _tasks:
            raise HTTPException(status_code=404, detail="task not found")

    async def gen():
        idx = 0
        while True:
            async with _tasks_lock:
                t = _tasks.get(task_id)
                if not t:
                    break
                events = t["events"]
                while idx < len(events):
                    ev = events[idx]
                    idx += 1
                    if isinstance(ev.get("event"), str) and ev["event"] == "done":
                        yield _sse(ev["data"], event="done")
                        return
                    yield _sse(
                        {
                            "ts": ev["ts"],
                            "level": ev["level"],
                            "step": ev["step"],
                            "message": ev["message"],
                            "detail": ev.get("detail"),
                        },
                        event="log",
                    )
                finished = t.get("finished", False)
            if finished and idx >= len(events):
                break
            await asyncio.sleep(0.12)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/")
async def index() -> FileResponse:
    html = _STATIC / "index.html"
    if not html.is_file():
        raise HTTPException(status_code=500, detail="static/index.html missing")
    return FileResponse(html)
