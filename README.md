# 3D Computer Vision — Exam Q&A

Revision deck for **3D Computer Vision (IN2228)** at TU München (Prof. Dr. Daniel Cremers, SS 2026).
Built from **12 past papers (2020–2025)**, all **8 exercise sheets** with their official solutions, and
the nine lecture chapters.

Live: **https://c0nsTantin77.github.io/3dcv-exam-qa/**

---

## Why the examiner is on every card

Three different people have written this exam, and their papers look nothing alike:

| Initials | Examiner | Papers |
|---|---|---|
| **DC** | Prof. Dr. Daniel Cremers — **current examiner** | 22EDC, 22RDC, 24EDC, 25EDC, 25RDC |
| LI | Dr. Haoang Li | 23ELI, 23RLI |
| FB | Florian Bernard | 20MFB, 20EFB, 20RFB, 21EFB, 21RFB |

So every source code reads **year · kind · examiner**:

- `25EDC 1.1` — 2025 **E**ndterm by **DC**, problem 1.1
- `23RLI 5a` — 2023 **R**etake by **LI**, problem 5a
- `20MFB 2b` — 2020 **M**idterm by **FB**, problem 2b
- `EX05 2b` — exercise sheet 5, problem 2(b)

Cards from a **Cremers** paper carry a ★ badge, an amber source chip and a left border, and they are
**sorted to the top of every knowledge point** — revise those first.

## What's in it

- **9 chapters** following the SS26 syllabus, each split into knowledge points with a **detailed recap**
  (definitions, formulas, exam traps) before the questions.
- Interactive **multiple-choice** and **open** questions; answers follow the official sample solutions,
  with the marking-scheme pitfalls called out under *Extended memory*.
- **101 Cremers-style AI practice questions** cover all 50 knowledge points, with at least two per
  knowledge point, complete derivations and exam-style traps.
- Site-wide **search** (keyword, concept tag, or an exact code like `25EDC 1.1`), **tag** browsing and
  **browse-by-exam**.
- **Study system**: Reviewed / wrong book / notes (Markdown + math) / Ebbinghaus spaced repetition,
  flashcards, a progress dashboard, and versioned Backup/Import JSON — all in `localStorage` first.
- Optional **Google sign-in cloud sync** and a live green online counter. Use a
  dedicated Firebase project and follow [docs/firebase-setup.md](docs/firebase-setup.md);
  do not reuse the I2DL Firebase project.
- Cloud progress expires after 180 days without a successful sign-in or sync; the login account remains
  available. The monthly cleanup is documented in [docs/progress-retention.md](docs/progress-retention.md).

Coverage of the past papers is tracked in [COVERAGE.md](COVERAGE.md): both **2023 Endterm and Retake
are complete (25/25 and 27/27 sub-questions)**; 98 % of 25EDC, 97 % of 25RDC, 90 % of 22RDC and
89 % of 24EDC are cited directly. The 2022 endterm (22EDC) is a scan with no text layer, so it was
transcribed by hand and cannot appear in the automatic table.

## Development

```bash
npm install
npm run dev        # http://localhost:4321/3dcv-exam-qa/
npm run build      # -> dist/
npm run check      # astro check (types)
npm run check:ai   # every knowledge point has at least two AI questions
npm run check:exam # non-empty exams/exercises + exact 2023 sub-question coverage
npm run test:notes # notes survive an immediate refresh
npm run preview
```

Content lives in `data/*.json` and is validated at build time by the Zod schema in
`src/content.config.ts` — a malformed card fails the build with a precise error. Math is rendered
with **KaTeX at build time**, so the shipped pages need no client-side math JS.

### Python tools

The course PDFs are not redistributable and live outside the repo; `AK/_txt/` is git-ignored.

```bash
python tools/extract_pdfs.py       # PDFs -> AK/_txt/ (needs pymupdf)
python tools/check_sources.py      # verify every citation exists in the paper it claims
python tools/check_math.py         # $...$ delimiter balance + macro allow-list
python tools/coverage_report.py    # -> COVERAGE.md + data/coverage-summary.json
```

`check_sources.py` reports 22EDC and 24EDC as *skipped*: both are scans whose citations were
verified visually rather than mechanically.

## Deployment

GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`, `withastro/action` on Node 22).
`dist/` is git-ignored — pushing to `main` rebuilds and redeploys.

## Recent updates

- **2026-08-02** — Completed the 2023 Endterm and Retake papers (25/25 and 27/27 sub-questions), updated all 20 affected knowledge-point recaps, and added exact paper-coverage checks.
- **2026-08-02** — Added all 8 EX05 and 5 EX06 problems with official solutions, and fixed notes being lost on an immediate refresh.
- **2026-07-31** — Expanded the AI practice set to 101 questions, guaranteeing at least two for every knowledge point.
- **2026-07-30** — Added 18 Cremers-style AI questions, two per chapter, covering previously untested concepts.
- **2026-07-25** — First release: all 9 chapters, from 12 past papers and 8 exercise sheets.
- **2026-07-25** — Every question is tagged with its examiner; Cremers papers are marked ★ and rank first.

---

For educational use only — not affiliated with or endorsed by TUM.
