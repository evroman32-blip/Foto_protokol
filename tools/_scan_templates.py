# -*- coding: utf-8 -*-
"""Scan TS/JS for unclosed ${} in template literals."""
from pathlib import Path

ROOT = Path(r"c:\Рабочая\ИИ для бизнеса\Вайб-кодинг\Cursor\Фотопротокол\Foto_protokol\apps\web")
EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}


def scan(text: str, path: str):
    i = 0
    n = len(text)
    issues = []

    def line_at(pos: int) -> int:
        return text.count("\n", 0, pos) + 1

    def line_text(ln: int) -> str:
        lines = text.splitlines()
        return lines[ln - 1] if 0 < ln <= len(lines) else ""

    while i < n:
        c = text[i]
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            while i < n and text[i] != "\n":
                i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        if c in "'\"":
            q = c
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
        if c == "`":
            start_line = line_at(i)
            i += 1
            in_expr = False
            depth = 0
            expr_line = start_line
            while i < n:
                ch = text[i]
                if not in_expr:
                    if ch == "\\":
                        i += 2
                        continue
                    if ch == "`":
                        i += 1
                        break
                    if ch == "$" and i + 1 < n and text[i + 1] == "{":
                        in_expr = True
                        depth = 1
                        expr_line = line_at(i)
                        i += 2
                        continue
                    i += 1
                else:
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
                        # nested template literal inside expression
                        i += 1
                        nested_ok = False
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
                                    nested_ok = True
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
                        if not nested_ok:
                            issues.append(
                                (path, expr_line, "unclosed nested template in expression", line_text(expr_line))
                            )
                        continue
                    if ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                        if depth == 0:
                            in_expr = False
                    i += 1
            else:
                if in_expr:
                    issues.append((path, expr_line, "Missing } in template expression", line_text(expr_line)))
                else:
                    issues.append((path, start_line, "Unterminated template literal", line_text(start_line)))
            continue
        i += 1
    return issues


def main():
    all_issues = []
    for p in ROOT.rglob("*"):
        if p.suffix.lower() not in EXTS:
            continue
        if "node_modules" in p.parts or ".next" in p.parts:
            continue
        text = p.read_text(encoding="utf-8")
        all_issues.extend(scan(text, str(p)))

    if not all_issues:
        print("NO ISSUES FOUND by brace scanner")
    else:
        for path, line, msg, snip in all_issues:
            print(f"{path}:{line}: {msg}")
            print("  ", snip[:240])


if __name__ == "__main__":
    main()
