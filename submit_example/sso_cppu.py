"""
中国人民警察大学统一认证（sso.cppu.edu.cn）登录辅助。

- RSA：Node 执行 `mvp/tools/encrypt_password.cjs`（与 `url梳理/登录.js` + `url梳理/加密.js` 一致）。
- 验证码：GET /tpass/captcha.jpg + ddddocr。
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import requests

_REPO_ROOT = Path(__file__).resolve().parents[2]
_TOOLS = _REPO_ROOT / "mvp" / "tools" / "encrypt_password.cjs"

SSO_LOGIN_URL = (
    "https://sso.cppu.edu.cn/tpass/login?"
    "service=https://sso-jw.cppu.edu.cn/tpass/bridge"
)
CAPTCHA_URL = "https://sso.cppu.edu.cn/tpass/captcha.jpg"

DEFAULT_UA = (
    "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
)

JW_PROBE_URLS = (
    "https://jw.cppu.edu.cn/",
    "https://jw.cppu.edu.cn/je/",
)


def _log(
    step: str,
    message: str,
    level: str = "info",
    detail: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {"level": level, "step": step, "message": message, "detail": detail}


def _parse_execution(html: str) -> str | None:
    m = re.search(r'name="execution"\s+value="([^"]+)"', html)
    if m:
        return m.group(1)
    m = re.search(r"name='execution'\s+value='([^']+)'", html)
    return m.group(1) if m else None


def _encrypt_password_plain(plain: str) -> str:
    node = shutil.which("node")
    if not node:
        raise RuntimeError("未找到 node，请先安装 Node.js 以便执行与浏览器一致的 RSA 加密")
    if not _TOOLS.is_file():
        raise RuntimeError(f"缺少加密脚本: {_TOOLS}")
    r = subprocess.run(
        [node, str(_TOOLS), plain],
        capture_output=True,
        text=True,
        timeout=30,
        cwd=str(_REPO_ROOT),
    )
    if r.returncode != 0:
        err = (r.stderr or r.stdout or "").strip()
        raise RuntimeError(f"RSA 加密失败 (node exit {r.returncode}): {err[:500]}")
    out = (r.stdout or "").strip()
    if not out:
        raise RuntimeError("RSA 加密无输出")
    return out


def _ocr_digits(png: bytes) -> str:
    try:
        import ddddocr  # type: ignore
    except ImportError as e:
        raise RuntimeError(
            "需要安装 ddddocr 才能自动识别验证码：pip install ddddocr"
        ) from e
    ocr = ddddocr.DdddOcr(show_ad=False)
    raw = ocr.classification(png) or ""
    return "".join(c for c in raw if c.isdigit())


def _append_redirect_history(logs: list[dict[str, Any]], resp: requests.Response) -> None:
    for i, h in enumerate(resp.history):
        loc = (h.headers.get("Location") or "")[:160]
        logs.append(
            _log(
                "http_redirect",
                f"重定向链 #{i + 1}/{len(resp.history)}",
                detail={"http_status": h.status_code, "url": h.url[:160], "Location": loc},
            )
        )


def jw_probe_after_sso(session: requests.Session) -> list[dict[str, Any]]:
    """用 SSO 后的会话探测教务根路径（实战日志，非占位）。"""
    logs: list[dict[str, Any]] = []
    for url in JW_PROBE_URLS:
        try:
            r = session.get(url, timeout=20, allow_redirects=True)
            _append_redirect_history(logs, r)
            logs.append(
                _log(
                    "jw_probe",
                    f"GET 教务探测",
                    detail={
                        "request_url": url[:120],
                        "http_status": r.status_code,
                        "final_url": (r.url or "")[:160],
                        "bytes": len(r.content or b""),
                    },
                )
            )
        except requests.RequestException as e:
            logs.append(
                _log(
                    "jw_probe",
                    f"GET 教务探测失败: {url[:80]}",
                    "error",
                    detail={"error": str(e)[:240]},
                )
            )
    return logs


def try_sso_login(
    username: str, password: str
) -> tuple[list[dict[str, Any]], bool, str | None, requests.Session | None]:
    """
    同步执行 SSO 登录。
    返回 (日志行, 成功, 错误信息, 成功时的 requests.Session 供后续教务请求复用)。
    """
    logs: list[dict[str, Any]] = []
    headers = {"User-Agent": DEFAULT_UA}

    try:
        logs.append(_log("sso_session", "创建 HTTP 会话（空 Cookie）"))
        s = requests.Session()
        s.headers.update(headers)

        logs.append(_log("sso_login_page", "GET 登录页", detail={"url": SSO_LOGIN_URL}))
        r0 = s.get(SSO_LOGIN_URL, timeout=30)
        set_ck = r0.headers.get("Set-Cookie", "")
        logs.append(
            _log(
                "sso_login_page",
                f"登录页响应 http_status={r0.status_code}",
                detail={
                    "bytes": len(r0.content),
                    "Set-Cookie_present": bool(set_ck),
                    "cookie_names": list(s.cookies.keys()),
                },
            )
        )
        if r0.status_code != 200:
            return logs, False, f"登录页 HTTP {r0.status_code}", None

        execution = _parse_execution(r0.text)
        if not execution:
            return logs, False, "无法从 HTML 解析 execution 隐藏域", None
        logs.append(
            _log(
                "sso_execution",
                "已解析 execution",
                detail={"length": len(execution)},
            )
        )

        logs.append(_log("sso_captcha", "GET 验证码 captcha.jpg"))
        r_cap = s.get(
            CAPTCHA_URL,
            timeout=20,
            headers={"Referer": SSO_LOGIN_URL},
        )
        logs.append(
            _log(
                "sso_captcha",
                f"验证码 http_status={r_cap.status_code}",
                detail={"bytes": len(r_cap.content or b"")},
            )
        )
        if r_cap.status_code != 200 or not r_cap.content:
            return logs, False, f"验证码 HTTP {r_cap.status_code}", None

        authcode = _ocr_digits(r_cap.content)
        if len(authcode) < 4:
            return logs, False, f"验证码 OCR 不足 4 位: {authcode!r}", None
        authcode = authcode[:4]
        logs.append(_log("sso_captcha", "验证码 OCR 完成（4 位，值不写入日志）", detail={"len": 4}))

        logs.append(_log("rsa_encrypt", "RSA 加密密码（Node + url梳理 JS）"))
        enc_pwd = _encrypt_password_plain(password)

        form = {
            "username": username,
            "password": enc_pwd,
            "authcode": authcode,
            "rememberMe": "true",
            "execution": execution,
            "encrypted": "true",
            "_eventId": "submit",
            "loginType": "1",
            "submit": "登录",
        }
        body = urlencode(form)

        logs.append(_log("sso_post", "POST 登录表单"))
        r1 = s.post(
            SSO_LOGIN_URL,
            data=body,
            headers={
                **headers,
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://sso.cppu.edu.cn",
                "Referer": SSO_LOGIN_URL,
            },
            timeout=45,
            allow_redirects=True,
        )
        _append_redirect_history(logs, r1)
        final_url = r1.url or ""
        logs.append(
            _log(
                "sso_post",
                f"POST 结束 http_status={r1.status_code}",
                detail={
                    "final_url": final_url[:200],
                    "response_bytes": len(r1.content or b""),
                    "redirect_steps": len(r1.history),
                },
            )
        )

        text = r1.text or ""
        if "tpass/login" in final_url and (
            "验证码错误" in text
            or "密码错误" in text
            or "用户名或密码" in text
            or "账号或密码" in text
        ):
            return logs, False, "登录页提示账号/密码/验证码错误", None

        if "tpass/login" in final_url and r1.status_code == 200 and len(text) > 5000:
            if "验证码" in text:
                return logs, False, "仍停留在登录页（可能验证码或凭据错误）", None

        if "sso-jw" in final_url or "bridge" in final_url or "ticket" in final_url.lower():
            logs.append(_log("sso_success", "SSO 已离开登录页（票据/桥接链路）"))
            return logs, True, None, s

        logs.append(
            _log(
                "sso_success",
                "POST 结束：未命中典型失败文案；假定会话可用（请对照 final_url）",
                "warn",
                detail={"final_url": final_url[:200]},
            )
        )
        return logs, True, None, s

    except requests.RequestException as e:
        logs.append(_log("sso_error", f"网络异常: {e}", "error"))
        return logs, False, str(e), None
    except Exception as e:  # noqa: BLE001
        logs.append(_log("sso_error", str(e), "error"))
        return logs, False, str(e), None
