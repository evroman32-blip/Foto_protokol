# -*- coding: utf-8 -*-
"""Scan TSX/JSX for unbalanced { } outside strings/templates/comments."""
from pathlib import Path

ROOT = Path(r"c:\Рабочая\ИИ для бизнеса\Вайб-кодинг\Cursor\Фотопротокол\Foto_protokol\apps\web")
EXTS = {".ts", ".tsx", ".js", ".jsx"}


def scan_jsx_braces(text: str, path: str):
    i = 0
    n = len(text)
    stack = []  # list of (kind, line) kind in {'brace','jsx'}
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
            i += 1
            in_expr = False
            depth = 0
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
                        # skip nested template shallowly by recursive-ish scan of nested only
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
                                if nch == "{":
                                    nd += 1
                                elif nch == "}":
                                    nd -= 1
                                    if nd == 0:
                                        ne = False
                                elif nch in "'\"":
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
                                i += 1
                        continue
                    if ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                        if depth == 0:
                            in_expr = False
                    i += 1
            else:
                issues.append((path, line_at(i - 1), "unterminated template", line_text(line_at(i - 1))))
            continue
        if c == "{":
            stack.append(("brace", line_at(i)))
            i += 1
            continue
        if c == "}":
            if not stack:
                issues.append((path, line_at(i), "extra }", line_text(line_at(i))))
            else:
                stack.pop()
            i += 1
            continue
        i += 1

    for kind, ln in stack[-5:]:
        issues.append((path, ln, f"unclosed {kind}", line_text(ln)))
    return issues


def main():
    all_issues = []
    for p in ROOT.rglob("*"):
        if p.suffix.lower() not in EXTS:
            continue
        if "node_modules" in p.parts or ".next" in p.parts:
            continue
        text = p.read_text(encoding="utf-8")
        iss = scan_jsx_braces(text, str(p))
        all_issues.extend(iss)

    if not all_issues:
        print("NO BRACE ISSUES")
    else:
        # group by file
        for path, line, msg, snip in all_issues:
            print(f"{path}:{line}: {msg}")
            print("  ", snip[:200])


if __name__ == "__main__":
    main()
