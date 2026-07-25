// Shared types with no build-only (`astro:content`) imports, so both the build
// (content.ts) and the client islands can use them.

// Content shape — kept in sync with the Zod schema in content.config.ts. Using
// explicit interfaces (rather than z.infer) keeps component props concretely
// typed regardless of how the schema is wrapped (.refine etc.).
export interface OptionData {
  text: string;
  correct: boolean;
}
export interface CalcAnswer {
  /** optional label for multi-part numeric answers, e.g. "(a)" or "MSE" */
  label?: string;
  /** expected numeric value */
  value: number;
  /** allowed absolute tolerance (default exact) */
  tol?: number;
}
export interface FigureData {
  /** file under public/figures/, e.g. "ss24-p3.png" */
  src: string;
  alt?: string;
  caption?: string;
}
export interface QuestionData {
  type: "open" | "mc" | "ai";
  freq: number;
  sources: string[];
  q: string;
  answer: string;
  extend?: string;
  tags?: string[];
  options?: OptionData[];
  /** numeric answer boxes for calculation questions (typed & auto-checked) */
  calc?: CalcAnswer[];
  /** an exam figure shown with the question (stored under public/figures/) */
  figure?: FigureData;
}
export interface KnowledgePointData {
  id: string;
  title: string;
  recap: string;
  questions: QuestionData[];
}
export interface ChapterData {
  id: string;
  roman: string;
  title: string;
  blurb: string;
  knowledge_points: KnowledgePointData[];
}

/** One search-index entry per question. Field names are short to keep the
 *  generated /search-index.json small. */
export interface SearchEntry {
  /** chapter id (ch01) */ c: string;
  /** chapter title */ ct: string;
  /** knowledge-point title */ kp: string;
  /** stable question anchor / study id */ a: string;
  /** type: open | mc | ai */ t: string;
  /** first source */ src: string;
  /** all sources */ srcs: string[];
  /** plain-text question */ q: string;
  /** concept tags */ tg: string[];
  /** lowercased searchable blob */ txt: string;
}
