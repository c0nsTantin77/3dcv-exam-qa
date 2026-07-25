import { createHash } from "node:crypto";

/**
 * Stable per-question id — MUST byte-for-byte match the legacy Python generator
 * (`build.py: qid`), because these ids key persistent user study data
 * (reviewed / wrong book / notes / SRS) in localStorage and Firestore.
 * Changing the algorithm would orphan every existing user's progress.
 *
 *   Python:  "q" + sha1((kp_id + "::" + q.q).encode("utf-8")).hexdigest()[:9]
 *
 * Build-time only (Node crypto); the client never recomputes ids — they are
 * baked into the rendered HTML and the search index.
 */
export function qid(kpId: string, questionText: string): string {
  const h = createHash("sha1").update(kpId + "::" + questionText, "utf8").digest("hex");
  return "q" + h.slice(0, 9);
}
