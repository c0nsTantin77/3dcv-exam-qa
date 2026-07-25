// Base-aware URL helper. Astro's BASE_URL is "/3dcv-exam-qa/"; this joins paths
// onto it without doubling slashes. Works at build (.astro) and on the client
// (import.meta.env.BASE_URL is statically inlined).
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function url(path: string): string {
  return BASE + (path.startsWith("/") ? path : "/" + path);
}
