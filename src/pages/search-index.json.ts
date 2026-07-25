import type { APIRoute } from "astro";
import { buildSearchIndex } from "../lib/content";

// Static JSON, generated at build time. The client search/tag/exam/review
// islands fetch this once (see src/lib/client/index-data.ts) instead of the
// old inlined window.SEARCH_INDEX blob.
export const GET: APIRoute = async () => {
  const index = await buildSearchIndex();
  return new Response(JSON.stringify(index), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
