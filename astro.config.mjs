// @ts-check
import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";

// GitHub Pages project site: served under /3dcv-exam-qa/.
// Math is rendered at build time (KaTeX renderToString in src/lib/md.ts),
// so there is no client-side KaTeX JS — only the stylesheet is loaded.
// SITE_BASE lets a preview build live under a sub-path (e.g.
// /3dcv-exam-qa/preview) without touching the production root. Defaults to the
// production base. All internal links use this via import.meta.env.BASE_URL.
export default defineConfig({
  site: "https://c0nsTantin77.github.io",
  base: process.env.SITE_BASE || "/3dcv-exam-qa",
  trailingSlash: "ignore",
  integrations: [vue()],
  build: {
    // emit clean URLs: /chapters/ch01/ instead of /chapters/ch01.html
    format: "directory",
    assets: "_assets",
  },
  devToolbar: { enabled: false },
});
