import { Store } from "./store";

// Interactive multiple-choice quizzes. The check button is always enabled —
// for some questions the correct answer is to select NONE of the options.

export function initQuizzes(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(".quiz").forEach((quiz) => {
    if (quiz.dataset.wired) return;
    quiz.dataset.wired = "1";

    const inputs = Array.from(quiz.querySelectorAll<HTMLInputElement>("input[type=checkbox]"));
    const checkBtn = quiz.querySelector<HTMLButtonElement>(".check-btn");
    const resetBtn = quiz.querySelector<HTMLButtonElement>(".reset-btn");
    const reveal = quiz.querySelector<HTMLElement>(".reveal");
    const verdict = quiz.querySelector<HTMLElement>(".verdict");
    if (!checkBtn || !resetBtn || !reveal || !verdict) return;

    checkBtn.addEventListener("click", () => {
      let allRight = true;
      inputs.forEach((inp) => {
        const correct = inp.dataset.correct === "true";
        const li = inp.closest(".opt") as HTMLElement;
        const mark = li.querySelector(".opt-mark") as HTMLElement;
        li.classList.add(correct ? "is-correct" : "is-wrong");
        mark.textContent = correct ? "✅" : "❌";
        if (inp.checked && !correct) {
          li.classList.add("picked-wrong");
          allRight = false;
        }
        if (!inp.checked && correct) {
          li.classList.add("missed");
          allRight = false;
        }
        if (inp.checked && correct) li.classList.add("picked-right");
        inp.disabled = true;
      });
      verdict.textContent = allRight
        ? "✓ Correct — well done!"
        : "✗ Not quite — see the correct marks and explanation below.";
      verdict.className = "verdict " + (allRight ? "ok" : "no");
      reveal.hidden = false;
      quiz.classList.add("done");
      checkBtn.hidden = true;
      resetBtn.hidden = false;
      // got it wrong → add to the wrong book automatically
      const qel = quiz.closest("details.q") as HTMLElement | null;
      if (qel && !allRight) {
        Store.setWrong(qel.id, true);
        qel.querySelector(".wrong-btn")?.classList.add("on");
      }
    });

    resetBtn.addEventListener("click", () => {
      inputs.forEach((inp) => {
        inp.checked = false;
        inp.disabled = false;
        const li = inp.closest(".opt") as HTMLElement;
        li.className = "opt";
        const mark = li.querySelector(".opt-mark") as HTMLElement;
        mark.textContent = "";
      });
      reveal.hidden = true;
      verdict.textContent = "";
      quiz.classList.remove("done");
      checkBtn.hidden = false;
      resetBtn.hidden = true;
    });
  });
}
