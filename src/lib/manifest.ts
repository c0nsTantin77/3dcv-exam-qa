import manifestJson from "../../data/chapters.json";

export interface ChapterEntry {
  id: string;
  roman: string;
  title: string;
  file: string;
  status: "ready" | "soon" | string;
}

export interface Manifest {
  course: string;
  subtitle: string;
  exams: string[];
  chapters: ChapterEntry[];
}

export const manifest = manifestJson as Manifest;

/** Chapters that are published, in syllabus order. */
export const readyChapters = manifest.chapters.filter((c) => c.status === "ready");

/** Chapter number (1-based) from an id like "ch01" -> 1. */
export function chapterNumber(id: string): number {
  return parseInt(id.replace(/\D/g, ""), 10) || 0;
}
