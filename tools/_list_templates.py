# -*- coding: utf-8 -*-
from pathlib import Path

ROOTS = [
    Path(r"c:\Рабочая\ИИ для бизнеса\Вайб-кодинг\Cursor\Фотопротокол\Foto_protokol\apps\web"),
    Path(r"c:\Рабочая\ИИ для бизнеса\Вайб-кодинг\Cursor\Фотопротокол\Foto_protokol\packages\ui"),
]


def find_templates(text: str):
    i = 0
    n = len(text)
    out = []
    while i < n:
        if text[i] == "/" and i + 1 < n and text[i + 1] == "/":
            while i < n and text[i] != "\n":
                i += 1
            continue
        if text[i] == "/" and i + 1 < n and text[i + 1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        if text[i] in "'\"":
            q = text[i]
            i += 1
            while i < n:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == q:
                    i += 1
                    break
                i += 1
            continue
        if text[i] == "`":
            start = i
            start_ln = text.count("\n", 0, i) + 1
            i += 1
            exprs = []
            while i < n:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == "`":
                    end = i + 1
                    lit = text[start:end]
                    out.append((start_ln, lit, exprs, True))
                    i = end
                    break
                if text[i] == "$" and i + 1 < n and text[i + 1] == "{":
                    expr_ln = text.count("\n", 0, i) + 1
                    expr_start = i
                    i += 2
                    depth = 1
                    while i < n and depth > 0:
                        ch = text[i]
                        if ch in "'\"":
                            q = ch
                            i += 1
                            while i < n:
                                if text[i] == "\\":
                                    i += 2
                                    continue
                                if text[i] == q:
                                    i += 1
                                    break
                                i += 1
                            continue
                        if ch == "`":
                            # nested template: skip until matching backtick with nested ${} depth
                            i += 1
                            nd = 0
                            ne = False
                            while i < n:
                                nch = text[i]
                                if not ne:
                                    if nch == "\\":
                                        i += 2
                                        continue
                                    if nch == "`":
                                        i += 1
                                        break
                                    if nch == "$" and i + 1 < n and text[i + 1] == "{":
                                        ne = True
                                        nd = 1
                                        i += 2
                                        continue
                                    i += 1
                                else:
                                    if nch in "'\"":
                                        q = nch
                                        i += 1
                                        while i < n:
                                            if text[i] == "\\":
                                                i += 2
                                                continue
                                            if text[i] == q:
                                                i += 1
                                                break
                                            i += 1
                                        continue
                                    if nch == "{":
                                        nd += 1
                                    elif nch == "}":
                                        nd -= 1
                                        if nd == 0:
                                            ne = False
                                    i += 1
                            continue
                        if ch == "{":
                            depth += 1
                        elif ch == "}":
                            depth -= 1
                        i += 1
                    expr = text[expr_start:i]
                    closed = depth == 0
                    exprs.append((expr_ln, expr, closed))
                    continue
                i += 1
            else:
                out.append((start_ln, text[start:], exprs, False))
            continue
        i += 1
    return out


def main():
    for root in ROOTS:
        for p in root.rglob("*"):
            if p.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}:
                continue
            if "node_modules" in p.parts or ".next" in p.parts:
                continue
            text = p.read_text(encoding="utf-8")
            for start_ln, lit, exprs, closed in find_templates(text):
                if not closed:
                    print(f"UNCLOSED_TEMPLATE {p}:{start_ln}")
                    print(repr(lit[:200]))
                for expr_ln, expr, ok in exprs:
                    if not ok:
                        print(f"MISSING_BRACE {p}:{expr_ln}")
                        print(repr(expr[:200]))
                    # also flag suspicious: ${ without obvious close in snippet shown by babel
                if "${" in lit:
                    one = lit.replace("\n", "\\n")
                    if len(one) > 160:
                        one = one[:160] + "..."
                    # only print suspicious long multiline with nested brackets mismatch
                    opens = lit.count("{")
                    closes = lit.count("}")
                    if opens != closes:
                        print(f"BRACE_MISMATCH_IN_TEMPLATE {p}:{start_ln} opens={opens} closes={closes}")
                        print(one)


if __name__ == "__main__":
    main()
    print("DONE")
