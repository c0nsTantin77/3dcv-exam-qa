#!/usr/bin/env python3
"""Cross-check every source tag in data/*.json against the text dumps in
AK/_txt, so a citation like '25EDC 1.1' or 'EX05 2b' is verified to actually
exist in the paper it claims to come from.

Source format (see src/lib/exams.ts):
    <YY><M|E|R><examiner initials> <problem>   e.g. "25EDC 1.1", "23RLI 4.2"
    EX<NN> <problem>[subpart]                  e.g. "EX05 2b", "EX01 4"
"""
import glob, json, re, pathlib, sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = pathlib.Path(__file__).resolve().parent.parent
TXT = ROOT / "AK" / "_txt"

# code -> text dump. Exam dumps are named by code (tools/extract_pdfs.py);
# exercise sheets cite the *solution* PDF, which contains the problems too.
EXAM_FILES = {c: f"{c}.txt" for c in (
    "25EDC", "25RDC", "24EDC", "22EDC", "22RDC",
    "23ELI", "23RLI", "21EFB", "21RFB", "20EFB", "20RFB", "20MFB",
)}
EXAM_FILES.update({f"EX{n:02d}": f"ex{n:02d}_solution.txt" for n in range(1, 9)})

# Scanned papers without a usable text layer: 22EDC has none at all and 24EDC
# only a garbled OCR one, so both were transcribed visually and their citations
# cannot be machine-verified. They are reported as skipped, not suspicious.
IMAGE_ONLY = {"22EDC", "24EDC"}

_cache = {}


def text(code):
    if code not in _cache:
        p = TXT / EXAM_FILES.get(code, "")
        _cache[code] = p.read_text(encoding="utf-8", errors="ignore") if p.exists() else ""
    return _cache[code]


def collect_sources():
    srcs = []
    for f in glob.glob(str(ROOT / "data" / "ch*.json")):
        if pathlib.Path(f).name == "chapters.json":
            continue
        data = json.loads(pathlib.Path(f).read_text(encoding="utf-8"))
        for kp in data["knowledge_points"]:
            for q in kp["questions"]:
                srcs.extend(q["sources"])
    return srcs


def verify(src):
    if src.lower().startswith(("ai", "summary", "lecture")):
        return True, "skip"
    m = re.match(r"^(\d\d[MER][A-Z]{2}|EX\d\d)\s+(.+)$", src)
    if not m:
        return False, "unparseable"
    code, ref = m.group(1), m.group(2)
    if code not in EXAM_FILES:
        return False, f"unknown paper {code}"
    if code in IMAGE_ONLY:
        return True, "scanned paper — not verifiable"
    body = text(code)
    if not body:
        return False, f"no text dump for {code}"

    # Cremers papers number sub-questions 'N.M' at the start of a line
    if re.match(r"^\d+\.\d+$", ref):
        pat = re.compile(r"(?m)^\s*" + re.escape(ref) + r"(?=[\s)])")
        return bool(pat.search(body)), f"numeric {ref}"

    sub_ref = re.match(r"^(\d+)([a-z])?$", ref)
    if not sub_ref:
        return True, f"loose {ref}"
    n, sub = sub_ref.group(1), sub_ref.group(2)

    if code.startswith("EX"):
        # exercise sheets: 'N.' at line start, subparts printed as '(a)'
        has_n = re.search(r"(?m)^\s*" + n + r"\.\s", body)
        if not sub:
            return bool(has_n), f"exercise {n}"
        return bool(has_n and re.search(r"(?m)^\s*\(" + sub + r"\)", body)), f"exercise {n}({sub})"

    # Bernard / Li papers: 'Problem N' heading, subparts printed as 'a)'
    has_n = re.search(r"(?m)^Problem\s+" + n + r"\b", body)
    if not sub:
        return bool(has_n), f"problem {n}"
    return bool(has_n and re.search(r"(?m)^\s*" + sub + r"\)", body)), f"problem {n}{sub})"


def main():
    seen = {}
    for s in collect_sources():
        if s not in seen:
            seen[s] = verify(s)
    bad = [(s, w) for s, (ok, w) in seen.items() if not ok]
    for s in sorted(seen):
        ok, why = seen[s]
        print(f"  {'OK ' if ok else 'XX '}{s:16s} [{why}]")
    print(f"\n{len(seen)} unique sources, {len(bad)} suspicious")
    for s, w in bad:
        print("  SUSPICIOUS:", s, w)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
