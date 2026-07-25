import type { SearchEntry } from "../types";

// Fetch the generated search index once and cache the promise, so every island
// that needs it (search, tags, exams, review, progress) shares one request.

let cache: Promise<SearchEntry[]> | null = null;

export function loadIndex(): Promise<SearchEntry[]> {
  if (!cache) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    cache = fetch(`${base}/search-index.json`)
      .then((r) => r.json() as Promise<SearchEntry[]>)
      .catch((e) => {
        console.warn("search index load failed", e);
        return [] as SearchEntry[];
      });
  }
  return cache;
}

/** Map a search entry to the URL of its question, relative to the current page. */
export function questionHref(e: SearchEntry): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/chapters/${e.c}/#${e.a}`;
}

export const TYPE_LABEL: Record<string, string> = { mc: "MC", open: "Open", ai: "AI" };
