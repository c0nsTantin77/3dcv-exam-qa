// Shared helpers for the short-answer self-check: turn a student's free text into
// the set of meaningful words to green-highlight against the reference answer,
// with light singular/plural variants (common in ML terms). Used by the chapter
// self-test (open-answer.ts) and the flashcard deck.

const STOP = new Set([
  "the", "a", "an", "of", "to", "is", "are", "and", "or", "in", "on", "for", "with",
  "as", "it", "its", "by", "be", "that", "this", "which", "not", "no", "also", "can",
  "used", "use", "using", "via", "your", "you", "we", "they", "their", "from", "at",
  "any", "all", "one", "two", "each", "per", "must", "may", "only", "more", "less",
  "but", "if", "so", "than", "then", "into", "over", "out", "up", "do", "does", "has",
]);

/** Distinct meaningful words the student typed (drop stop-words and very short). */
export function userWords(s: string): string[] {
  return [
    ...new Set(
      s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)),
    ),
  ];
}

/** Light singular/plural variants so "parameter" also matches "parameters" etc. */
export function wordVariants(w: string): string[] {
  const v = new Set([w]);
  if (w.length >= 4 && w.endsWith("s")) v.add(w.slice(0, -1));
  if (w.length >= 5 && w.endsWith("es")) v.add(w.slice(0, -2));
  if (!w.endsWith("s")) v.add(w + "s");
  return [...v].filter((x) => x.length >= 3);
}
