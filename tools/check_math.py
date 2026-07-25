#!/usr/bin/env python3
"""Validate KaTeX math spans in the data JSON: delimiter parity, brace
balance, and that every macro used is on the KaTeX-supported list."""
import glob, json, re, sys, pathlib

# Make output safe on a default GBK Windows console (no UnicodeEncodeError).
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = pathlib.Path(__file__).resolve().parent.parent

# A generous subset of KaTeX-supported macros we expect to use.
KATEX_OK = {
    "dfrac", "frac", "mu", "sigma", "alpha", "beta", "gamma", "lambda", "eta",
    "epsilon", "theta", "times", "cdot", "sum", "prod", "sqrt", "log", "exp",
    "left", "right", "begin", "end", "text", "mathbb", "in", "approx", "neq",
    "leq", "geq", "to", "partial", "nabla", "hat", "min", "max", "circ",
}

def gather_text():
    out = []
    for f in glob.glob(str(ROOT / "data" / "*.json")):
        data = json.loads(pathlib.Path(f).read_text(encoding="utf-8"))
        def walk(o):
            if isinstance(o, dict):
                for v in o.values(): walk(v)
            elif isinstance(o, list):
                for v in o: walk(v)
            elif isinstance(o, str):
                out.append(o)
        walk(data)
    return out

DISPLAY = re.compile(r"\$\$(.+?)\$\$", re.DOTALL)
INLINE = re.compile(r"\$([^$]+?)\$")

def main():
    strings = gather_text()
    spans, errors = [], []
    for s in strings:
        # strip display first, then inline on the remainder
        rest = DISPLAY.sub(lambda m: spans.append(("display", m.group(1))) or " ", s)
        for m in INLINE.finditer(rest):
            spans.append(("inline", m.group(1)))
        # parity check: every string must have an even number of $
        if rest.count("$") % 2 != 0:
            errors.append(f"odd $ count in: {s[:70]!r}")

    macros = set()
    for kind, body in spans:
        if body.count("{") != body.count("}"):
            errors.append(f"unbalanced braces in {kind}: {body!r}")
        for mac in re.findall(r"\\([a-zA-Z]+)", body):
            macros.add(mac)

    unknown = sorted(macros - KATEX_OK)
    print(f"math spans: {len(spans)}  (display={sum(1 for k,_ in spans if k=='display')}, inline={sum(1 for k,_ in spans if k=='inline')})")
    print(f"macros used: {sorted(macros)}")
    if unknown:
        print(f"[WARN] macros NOT in known-good list (verify manually): {unknown}")
    print("\nsample spans:")
    for kind, body in spans[:25]:
        print(f"  [{kind}] {body.strip()}")

    if errors:
        print("\n[FAIL] ERRORS:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print("\n[OK] all delimiters balanced, all macros recognized")

if __name__ == "__main__":
    main()
