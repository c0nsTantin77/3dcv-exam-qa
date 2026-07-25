import { Store } from "./store";
import { applyAllStudy } from "./study";
import { highlightIn, clearHighlights } from "./highlight";
import { userWords, wordVariants } from "./answer-match";

// Self-test for open / AI short-answer questions: the reference answer is hidden
// behind "Show answer" with an optional "write your answer" box, mirroring the
// MC quiz flow. On reveal, every meaningful word the student wrote that also
// appears in the reference answer is highlighted green (overlap). They then
// self-assess (Got it → reviewed, Missed → wrong book) and can "Try again".
// There is no single ground truth, so this stays a self-check (no auto-grading).

export function initOpenAnswer(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(".selftest").forEach((st) => {
    if (st.dataset.wired) return;
    st.dataset.wired = "1";
    const qel = st.closest("details.q") as HTMLElement | null;
    if (!qel) return;
    const id = qel.id;
    const ta = st.querySelector<HTMLTextAreaElement>(".self-area");
    const calcInputs = Array.from(st.querySelectorAll<HTMLInputElement>(".calc-in"));
    const revealBtn = st.querySelector<HTMLButtonElement>(".reveal-btn");
    const againBtn = st.querySelector<HTMLButtonElement>(".self-again");
    const reveal = st.querySelector<HTMLElement>(".open-reveal");
    const assess = st.querySelector<HTMLElement>(".self-assess");
    if (!revealBtn || !reveal) return;

    const refParts = (): HTMLElement[] =>
      Array.from(reveal.querySelectorAll<HTMLElement>(".answer, .extend"));

    const show = (): void => {
      reveal.hidden = false;
      revealBtn.hidden = true;
      if (againBtn) againBtn.hidden = false;
      if (assess) assess.hidden = false;
      if (ta) ta.readOnly = true;

      // calculation questions: check each typed number against its expected value
      calcInputs.forEach((inp) => {
        const exp = parseFloat(inp.dataset.val ?? "");
        const tol = Math.max(parseFloat(inp.dataset.tol ?? "0") || 0, 1e-9);
        const got = parseFloat((inp.value ?? "").replace(/[, ]/g, ""));
        const filled = inp.value.trim() !== "";
        const ok = filled && Number.isFinite(got) && Math.abs(got - exp) <= tol;
        inp.classList.toggle("ok", ok);
        inp.classList.toggle("bad", filled && !ok);
        const mark = inp.parentElement?.querySelector(".calc-mark");
        if (mark) mark.textContent = !filled ? "" : ok ? "✓" : "✗";
        inp.readOnly = true;
      });

      // green-highlight every meaningful word the student wrote that also
      // appears in the reference answer (overlap). No "missed" / red marking.
      const words = userWords(ta?.value ?? "");
      if (words.length) {
        const targets = refParts();
        for (const w of words) for (const v of wordVariants(w)) highlightIn(targets, v, "kw-hit", true);
      }
    };

    const reset = (): void => {
      reveal.hidden = true;
      revealBtn.hidden = false;
      if (againBtn) againBtn.hidden = true;
      if (assess) {
        assess.hidden = true;
        delete assess.dataset.done;
      }
      clearHighlights(reveal, "kw-hit");
      calcInputs.forEach((inp) => {
        inp.readOnly = false;
        inp.classList.remove("ok", "bad");
        const mark = inp.parentElement?.querySelector(".calc-mark");
        if (mark) mark.textContent = "";
      });
      if (ta) {
        ta.readOnly = false;
        ta.focus();
      } else if (calcInputs[0]) {
        calcInputs[0].focus();
      }
    };

    revealBtn.addEventListener("click", show);
    againBtn?.addEventListener("click", reset);

    const choose = (kind: "got" | "miss"): void => {
      if (kind === "got") Store.setReviewed(id, true);
      else Store.setWrong(id, true);
      if (assess) assess.dataset.done = kind;
      applyAllStudy();
    };
    assess?.querySelector(".got-btn")?.addEventListener("click", () => choose("got"));
    assess?.querySelector(".miss-btn")?.addEventListener("click", () => choose("miss"));
  });
}
