import { Store } from "./store";

// One-time study-data key migration hook. Whenever two questions are merged
// during a content pass, map the removed duplicate's stable id (qid) onto the
// kept question's id here, so a user's reviewed / wrong book / notes / SRS data
// is preserved rather than orphaned in localStorage and the cloud doc.
//
// Idempotent and flag-free: once the old ids are gone (after the first run) it
// is a cheap no-op, so it is safe to call again after a cloud merge that may
// re-introduce old ids from another device.

// removed-duplicate qid -> kept-question qid
const MERGES: Record<string, string> = {};

const PAIRS = Object.entries(MERGES) as [string, string][];

export function runMigrations(): void {
  if (PAIRS.length === 0) return;
  try {
    Store.migrate(PAIRS);
  } catch {
    /* never block page init on a migration hiccup */
  }
}
