import type { SearchEntry } from "../types";
import { Store } from "./store";
import { loadIndex } from "./index-data";
import { examOf } from "../exams";
import { url } from "../paths";

// Progress dashboard ring + per-chapter / per-exam card rings + sidebar bars.
// Driven by the search index (totals) and the Store (reviewed/due/wrong).

let INDEX: SearchEntry[] = [];

interface ChStat {
  ct: string;
  total: number;
  done: number;
}

function chapterStats() {
  const reviewedSet = new Set(Store.reviewedIds());
  const byCh: Record<string, ChStat> = {};
  INDEX.forEach((e) => {
    const o = (byCh[e.c] = byCh[e.c] || { ct: e.ct, total: 0, done: 0 });
    o.total++;
    if (reviewedSet.has(e.a)) o.done++;
  });
  return { reviewedSet, byCh };
}

function examStats() {
  const reviewedSet = new Set(Store.reviewedIds());
  const byExam: Record<string, { total: number; done: number }> = {};
  INDEX.forEach((e) => {
    const seen = new Set<string>();
    (e.srcs || []).forEach((s) => {
      const x = examOf(s);
      if (x && !seen.has(x)) {
        seen.add(x);
        const o = (byExam[x] = byExam[x] || { total: 0, done: 0 });
        o.total++;
        if (reviewedSet.has(e.a)) o.done++;
      }
    });
  });
  return byExam;
}

function miniRing(pct: number, size: number): string {
  const r = size / 2 - 3;
  const C = 2 * Math.PI * r;
  const off = C * (1 - pct / 100);
  return (
    "<svg class='mini-ring' width='" + size + "' height='" + size + "' viewBox='0 0 " + size + " " + size + "'>" +
    "<circle cx='" + size / 2 + "' cy='" + size / 2 + "' r='" + r + "' class='mr-bg'/>" +
    "<circle cx='" + size / 2 + "' cy='" + size / 2 + "' r='" + r + "' class='mr-fg' " +
    "style='stroke-dasharray:" + C + ";stroke-dashoffset:" + off + "'/>" +
    "<text x='50%' y='52%' class='mr-txt'>" + pct + "</text></svg>"
  );
}

export function renderProgressUI(): void {
  if (!INDEX.length) return;
  const { reviewedSet, byCh } = chapterStats();

  const progBody = document.getElementById("prog-body");
  if (progBody) {
    const total = INDEX.length;
    const reviewed = INDEX.filter((e) => reviewedSet.has(e.a)).length;
    const dueCount = Store.dueList(INDEX.map((e) => e.a)).length;
    const wrongCount = INDEX.filter((e) => Store.isWrong(e.a)).length;
    const pct = total ? Math.round((100 * reviewed) / total) : 0;
    const C = 2 * Math.PI * 42;
    const off = C * (1 - pct / 100);
    const ring =
      "<div class='prog-ring-wrap'><svg class='prog-ring' viewBox='0 0 100 100'>" +
      "<circle class='ring-bg' cx='50' cy='50' r='42'/>" +
      "<circle class='ring-fg' cx='50' cy='50' r='42' style='stroke-dasharray:" + C +
      ";stroke-dashoffset:" + off + "'/></svg>" +
      "<div class='prog-ring-num'><b>" + reviewed + "</b><span>/ " + total + "</span></div></div>";
    const stats =
      "<div class='prog-stats'>" +
      "<div class='pstat'><b>" + pct + "%</b>reviewed</div>" +
      "<div class='pstat'><b class='due'>" + dueCount + "</b>due today</div>" +
      "<div class='pstat'><b class='wrong'>" + wrongCount + "</b>wrong book</div></div>";
    const reviewUrl = url("/review");
    const cta =
      dueCount > 0
        ? "<a class='prog-link primary' href='" + reviewUrl + "'>🧠 Review " + dueCount + " due now →</a>"
        : wrongCount > 0
          ? "<a class='prog-link' href='" + reviewUrl + "'>★ " + wrongCount + " in wrong book →</a>"
          : "<a class='prog-link' href='" + reviewUrl + "'>Review &amp; wrong book →</a>";
    progBody.innerHTML = "<div class='prog-top'>" + ring + stats + cta + "</div>";
    const pc = document.getElementById("progress");
    if (pc) pc.hidden = false;
  }

  document.querySelectorAll<HTMLElement>(".card-prog[data-ch]").forEach((el) => {
    const o = byCh[el.dataset.ch ?? ""];
    if (!o) return;
    const pct = o.total ? Math.round((100 * o.done) / o.total) : 0;
    el.innerHTML = miniRing(pct, 38);
    el.title = o.done + " / " + o.total + " reviewed";
    el.classList.toggle("has-prog", o.done > 0);
  });

  const byExam = examStats();
  document.querySelectorAll<HTMLElement>(".card-prog[data-exam]").forEach((el) => {
    const o = byExam[el.dataset.exam ?? ""];
    if (!o) return;
    const pct = o.total ? Math.round((100 * o.done) / o.total) : 0;
    el.innerHTML = miniRing(pct, 38);
    el.title = o.done + " / " + o.total + " reviewed";
    el.classList.toggle("has-prog", o.done > 0);
  });

  document.querySelectorAll<HTMLElement>(".ch-progress").forEach((el) => {
    const o = byCh[el.dataset.ch ?? ""];
    if (!o) return;
    const pct = o.total ? Math.round((100 * o.done) / o.total) : 0;
    const dueIds = Store.dueList(
      INDEX.filter((e) => e.c === el.dataset.ch).map((e) => e.a),
    ).length;
    el.innerHTML =
      "<div class='chp-head'><span class='chp-label'>Reviewed</span>" +
      "<span class='chp-num'>" + o.done + " / " + o.total + "</span></div>" +
      "<span class='pbar-track'><span class='pbar-fill' style='width:" + pct + "%'></span></span>" +
      (dueIds ? "<a class='chp-due' href='" + url("/review") + "'>" + dueIds + " due today →</a>" : "");
  });
}

export async function initProgress(): Promise<void> {
  INDEX = await loadIndex();
  renderProgressUI();
}
