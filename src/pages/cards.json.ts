import type { APIRoute } from "astro";
import { getOrderedChapters, sortedQuestions } from "../lib/content";
import { qid } from "../lib/qid";
import { renderQuestion, renderAnswer, mdInline } from "../lib/md";

// Flashcard payload, generated at build time and fetched only when the user
// starts a flashcard session (review page). Question/answer/options are
// PRE-RENDERED to HTML here (KaTeX at build time) so the review-page island
// ships no markdown/KaTeX renderer of its own — it just drops the HTML in.
export const GET: APIRoute = async () => {
  const chapters = await getOrderedChapters();
  const cards = [];
  for (const ch of chapters) {
    for (const kp of ch.data.knowledge_points) {
      for (const q of sortedQuestions(kp.questions)) {
        cards.push({
          a: qid(kp.id, q.q),
          q: renderQuestion(q.q),
          ans: renderAnswer(q.answer),
          ext: q.extend ? renderAnswer(q.extend) : "",
          t: q.type,
          opts: q.options
            ? q.options.map((o) => ({ text: mdInline(o.text), correct: o.correct }))
            : null,
          calc: q.calc ?? null,
          src: q.sources[0],
          ct: ch.data.title,
          kp: kp.title,
          fig: q.figure ?? null,
        });
      }
    }
  }
  return new Response(JSON.stringify(cards), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
