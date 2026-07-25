import { defineCollection } from "astro:content";
import { z } from "astro:schema";
import { glob } from "astro/loaders";

// One JSON file per chapter (data/chNN_*.json). The Zod schema replaces the
// hand-rolled structural validation the old tools/check_*.py did, and gives
// type-safe content everywhere it is consumed.

const option = z.object({
  text: z.string(),
  correct: z.boolean(),
});

const calcAnswer = z.object({
  label: z.string().optional(),
  value: z.number(),
  tol: z.number().optional(),
});

const figure = z.object({
  src: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

const question = z
  .object({
    type: z.enum(["open", "mc", "ai"]),
    freq: z.number().int().nonnegative(),
    sources: z.array(z.string()).min(1),
    q: z.string().min(1),
    answer: z.string().min(1),
    extend: z.string().optional(),
    tags: z.array(z.string()).optional(),
    options: z.array(option).optional(),
    calc: z.array(calcAnswer).optional(),
    figure: figure.optional(),
  })
  .refine((q) => q.type !== "mc" || (q.options?.length ?? 0) >= 2, {
    message: "multiple-choice questions need at least two options",
  });

const knowledgePoint = z.object({
  id: z.string(),
  title: z.string(),
  recap: z.string(),
  questions: z.array(question),
});

const chapters = defineCollection({
  loader: glob({ pattern: "ch??_*.json", base: "./data" }),
  schema: z.object({
    id: z.string(),
    roman: z.string(),
    title: z.string(),
    blurb: z.string(),
    knowledge_points: z.array(knowledgePoint),
  }),
});

export const collections = { chapters };

// Re-export the explicit content types (see src/lib/types.ts). Kept in sync
// with the Zod schema above, which still validates the JSON at build time.
export type { QuestionData, KnowledgePointData, ChapterData } from "./lib/types";
