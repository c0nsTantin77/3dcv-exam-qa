// Exam-code helpers, shared by the build (homepage exam cards) and the client
// (browse-by-exam page, per-exam progress rings).
//
// Source-code format:  YY + kind + examiner initials  ->  "25EDC"
//   YY        last two digits of the year         (25 = 2025)
//   kind      M = midterm, E = endterm, R = retake
//   initials  the examiner who wrote the paper    (DC / LI / FB)
// e.g. "23RLI" = 2023 retake by Dr. Haoang Li, "20MFB" = 2020 midterm by
// Florian Bernard, "25EDC 1.1" = problem 1.1 of the 2025 endterm by Cremers.
//
// The examiner is not cosmetic: each one writes a distinctly different paper.
// Daniel Cremers is the current examiner, so DC items rank first everywhere
// (chapter pages, search, exam browser) — see PRIMARY / sourceRank().
//
// Exercise sheets use "EX01".."EX08" plus the sheet's problem number.

export const PRIMARY = "DC";

export const EXAMINER_NAMES: Record<string, string> = {
  DC: "Prof. Dr. Daniel Cremers",
  LI: "Dr. Haoang Li",
  FB: "Florian Bernard",
};

export const EXAM_NAMES: Record<string, string> = {
  "25EDC": "2025 Endterm · Cremers",
  "25RDC": "2025 Retake · Cremers",
  "24EDC": "2024 Endterm · Cremers",
  "22EDC": "2022 Endterm · Cremers",
  "22RDC": "2022 Retake · Cremers",
  "23ELI": "2023 Endterm · Li",
  "23RLI": "2023 Retake · Li",
  "21EFB": "2021 Endterm · Bernard",
  "21RFB": "2021 Retake · Bernard",
  "20EFB": "2020 Endterm · Bernard",
  "20RFB": "2020 Retake · Bernard",
  "20MFB": "2020 Midterm · Bernard",
  EX01: "Exercise 1 · Linear Algebra",
  EX02: "Exercise 2 · Moving Scene",
  EX03: "Exercise 3 · Perspective Projection",
  EX04: "Exercise 4 · Point Correspondence",
  EX05: "Exercise 5 · Two-View Reconstruction",
  EX06: "Exercise 6 · Multi-View Reconstruction",
  EX07: "Exercise 7 · Bundle Adjustment",
  EX08: "Exercise 8 · Photometric Optimization",
};

const EXAM_CODE = /^(\d\d[MER][A-Z]{2}|EX\d\d)\b/;

/** Exam code from a source string ("25EDC 1.1" -> "25EDC"), or null. */
export function examOf(source: string): string | null {
  const m = source.match(EXAM_CODE);
  return m ? m[1] : null;
}

/** The problem label without the exam code ("25EDC 1.1" -> "1.1"). */
export function labelOf(source: string): string {
  return source.replace(EXAM_CODE, "").trim();
}

/** Examiner initials of an exam code ("25EDC" -> "DC"); null for exercise sheets. */
export function examinerOf(code: string): string | null {
  const m = code.match(/^\d\d[MER]([A-Z]{2})$/);
  return m ? m[1] : null;
}

/** True for a paper written by the current examiner (Cremers). */
export function isPrimary(code: string): boolean {
  return examinerOf(code) === PRIMARY;
}

/** Kind of a source string — drives chip styling and ordering. */
export type SourceKind = "primary" | "past" | "exercise" | "ai";

export function kindOf(source: string): SourceKind {
  if (/^(ai|summary)/i.test(source)) return "ai";
  const code = examOf(source);
  if (!code) return "ai";
  if (code.startsWith("EX")) return "exercise";
  return isPrimary(code) ? "primary" : "past";
}

const RANK: Record<SourceKind, number> = { primary: 0, past: 1, exercise: 2, ai: 3 };

/** Best (lowest) source rank of a question — Cremers items sort to the top. */
export function sourceRank(sources: string[]): number {
  return sources.reduce((best, s) => Math.min(best, RANK[kindOf(s)]), RANK.ai);
}

/** Section heading for a code, used to group the exam browser. */
export function examSection(code: string): string {
  if (code.startsWith("EX")) return "Exercise sheets";
  const ex = examinerOf(code);
  if (ex === PRIMARY) return "Cremers — current examiner";
  return `Past examiner · ${EXAMINER_NAMES[ex ?? ""] ?? ex}`;
}
