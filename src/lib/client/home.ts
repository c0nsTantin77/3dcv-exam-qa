import { APP_CONFIG } from "../config";

// Homepage view toggle (By chapter / By exam) + feedback-form link wiring.

export function initHomeView(): void {
  const toggle = document.querySelector<HTMLElement>(".view-toggle");
  const vChapters = document.getElementById("view-chapters");
  const vExams = document.getElementById("view-exams");
  if (!toggle || !vChapters || !vExams) return;
  const KEY = "cv2_homeview";

  const setView = (v: string) => {
    const exams = v === "exams";
    vExams.hidden = !exams;
    vChapters.hidden = exams;
    toggle.querySelectorAll<HTMLElement>(".vt-btn").forEach((b) => {
      const on = b.dataset.view === v;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  };

  toggle.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".vt-btn");
    if (b && b.dataset.view) setView(b.dataset.view);
  });

  let saved = "chapters";
  try {
    saved = localStorage.getItem(KEY) || "chapters";
  } catch {
    /* ignore */
  }
  if (location.hash === "#by-exam") saved = "exams";
  setView(saved);
}

export function initFeedbackLink(): void {
  const fbLink = document.getElementById("feedback-link") as HTMLAnchorElement | null;
  if (!fbLink) return;
  if (APP_CONFIG.feedbackFormUrl) {
    fbLink.href = APP_CONFIG.feedbackFormUrl.replace("?embedded=true", "");
  } else {
    fbLink.textContent = "Feedback form not configured yet";
    fbLink.removeAttribute("href");
  }
}
