import katex from "katex";

/**
 * Tiny markdown + build-time KaTeX renderer — a TypeScript port of the helpers
 * that used to live in build.py. Math is rendered to HTML *at build time* with
 * katex.renderToString, so the shipped pages need no client-side KaTeX JS.
 *
 * Supported markdown: **bold**, `code`, fenced ```code``` blocks, $inline$ /
 * $$display$$ math, and newlines. HTML is escaped first; math + code are kept
 * intact. The layout helpers (breakQuestion / breakAnswer) reproduce the
 * line-breaking the old site used so multi-part questions and labelled answers
 * keep their shape.
 */

function escapeHtml(s: string): string {
  // html.escape(s, quote=False): escape & < > but not quotes.
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false });
  } catch {
    return escapeHtml(tex);
  }
}

const MATH_RE = /\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;

/** Inline markdown: **bold**, `code`, $math$, newlines -> <br>. */
export function mdInline(input: string): string {
  const spans: string[] = [];
  // 1. stash math spans (rendered now), leave a NUL-delimited placeholder that
  //    survives the escape pass and never collides with real content.
  let s = input.replace(MATH_RE, (_m, disp, inl) => {
    const isDisplay = disp !== undefined;
    spans.push(renderTex((isDisplay ? disp : inl) ?? "", isDisplay));
    return "\x00" + (spans.length - 1) + "\x00";
  });
  // 2. escape, then apply simple inline markdown
  s = escapeHtml(s);
  s = s.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/`([^`]+?)`/g, "<code>$1</code>");
  s = s.replace(/\n/g, "<br>");
  // 3. restore rendered math
  s = s.replace(/\x00(\d+)\x00/g, (_m, i) => spans[Number(i)]);
  return s;
}

const FENCE_RE = /```(?:\w+)?\n([\s\S]*?)```/g;

/** Block markdown: fenced ```code``` blocks + paragraphs. */
export function mdBlock(s: string): string {
  const out: string[] = [];
  let i = 0;
  for (const m of s.matchAll(FENCE_RE)) {
    const start = m.index ?? 0;
    const pre = s.slice(i, start).trim();
    if (pre) out.push("<p>" + mdInline(pre) + "</p>");
    out.push("<pre class='code'>" + escapeHtml(m[1]) + "</pre>");
    i = start + m[0].length;
  }
  const rest = s.slice(i).trim();
  if (rest) out.push("<p>" + mdInline(rest) + "</p>");
  return out.join("\n");
}

/** Render a question body: block form only when it embeds a code fence. */
export function renderQuestion(q: string): string {
  const broken = breakQuestion(q);
  return broken.includes("```") ? mdBlock(broken) : mdInline(broken);
}

/** Render an answer / recap: break before clause-leading **bold** labels. */
export function renderAnswer(s: string): string {
  return mdBlock(breakAnswer(s));
}

/** Strip markdown / LaTeX / code to plain text for the search index. */
export function plain(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, " ")
    .replace(/[*`#>_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---- line-break layout helpers (ported from build.py) -------------------

/** Insert a newline before each given index, eating preceding spaces and
 *  never doubling an existing newline. Applied back-to-front to keep indices. */
function insertBreaks(s: string, positions: number[]): string {
  for (const pos of [...positions].sort((a, b) => b - a)) {
    let k = pos;
    while (k > 0 && s[k - 1] === " ") k--;
    if (k > 0 && s[k - 1] !== "\n") s = s.slice(0, k) + "\n" + s.slice(pos);
  }
  return s;
}

const Q_MARKER = /\((?:\d+(?:\.\d+)*|[a-z]|[ivx]{1,3})\)/g;

/** Put a formula-led sub-part marker like "(8.3)" on its own line. */
export function breakQuestion(s: string): string {
  const cuts: number[] = [];
  let prev = 0;
  for (const m of s.matchAll(Q_MARKER)) {
    const start = m.index ?? 0;
    const spaced = start === 0 || s[start - 1] === " " || s[start - 1] === "\n";
    if (spaced && start !== 0 && s.slice(prev, start).includes("$")) cuts.push(start);
    if (spaced) prev = start + m[0].length;
  }
  return insertBreaks(s, cuts);
}

const A_BOLD = /\*\*[^*]+?\*\*/g;
const CLAUSE_END = new Set([".", "?", "!", ":", ";"]);

/** Break before any **bold** span that starts a new clause (after . ? ! : ;). */
export function breakAnswer(s: string): string {
  const cuts: number[] = [];
  for (const m of s.matchAll(A_BOLD)) {
    const start = m.index ?? 0;
    if (start === 0) continue;
    const before = s.slice(0, start).replace(/\s+$/, "");
    if (before && CLAUSE_END.has(before[before.length - 1])) cuts.push(start);
  }
  return insertBreaks(s, cuts);
}
