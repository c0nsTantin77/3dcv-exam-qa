// Preserve the browse-by-exam context when a question opens on its chapter page.
// The context lives in the URL so it survives refreshes and copied links.

export const EXAM_CONTEXT_PARAM = "fromExam";

const EXAM_CODE = /^(?:\d\d[MER][A-Z]{2}|EX\d\d)$/;

export function isExamCode(value: string | null | undefined): value is string {
  return Boolean(value && EXAM_CODE.test(value));
}

export function contextualQuestionHref(
  base: string,
  chapter: string,
  anchor: string,
  examCode?: string | null,
): string {
  const path = base + "/chapters/" + chapter + "/";
  const code = examCode?.trim().toUpperCase() ?? "";
  const context = isExamCode(code)
    ? "?" + EXAM_CONTEXT_PARAM + "=" + encodeURIComponent(code)
    : "";
  return path + context + "#" + anchor;
}

export function examReturnCode(
  search: string,
  sourceTexts: readonly string[],
): string | null {
  const raw = new URLSearchParams(search).get(EXAM_CONTEXT_PARAM);
  const code = raw?.trim().toUpperCase() ?? "";
  if (!isExamCode(code)) return null;

  const sourcePrefix = code + " ";
  return sourceTexts.some((source) => {
    const text = source.trim();
    return text === code || text.startsWith(sourcePrefix);
  })
    ? code
    : null;
}

export function examReturnHref(examsBase: string, code: string): string {
  return examsBase + "?e=" + encodeURIComponent(code);
}

export function initExamReturn(): void {
  const link = document.getElementById("examReturn") as HTMLAnchorElement | null;
  if (!link) return;

  const sourceElements = Array.from(
    document.querySelectorAll<HTMLElement>(".q-src .src"),
  );
  const sourceTexts = sourceElements.map((source) => source.textContent ?? "");
  const code = examReturnCode(location.search, sourceTexts);
  const examsBase = link.dataset.examsBase;

  if (!code || !examsBase) {
    link.hidden = true;
    link.removeAttribute("href");
    return;
  }

  const sourcePrefix = code + " ";
  const matchingSource = sourceElements.find((source) => {
    const text = (source.textContent ?? "").trim();
    return text === code || text.startsWith(sourcePrefix);
  });
  const examName = matchingSource?.getAttribute("title")?.trim() || code;
  const codeLabel = link.querySelector<HTMLElement>(".exam-return-code");

  if (codeLabel) codeLabel.textContent = code;
  link.href = examReturnHref(examsBase, code);
  link.title = "Back to " + examName;
  link.setAttribute("aria-label", "Back to " + examName);
  link.hidden = false;
}
