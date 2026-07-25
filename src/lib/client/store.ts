// Progress store — one JSON blob in localStorage, key-compatible with the old
// site so existing users keep their reviewed / wrong book / notes / SRS data.
// The cloud sync layer (cloud.ts) batch-pushes this same object, one doc/user.

const KEY = "cv2_progress_v1";
const SRS_DAYS = [1, 2, 4, 7, 15, 30, 60]; // Ebbinghaus-style intervals
const DAY = 86400000;

const today = (): string => new Date().toISOString().slice(0, 10);
const addDays = (n: number): string =>
  new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

export interface SrsEntry {
  n: number;
  last?: string;
  due?: string;
  ef?: number; // SM-2 ease factor (flashcard self-rating)
  ivl?: number; // SM-2 interval in days
  reps?: number; // SM-2 consecutive successful reps
}

export type Rating = "again" | "hard" | "good" | "easy";
const RATING_Q: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };

/** SM-2 next interval (days) from the current entry + a rating. Pure helper so
 *  the UI can preview "what each button schedules" before committing. */
export function sm2Next(s: SrsEntry | undefined, r: Rating): { ivl: number; ef: number; reps: number } {
  let ef = s?.ef ?? 2.5;
  let ivl = s?.ivl ?? 0;
  let reps = s?.reps ?? 0;
  const q = RATING_Q[r];
  if (q < 3) {
    reps = 0;
    ivl = 1; // lapse → relearn tomorrow
  } else {
    if (reps === 0) ivl = r === "easy" ? 3 : 1;
    else if (reps === 1) ivl = r === "hard" ? 4 : 6;
    else {
      const mult = r === "hard" ? 1.2 : r === "easy" ? ef * 1.3 : ef;
      ivl = Math.max(1, Math.round(ivl * mult));
    }
    reps += 1;
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return { ivl, ef: Math.round(ef * 100) / 100, reps };
}

export interface Progress {
  reviewed: Record<string, number>;
  wrong: Record<string, number>;
  notes: Record<string, string>;
  srs: Record<string, SrsEntry>;
  activity: Record<string, number>;
}

const SECTIONS: (keyof Progress)[] = ["reviewed", "wrong", "notes", "srs", "activity"];

function load(): Progress {
  let p: Partial<Progress> = {};
  try {
    p = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch {
    p = {};
  }
  for (const k of SECTIONS) if (!p[k]) (p as unknown as Record<string, unknown>)[k] = {};
  return p as Progress;
}

let P: Progress = load();
let timer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

const listeners = new Set<() => void>();
/** Subscribe to store changes (UI re-renders on persist/import). */
export function onChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(): void {
  listeners.forEach((fn) => fn());
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(P));
  } catch {
    /* quota / private mode — keep working in-memory */
  }
  dirty = false;
  cloudSchedule?.(P);
  emit();
}

function save(): void {
  dirty = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(persist, 600);
}

function bumpActivity(): void {
  const d = today();
  P.activity[d] = (P.activity[d] || 0) + 1;
}

// optional cloud hook, wired by cloud.ts
let cloudSchedule: ((p: Progress) => void) | null = null;
export function setCloudSchedule(fn: (p: Progress) => void): void {
  cloudSchedule = fn;
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.hidden && dirty) persist();
  });
  window.addEventListener("beforeunload", () => {
    if (dirty) persist();
  });
}

export const Store = {
  data: (): Progress => P,
  isReviewed: (id: string): boolean => !!P.reviewed[id],
  isWrong: (id: string): boolean => !!P.wrong[id],
  note: (id: string): string => P.notes[id] || "",
  due: (id: string): string | null => (P.srs[id] ? P.srs[id].due ?? null : null),

  setReviewed(id: string, on: boolean): void {
    if (on) {
      P.reviewed[id] = Date.now();
      const s = P.srs[id] || { n: 0 };
      s.n = Math.min((s.n || 0) + 1, SRS_DAYS.length);
      s.last = today();
      s.due = addDays(SRS_DAYS[s.n - 1]);
      P.srs[id] = s;
      bumpActivity();
    } else {
      delete P.reviewed[id];
      delete P.srs[id];
    }
    save();
  },

  setWrong(id: string, on: boolean): void {
    if (on) {
      P.wrong[id] = Date.now();
      P.srs[id] = { n: 0, last: today(), due: addDays(1) };
      bumpActivity();
    } else {
      delete P.wrong[id];
    }
    save();
  },

  /** Flashcard self-rating (SM-2). Schedules the next review and counts as
   *  reviewed; a lapse ("again") drops the card into the wrong book. */
  rate(id: string, r: Rating): void {
    const s = P.srs[id] || { n: 0 };
    const { ivl, ef, reps } = sm2Next(s, r);
    s.ef = ef;
    s.ivl = ivl;
    s.reps = reps;
    s.n = Math.min(reps || 1, SRS_DAYS.length);
    s.last = today();
    s.due = addDays(ivl);
    P.srs[id] = s;
    P.reviewed[id] = P.reviewed[id] || Date.now();
    if (r === "again") P.wrong[id] = P.wrong[id] || Date.now();
    bumpActivity();
    save();
  },

  srsEntry: (id: string): SrsEntry | undefined => P.srs[id],

  setNote(id: string, text: string): void {
    if (text) P.notes[id] = text;
    else delete P.notes[id];
    save();
  },

  dueList(ids: string[]): string[] {
    const t = today();
    return ids.filter((id) => P.srs[id] && P.srs[id].due && (P.srs[id].due as string) <= t);
  },

  wrongIds: (): string[] => Object.keys(P.wrong),
  reviewedIds: (): string[] => Object.keys(P.reviewed),
  exportBlob: (): string => JSON.stringify(P, null, 2),

  importBlob(json: string): void {
    const obj = JSON.parse(json) as Partial<Progress>;
    for (const k of SECTIONS) {
      (P as unknown as Record<string, unknown>)[k] = obj[k] || P[k] || {};
    }
    persist();
  },

  /** Wipe ALL study progress (reviewed / wrong / notes / SRS / activity). */
  reset(): void {
    for (const k of SECTIONS) (P as unknown as Record<string, unknown>)[k] = {};
    persist();
  },

  /** Remap study data from removed (de-duplicated) question ids onto the kept
   *  question id, so reviewed / wrong / notes / SRS survive a content merge
   *  instead of orphaning. Idempotent: once an old id is gone it is a no-op.
   *  Returns the number of fields moved. */
  migrate(pairs: [string, string][]): number {
    let changed = 0;
    for (const [oldId, newId] of pairs) {
      if (oldId === newId) continue;
      if (P.notes[oldId]) {
        P.notes[newId] = P.notes[newId]
          ? P.notes[newId] + "\n\n" + P.notes[oldId]
          : P.notes[oldId];
        delete P.notes[oldId];
        changed++;
      }
      for (const k of ["reviewed", "wrong"] as const) {
        if (P[k][oldId] != null) {
          P[k][newId] = P[k][newId] != null ? Math.min(P[k][newId], P[k][oldId]) : P[k][oldId];
          delete P[k][oldId];
          changed++;
        }
      }
      if (P.srs[oldId]) {
        const o = P.srs[oldId];
        const n = P.srs[newId];
        // keep the more-advanced schedule (higher n; tie → earlier due)
        P.srs[newId] = !n
          ? o
          : o.n > n.n
            ? o
            : o.n < n.n
              ? n
              : (o.due ?? "9999") <= (n.due ?? "9999") ? o : n;
        delete P.srs[oldId];
        changed++;
      }
    }
    if (changed) persist();
    return changed;
  },
};
