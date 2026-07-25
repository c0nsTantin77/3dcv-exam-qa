import { Store } from "./store";

// Per-question study controls: Reviewed / wrong book / notes, all persisted via
// the Store (localStorage, optionally cloud-synced). Re-runnable so the UI can
// reflect synced state after a cloud merge.

const todayStr = () => new Date().toISOString().slice(0, 10);

const NOTE_MAX = 1000;

// The note Markdown renderer pulls in KaTeX, so it is loaded on demand — only
// when a note actually needs rendering — keeping chapter pages lean otherwise.
let renderNote: ((s: string) => string) | null = null;
const previewTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

async function paintNotePreview(preview: HTMLElement | null, raw: string): Promise<void> {
  if (!preview) return;
  if (!raw) {
    preview.hidden = true;
    preview.textContent = "";
    return;
  }
  if (!renderNote) renderNote = (await import("../md-notes")).renderNote;
  preview.innerHTML = renderNote(raw);
  preview.hidden = false;
}

/** Debounced preview render, so live typing doesn't re-render on every keystroke. */
function scheduleNotePreview(preview: HTMLElement | null, raw: string): void {
  if (!preview) return;
  const prev = previewTimers.get(preview);
  if (prev) clearTimeout(prev);
  previewTimers.set(preview, setTimeout(() => void paintNotePreview(preview, raw), 250));
}

function paintNoteCount(count: HTMLElement | null, len: number): void {
  if (!count) return;
  count.textContent = len + " / " + NOTE_MAX;
  count.classList.toggle("near", len > NOTE_MAX * 0.9);
}

/** (Re)reflect saved state onto one control bar. */
function applyStudy(bar: HTMLElement): void {
  const qel = bar.closest("details.q") as HTMLElement | null;
  if (!qel) return;
  const id = qel.id;
  const rev = bar.querySelector(".rev-box") as HTMLInputElement;
  const wrongBtn = bar.querySelector(".wrong-btn") as HTMLElement;
  const noteArea = bar.querySelector(".note-area") as HTMLTextAreaElement;
  const noteCount = bar.querySelector(".note-count") as HTMLElement | null;
  const notePreview = bar.querySelector(".note-preview") as HTMLElement | null;
  const due = bar.querySelector(".srs-due") as HTMLElement;

  rev.checked = Store.isReviewed(id);
  wrongBtn.classList.toggle("on", Store.isWrong(id));
  const noteText = Store.note(id);
  if (!noteArea.matches(":focus")) {
    noteArea.value = noteText;
    paintNoteCount(noteCount, noteText.length);
    void paintNotePreview(notePreview, noteText);
  }
  qel.classList.toggle("has-note", !!noteText);
  qel.classList.toggle("is-reviewed", Store.isReviewed(id));

  const d = Store.due(id);
  const overdue = !!d && d <= todayStr();
  qel.classList.toggle("is-due", overdue);
  if (d) {
    due.textContent = overdue ? "🔔 Review due — tap ✓" : "next review " + d;
    due.className = "srs-due" + (overdue ? " over" : "");
    due.hidden = false;
    due.title = overdue ? "Mark as reviewed now" : "Scheduled — comes back for review when due";
  } else {
    due.textContent = "";
    due.hidden = true;
  }
}

export function initStudy(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(".study").forEach((bar) => {
    if (bar.dataset.wired) {
      applyStudy(bar);
      return;
    }
    bar.dataset.wired = "1";
    const qel = bar.closest("details.q") as HTMLElement | null;
    if (!qel) return;
    const id = qel.id;
    const rev = bar.querySelector(".rev-box") as HTMLInputElement;
    const wrongBtn = bar.querySelector(".wrong-btn") as HTMLElement;
    const noteBtn = bar.querySelector(".note-btn") as HTMLElement;
    const noteWrap = bar.querySelector(".note-wrap") as HTMLElement;
    const noteArea = bar.querySelector(".note-area") as HTMLTextAreaElement;
    const noteCount = bar.querySelector(".note-count") as HTMLElement | null;
    const notePreview = bar.querySelector(".note-preview") as HTMLElement | null;
    const due = bar.querySelector(".srs-due") as HTMLElement | null;

    applyStudy(bar);
    rev.addEventListener("change", () => {
      Store.setReviewed(id, rev.checked);
      applyStudy(bar);
    });
    // one-tap "mark reviewed" on the due pill — ONLY when the card is actually
    // due/overdue. A future "next review DATE" pill is just info; clicking it did
    // nothing useful and repeatedly pushed the schedule further out with no undo.
    due?.addEventListener("click", () => {
      const d = Store.due(id);
      if (d && d <= todayStr()) {
        Store.setReviewed(id, true);
        applyStudy(bar);
      }
    });
    wrongBtn.addEventListener("click", () => {
      Store.setWrong(id, !Store.isWrong(id));
      applyStudy(bar);
    });
    noteBtn.addEventListener("click", () => {
      noteWrap.hidden = !noteWrap.hidden;
      if (!noteWrap.hidden) noteArea.focus();
    });
    noteArea.addEventListener("input", () => {
      let v = noteArea.value;
      if (v.length > NOTE_MAX) {
        v = v.slice(0, NOTE_MAX);
        noteArea.value = v;
      }
      const trimmed = v.trim();
      Store.setNote(id, trimmed);
      qel.classList.toggle("has-note", !!trimmed);
      paintNoteCount(noteCount, v.length);
      scheduleNotePreview(notePreview, trimmed);
    });
  });
}

export function applyAllStudy(): void {
  document.querySelectorAll<HTMLElement>(".study").forEach(applyStudy);
}
