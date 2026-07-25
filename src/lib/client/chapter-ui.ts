import { setupContentsPill } from "./contents";
import { clearHighlights, highlightIn } from "./highlight";

// Chapter-page interactions: keyword/type filter (+ keyword highlighting),
// expand-all, back-to-top, deep-link opening, and the topbar contents pill.

function initFilter(): void {
  const search = document.getElementById("search") as HTMLInputElement | null;
  const typeBoxes = Array.from(document.querySelectorAll<HTMLInputElement>(".ftype"));
  const noResults = document.querySelector<HTMLElement>(".noresults");
  const content = document.querySelector<HTMLElement>(".content");
  if (!search && !typeBoxes.length) return;

  const activeTypes = () =>
    new Set(typeBoxes.filter((b) => b.checked).map((b) => b.value));

  // Highlight matched keywords in visible cards (question + answer + extend),
  // skipping KaTeX. Debounced so fast typing doesn't thrash the DOM walk.
  let hlTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleHighlight = (term: string) => {
    if (!content) return;
    if (hlTimer) clearTimeout(hlTimer);
    hlTimer = setTimeout(() => {
      clearHighlights(content);
      if (!term) return;
      const targets: HTMLElement[] = [];
      content
        .querySelectorAll<HTMLElement>(
          "details.q:not([hidden]) .q-text, details.q:not([hidden]) .answer, details.q:not([hidden]) .extend",
        )
        .forEach((el) => targets.push(el));
      highlightIn(targets, term);
    }, 120);
  };

  const applyFilter = () => {
    const term = (search ? search.value : "").trim().toLowerCase();
    const types = activeTypes();
    let visible = 0;
    document.querySelectorAll<HTMLElement>(".kp").forEach((kp) => {
      let kpVisible = 0;
      kp.querySelectorAll<HTMLElement>("details.q").forEach((q) => {
        const typeOk = types.has(q.dataset.type ?? "");
        const textOk = !term || (q.textContent ?? "").toLowerCase().includes(term);
        const show = typeOk && textOk;
        q.hidden = !show;
        if (show) {
          kpVisible++;
          visible++;
        }
      });
      kp.hidden = kpVisible === 0;
    });
    if (noResults) noResults.hidden = visible !== 0;
    scheduleHighlight(term);
  };

  if (search) search.addEventListener("input", applyFilter);
  typeBoxes.forEach((b) => b.addEventListener("change", applyFilter));
}

function initExpandAll(): void {
  const expandBtn = document.getElementById("expandAll");
  if (!expandBtn) return;
  expandBtn.addEventListener("click", () => {
    const qs = Array.from(document.querySelectorAll<HTMLDetailsElement>("details.q")).filter(
      (q) => !q.hidden,
    );
    const anyClosed = qs.some((q) => !q.open);
    qs.forEach((q) => (q.open = anyClosed));
    expandBtn.textContent = anyClosed ? "Collapse all" : "Expand all";
  });
}

function initToTop(): void {
  const toTop = document.getElementById("toTop");
  if (!toTop) return;
  const onScroll = () => {
    toTop.hidden = window.scrollY < 400;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function openHashTarget(): void {
  if (!location.hash) return;
  let el: HTMLElement | null = null;
  try {
    el = document.querySelector<HTMLElement>(location.hash);
  } catch {
    return;
  }
  if (el && el.tagName === "DETAILS") {
    (el as HTMLDetailsElement).open = true;
    el.scrollIntoView({ block: "center" });
    el.classList.add("flash");
    setTimeout(() => el?.classList.remove("flash"), 1600);
  }
}

export function initChapterUI(): void {
  initFilter();
  initExpandAll();
  initToTop();
  window.addEventListener("load", openHashTarget);
  window.addEventListener("hashchange", openHashTarget);
  setupContentsPill(); // chapter pages: section links are server-rendered
}
