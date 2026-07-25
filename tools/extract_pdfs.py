#!/usr/bin/env python3
"""Dump the 3DCV exam / lecture / exercise PDFs to text in AK/_txt, which is
what tools/check_sources.py and tools/coverage_report.py verify citations
against. Requires pymupdf (`pip install pymupdf`).

Exam PDFs are named <year>_<kind>_<examiner>.pdf and are renamed to the short
source code used on the site: 2025_Endterm_DC.pdf -> 25EDC.txt (see
src/lib/exams.ts for the format).

Two papers (22EDC, and parts of 24EDC) are scans without a usable text layer;
they come out near-empty and have to be read visually instead.
"""
import pathlib, re, sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import fitz  # pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
# Course materials live outside the repo (they are not redistributable).
SRC = pathlib.Path(r"d:/RCI/SS26课程资料/CV2")
OUT = ROOT / "AK" / "_txt"

KIND = {"midterm": "M", "endterm": "E", "retake": "R"}


def exam_code(stem: str) -> str:
    m = re.match(r"^(\d{4})_(midterm|endterm|retake)_(\w+)$", stem, re.I)
    if not m:
        return stem
    year, kind, prof = m.group(1), m.group(2).lower(), m.group(3).upper()
    return f"{year[2:]}{KIND[kind]}{prof}"


def dump(pdf: pathlib.Path, name: str) -> tuple[int, int]:
    doc = fitz.open(pdf)
    parts = []
    for i, page in enumerate(doc, 1):
        parts.append(f"\n\n===== PAGE {i} =====\n")
        parts.append(page.get_text("text"))
    doc.close()
    txt = "".join(parts)
    (OUT / f"{name}.txt").write_text(txt, encoding="utf-8")
    return len(txt), len(parts) // 2


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [(p, exam_code(p.stem)) for p in sorted((SRC / "CV2 exam").glob("*.pdf"))]
    jobs += [(p, p.stem) for p in sorted((SRC / "materials").glob("*.pdf"))]
    for pdf, name in jobs:
        n, pages = dump(pdf, name)
        flag = "  [WARN] no text layer" if n < 2000 else ""
        print(f"{name:<28} {pages:>4}p  {n:>8} chars   <- {pdf.name}{flag}")


if __name__ == "__main__":
    main()
