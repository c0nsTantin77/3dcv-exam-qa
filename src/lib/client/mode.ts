// Study-mode toggle (chapter pages). "review" reveals every answer; "test"
// hides them behind the interactive MC quiz / short-answer self-check. The
// actual reveal/hide is pure CSS keyed on <html data-mode>; this module just
// flips the attribute, persists the choice, and reflects it on the toggle.
// An inline script in Layout.astro sets data-mode before paint (no flash).

type Mode = "review" | "test";
const KEY = "cv2_mode";

function setMode(mode: Mode): void {
  document.documentElement.dataset.mode = mode;
  document.querySelectorAll<HTMLElement>(".mode-btn").forEach((b) => {
    const on = b.dataset.setMode === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* private mode — keep working in-memory */
  }
}

export function initMode(): void {
  let saved: Mode = "review";
  try {
    saved = localStorage.getItem(KEY) === "test" ? "test" : "review";
  } catch {
    /* ignore */
  }
  setMode(saved);

  const toggle = document.querySelector(".mode-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".mode-btn");
    const m = b?.dataset.setMode;
    if (m === "review" || m === "test") setMode(m);
  });
}
