"""汉字个数（CJK 统一表意文字区段）与截断，对齐设计文档口径。"""

import re

_HAN = re.compile(r"[\u3400-\u9fff]")


def count_han_chars(text: str) -> int:
    return len(_HAN.findall(text or ""))


def truncate_to_max_han(text: str, max_han: int = 100) -> str:
    if max_han <= 0:
        return ""
    out: list[str] = []
    n = 0
    for ch in text or "":
        if _HAN.match(ch):
            if n >= max_han:
                break
            n += 1
        out.append(ch)
    return "".join(out)
