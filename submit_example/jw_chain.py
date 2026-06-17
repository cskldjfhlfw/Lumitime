"""
教务 H5 链：app/index（固定 fid，姓名 URL 编码）→ h5 → 按所选日历日列表循环：
getCurrentTask → doInitForm → 组装 doSave（固定 XNXQ/BX/小队等，BGRQ 为所选日，OPERATETIME 为提交时刻）→ POST。

authorization：来自 app/index 响应 Set-Cookie（Path=/h5/index.html），再作为请求头 authorization 调用 /je/*。
"""

from __future__ import annotations

import re
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlencode

import requests
from zoneinfo import ZoneInfo

_REPO = Path(__file__).resolve().parents[2]
_DOSAVE_TEMPLATE = _REPO / "url梳理" / "dosave.txt"

JW_MOBILE_UA = (
    "Mozilla/5.0 (Linux; Android 16; V2227A Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36 "
    "(device:V2227A) Language/zh_CN com.chaoxing.mobile.xuezaijingda/"
    "ChaoXingStudy_1000242_6.1_android_phone_1037_220 (@Kalimdor)_c72b95198a5a4cf9b84341abc174fc39"
)
APKID = "5JyLdMXpU38jlyq2XjZ"

JW_FID_FIXED = "39012"

# 教务 XNXQ：两学年各四位数字直接拼接 + "-" + 学期段，如 20252026-2。
# 若写成「2025-2026-2」，服务端可能存/展为错误代码；POST 前会强制规范化为下列常量。
XNXQ_CODE = "20252026-2"
_XNXQ_HYPHENATED_YEARS = re.compile(r"^(\d{4})-(\d{4})-(\d+)$")


def _canonical_xnxq(raw: str) -> str:
    """将「2025-2026-2」纠正为教务代码「20252026-2」；已是正确格式则原样返回。"""
    v = (raw or "").strip()
    if not v:
        return XNXQ_CODE
    m = _XNXQ_HYPHENATED_YEARS.fullmatch(v)
    if m:
        return f"{m.group(1)}{m.group(2)}-{m.group(3)}"
    return v


# 与 url梳理/dosave.txt 一致：下列键为教务侧「固定」值（不随个人/当日/接口回填变化）。
# 勿包含：XSXM、XSXH、SXRZ、BGRQ、OPERATETIME、SXJXRW_ID、XY_ID、OPERATERCODE、SY_CREATEUSERID、SY_CREATEUSER、SY_CREATEUSERNAME
FIXED_FORM_BUSINESS: dict[str, str] = {
    "XNXQ": XNXQ_CODE,
    "XSDB": "1",
    "BX": "智慧警务学院",
    "SXLXMC": "",
    "XYD_NAME": "智慧警务二队",
    "XYD_COED": "1032010",
    "SXLX": "07",
    "SXXSDT": "1",
    "QKSM": "",
    "SFZYXG": "1",
    "SFYC": "1",
    "FJ": "",
    "JB": "",
    "TJZT": "1",
    "SY_AUDFLAG": "NOSTATUS",
    "ID": "",
    "SY_PIID": "",
    "SY_PDID": "",
    "SY_STARTEDUSER": "",
    "SY_STARTEDUSERNAME": "",
    "SY_APPROVEDUSERS": "",
    "SY_APPROVEDUSERNAMES": "",
    "SY_LASTFLOWINFO": "",
    "SY_PREAPPROVUSERS": "",
    "SY_PREAPPROVUSERNAMES": "",
    "SY_LASTFLOWUSER": "",
    "SY_LASTFLOWUSERID": "",
    "SY_WFWARN": "",
    "DELFLAG": "A",
    "SY_WARNFLAG": "",
    "SY_CURRENTTASK": "",
    "SY_ACKFLAG": "0",
    "SY_ACKUSERNAME": "",
    "SY_ACKUSERID": "",
    "SY_ACKTIME": "",
    "tableCode": "JWBZK.T_JWBZK_SJJX_SXMRBG",
    "codeGenFieldInfo": "[]",
    "__isFunc__": "true",
    "__appid__": "2020-0823-2056-2412",
    "__funcCode__": "copy from T_JWBZK_SJJX_SXMRBG",
}

APP_INDEX_BASE = "https://jw.cppu.edu.cn/je/auth/third/chaoxing/jcdxzhjw/app/index"
H5_INDEX = "https://jw.cppu.edu.cn/h5/index.html"
URL_GET_CURRENT = "https://jw.cppu.edu.cn/je/jbpm/taskInfo/getCurrentTask"
URL_DO_INIT = "https://jw.cppu.edu.cn/je/phone/app/doInitForm"
URL_DO_SAVE = "https://jw.cppu.edu.cn/je/doSave"


def _log(
    step: str,
    message: str,
    level: str = "info",
    detail: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {"level": level, "step": step, "message": message, "detail": detail}


def _append_redirect_history(logs: list[dict[str, Any]], resp: requests.Response) -> None:
    for i, h in enumerate(resp.history):
        logs.append(
            _log(
                "http_redirect",
                f"jw 链重定向 #{i + 1}/{len(resp.history)}",
                detail={
                    "http_status": h.status_code,
                    "url": (h.url or "")[:180],
                    "Location": (h.headers.get("Location") or "")[:180],
                },
            )
        )


def _parse_dosave_template(path: Path) -> list[tuple[str, str]]:
    if not path.is_file():
        raise FileNotFoundError(f"缺少 doSave 模板文件: {path}")
    pairs: list[tuple[str, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line.startswith("Key="):
            continue
        # Key=X; Value=Y
        mk = re.match(r"Key=([^;]+);\s*Value=(.*)$", line)
        if mk:
            pairs.append((mk.group(1).strip(), mk.group(2).strip()))
    return pairs


def _extract_from_responses(blob: str, keys: tuple[str, ...]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k in keys:
        m = re.search(r'["\']?' + re.escape(k) + r'["\']?\s*[:=]\s*["\']([^"\']+)["\']', blob)
        if m:
            out[k] = m.group(1)
        else:
            m2 = re.search(r"\b" + re.escape(k) + r"\b[=:]([A-Za-z0-9._-]+)", blob)
            if m2:
                out[k] = m2.group(1)
    return out


def _dosave_kv_preview(form: dict[str, str], pairs: list[tuple[str, str]]) -> str:
    """按 dosave 模板键顺序生成 Key=…; Value=… 文本，便于与标准抓包对照。"""
    keys_seen: set[str] = set()
    lines: list[str] = []
    for k, _ in pairs:
        if k in form:
            lines.append(f"Key={k}; Value={form[k]}")
            keys_seen.add(k)
    extra = sorted(k for k in form if k not in keys_seen)
    for k in extra:
        lines.append(f"Key={k}; Value={form[k]}")
    return "\n".join(lines)


def _jw_auth_header(session: requests.Session) -> str | None:
    v = session.cookies.get("authorization", domain="jw.cppu.edu.cn")
    if v:
        return v
    for c in session.cookies:
        if c.name == "authorization" and (c.domain and "jw.cppu.edu.cn" in c.domain.replace("www.", "")):
            return c.value
    return session.cookies.get("authorization")


def _jw_xhr_headers(session: requests.Session) -> dict[str, str]:
    h: dict[str, str] = {
        "User-Agent": JW_MOBILE_UA,
        "apkid": APKID,
        "sec-ch-ua-platform": '"Android"',
        "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Android WebView";v="146"',
        "sec-ch-ua-mobile": "?1",
        "sys_security": "1",
        "x-requested-with": "XMLHttpRequest",
        "accept": "application/json, text/plain, */*",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "platform-agent": "AppleWebKit/537.36 (KHTML, like Gecko)",
        "origin": "https://jw.cppu.edu.cn",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "referer": H5_INDEX,
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "priority": "u=1, i",
    }
    auth = _jw_auth_header(session)
    if auth:
        h["authorization"] = auth
    return h


def _sleep_between_requests(
    logs: list[dict[str, Any]],
    spacing_sec: float,
    *,
    after: str,
    day: int,
    n_days: int,
) -> None:
    if spacing_sec <= 0:
        return
    logs.append(
        _log(
            "jw_request_spacing",
            f"请求间隔 sleep {spacing_sec:.2f}s（{after}，第 {day}/{n_days} 日）",
            detail={"seconds": round(spacing_sec, 3), "after": after},
        )
    )
    time.sleep(spacing_sec)


def run_jw_chain(
    session: requests.Session,
    *,
    student_no: str,
    display_name: str,
    sxrz_text: str = "",
    sxrz_by_bgrq: dict[str, str] | None = None,
    log_dates: list[date],
    pacing_total_sec: float = 0.0,
    request_spacing_sec: float = 0.0,
) -> list[dict[str, Any]]:
    """
    使用已含 SSO/超星链路的 session，完成教务入口；对 ``log_dates`` 中每个日历日（已去重、升序）重复 init 并 POST doSave。
    ``OPERATETIME`` 在每次 POST 前按上海时区取当前时刻。
    ``pacing_total_sec``：多日时在相邻两日流程之间平均 sleep；单日时在首日 getCurrentTask 前 sleep 整段时长。
    ``sxrz_by_bgrq``：若提供，则按 ``BGRQ`` 键取当日 ``SXRZ``；否则每日使用 ``sxrz_text``。
    ``request_spacing_sec``：同一日内相邻教务 XHR（getCurrentTask → doInitForm → doSave）之间的 sleep，减轻瞬时压力。
    """
    logs: list[dict[str, Any]] = []
    tz_cn = ZoneInfo("Asia/Shanghai")
    days_sorted = sorted(set(log_dates))
    if not days_sorted:
        raise ValueError("log_dates 不能为空")
    n_days = len(days_sorted)
    pacing = float(pacing_total_sec) if pacing_total_sec and float(pacing_total_sec) > 0 else 0.0
    logs.append(
        _log(
            "jw_schedule",
            f"BGRQ 共 {n_days} 天（已排序）",
            detail={
                "dates": [d.isoformat() for d in days_sorted],
                "pacing_total_sec": pacing,
            },
        )
    )

    q: dict[str, str] = {
        "uid": student_no.strip(),
        "projid": "",
        "role": "3",
        "backurl": "",
        "fid": JW_FID_FIXED,
    }
    query = urlencode(q)
    rn = quote(display_name.strip(), safe="")
    app_url = f"{APP_INDEX_BASE}?{query}&realName={rn}"

    logs.append(_log("jw_app_index", "GET app/index（注入 uid / realName / fid）", detail={"url_tail": app_url[-120:]}))
    r0 = session.get(
        app_url,
        timeout=45,
        allow_redirects=True,
        headers={
            "User-Agent": JW_MOBILE_UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://uc.chaoxing.com/",
            "Upgrade-Insecure-Requests": "1",
            "x-requested-with": "com.chaoxing.mobile.xuezaijingda",
            "sec-fetch-site": "none",
            "sec-fetch-mode": "navigate",
            "sec-fetch-user": "?1",
            "sec-fetch-dest": "document",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "zh-CN,zh;q=0.9",
        },
    )
    _append_redirect_history(logs, r0)
    sc = r0.headers.get("Set-Cookie", "")
    logs.append(
        _log(
            "jw_app_index",
            f"app/index 响应 http_status={r0.status_code}",
            detail={
                "bytes": len(r0.content or b""),
                "Set-Cookie_contains_authorization": ("authorization=" in sc),
                "final_url": (r0.url or "")[:200],
            },
        )
    )
    if r0.status_code != 200:
        logs.append(_log("jw_app_index", "app/index 非 200，后续可能失败", "warn", detail={}))
    auth = _jw_auth_header(session)
    logs.append(
        _log(
            "jw_authorization",
            "authorization 头/ Cookie 状态",
            detail={"present": bool(auth), "len": len(auth or "")},
        )
    )

    logs.append(_log("jw_h5", "GET h5/index.html"))
    r1 = session.get(
        H5_INDEX,
        timeout=30,
        allow_redirects=True,
        headers={
            "User-Agent": JW_MOBILE_UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Upgrade-Insecure-Requests": "1",
            "x-requested-with": "com.chaoxing.mobile.xuezaijingda",
            "Referer": app_url[:200],
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "navigate",
            "sec-fetch-user": "?1",
            "sec-fetch-dest": "document",
        },
    )
    _append_redirect_history(logs, r1)
    logs.append(
        _log(
            "jw_h5",
            f"h5 响应 http_status={r1.status_code}",
            detail={"bytes": len(r1.content or b""), "final_url": (r1.url or "")[:160]},
        )
    )

    hdr = _jw_xhr_headers(session)
    pairs = _parse_dosave_template(_DOSAVE_TEMPLATE)
    keys_from_api = (
        "SXJXRW_ID",
        "XY_ID",
        "OPERATERCODE",
        "SY_CREATEUSERID",
    )

    if pacing > 0 and n_days >= 2:
        per_between = pacing / (n_days - 1)
        logs.append(
            _log(
                "jw_pacing",
                f"节奏：总等待 {pacing:.1f}s，在 {n_days - 1} 个日期间隔内均分，每次约 {per_between:.2f}s",
                detail={
                    "pacing_total_sec": pacing,
                    "gaps": n_days - 1,
                    "sleep_per_gap_sec": round(per_between, 3),
                },
            )
        )
    elif pacing > 0 and n_days == 1:
        logs.append(
            _log(
                "jw_pacing",
                f"节奏：单日提交前等待 {pacing:.1f}s",
                detail={"pacing_total_sec": pacing, "sleep_per_gap_sec": pacing},
            )
        )

    spacing = float(request_spacing_sec) if request_spacing_sec and float(request_spacing_sec) > 0 else 0.0
    if spacing > 0:
        logs.append(
            _log(
                "jw_request_spacing",
                f"已启用日内请求间隔：相邻 XHR 之间 sleep {spacing:.2f}s",
                detail={"request_spacing_sec": spacing},
            )
        )

    for di, day in enumerate(days_sorted):
        bgrq = day.strftime("%Y-%m-%d")

        if pacing > 0 and n_days == 1 and di == 0:
            logs.append(_log("jw_pacing", f"sleep {pacing:.2f}s（单日总预算）", detail={"seconds": pacing}))
            time.sleep(pacing)
        elif pacing > 0 and n_days >= 2 and di > 0:
            per_between = pacing / (n_days - 1)
            logs.append(
                _log(
                    "jw_pacing",
                    f"sleep {per_between:.2f}s 后开始第 {di + 1}/{n_days} 日",
                    detail={"seconds": round(per_between, 3), "gap_index": di},
                )
            )
            time.sleep(per_between)

        logs.append(
            _log(
                "jw_day",
                f"第 {di + 1}/{n_days} 天 BGRQ={bgrq}",
                detail={"day_index": di + 1, "total_days": n_days, "BGRQ": bgrq},
            )
        )

        logs.append(
            _log(
                "jw_get_current_task",
                f"POST getCurrentTask（{di + 1}/{n_days}）",
            )
        )
        r_task = session.post(URL_GET_CURRENT, data="", headers=hdr, timeout=45)
        task_text = r_task.text or ""
        logs.append(
            _log(
                "jw_get_current_task",
                f"getCurrentTask http_status={r_task.status_code}",
                detail={
                    "day": di + 1,
                    "body_preview": task_text[:900],
                    "bytes": len(task_text.encode("utf-8")),
                },
            )
        )

        _sleep_between_requests(
            logs, spacing, after="getCurrentTask→doInitForm", day=di + 1, n_days=n_days
        )

        logs.append(_log("jw_do_init_form", f"POST doInitForm（{di + 1}/{n_days}）"))
        r_init = session.post(URL_DO_INIT, data="", headers=hdr, timeout=45)
        init_text = r_init.text or ""
        logs.append(
            _log(
                "jw_do_init_form",
                f"doInitForm http_status={r_init.status_code}",
                detail={
                    "day": di + 1,
                    "body_preview": init_text[:900],
                    "bytes": len(init_text.encode("utf-8")),
                },
            )
        )

        _sleep_between_requests(
            logs, spacing, after="doInitForm→doSave", day=di + 1, n_days=n_days
        )

        blob = task_text + "\n" + init_text
        extracted = _extract_from_responses(blob, keys_from_api)

        form: dict[str, str] = {k: v for k, v in pairs}
        form["XSXH"] = student_no.strip()
        form["XSXM"] = display_name.strip()
        form["SY_CREATEUSERNAME"] = display_name.strip()
        form["SY_CREATEUSER"] = student_no.strip()
        for k, v in extracted.items():
            if v:
                form[k] = v
        if sxrz_by_bgrq is not None:
            day_sx = (sxrz_by_bgrq.get(bgrq) or "").strip()
            if not day_sx:
                raise ValueError(f"日志正文缺失：BGRQ={bgrq} 未在 sxrz_by_bgrq 中提供")
            form["SXRZ"] = day_sx
        else:
            form["SXRZ"] = sxrz_text
        form["BGRQ"] = bgrq

        operatetime = datetime.now(tz_cn).strftime("%Y-%m-%d %H:%M:%S")
        form["OPERATETIME"] = operatetime

        # POST 前写入固定业务字段（与教务约定一致）。XNXQ 须为 20252026-2 形式，勿用 2025-2026-2。
        for k, v in FIXED_FORM_BUSINESS.items():
            form[k] = v

        xnxq_raw = form.get("XNXQ", "")
        form["XNXQ"] = _canonical_xnxq(xnxq_raw)
        if form["XNXQ"] != (xnxq_raw or "").strip() and (xnxq_raw or "").strip():
            logs.append(
                _log(
                    "jw_xnxq_normalize",
                    "已将 XNXQ 规范为教务代码（去掉学年之间的连字符）",
                    detail={"before": xnxq_raw, "after": form["XNXQ"]},
                )
            )
        form["XNXQ"] = XNXQ_CODE

        dosave_kv_preview = _dosave_kv_preview(form, pairs)
        body = urlencode(form, doseq=True)
        logs.append(
            _log(
                "jw_do_save_preview",
                f"doSave 即将 POST（{di + 1}/{n_days}）",
                detail={
                    "day": di + 1,
                    "BGRQ": bgrq,
                    "OPERATETIME": operatetime,
                    "XNXQ": form.get("XNXQ"),
                    "body_length": len(body),
                    "body_preview": body[:1200],
                    "dosave_kv_preview": dosave_kv_preview[:8000],
                    "merged_from_api_keys": list(extracted.keys()),
                },
            )
        )

        r_save = session.post(URL_DO_SAVE, data=body, headers=hdr, timeout=60)
        st = r_save.text or ""
        logs.append(
            _log(
                "jw_do_save",
                f"doSave POST http_status={r_save.status_code}（{di + 1}/{n_days}，BGRQ={bgrq}）",
                detail={
                    "day": di + 1,
                    "BGRQ": bgrq,
                    "response_preview": st[:1500],
                    "response_bytes": len(st.encode("utf-8")),
                },
            )
        )

    return logs
