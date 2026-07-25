import katex from "katex";

// Lightweight Markdown renderer for *user* notes (rendered in the browser, so it
// must escape HTML). Supports a deliberately small, safe subset:
//   **bold**  *italic*  `code`  - / 1. lists  [text](url)  $inline$ / $$display$$
// Math is rendered with KaTeX. Pulled in via a dynamic import (see study.ts) so
// the heavy KaTeX bundle only loads on pages where a note actually exists.

export const NOTE_MAX = 1000;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTex(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false });
  } catch {
    return escapeHtml(tex);
  }
}

const MATH_RE = /\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;
const CODE_RE = /`([^`]+?)`/g;
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g;

/** Inline span markdown on a single logical line. */
function inline(s: string): string {
  const stash: string[] = [];
  const keep = (html: string): string => "\x00" + (stash.push(html) - 1) + "\x00";
  // 1. render + stash math and inline code BEFORE escaping, so their contents survive
  s = s.replace(MATH_RE, (_m, disp, inl) => keep(renderTex((disp !== undefined ? disp : inl) ?? "", disp !== undefined)));
  s = s.replace(CODE_RE, (_m, c) => keep("<code>" + escapeHtml(c) + "</code>"));
  // 2. escape the rest, then apply text markdown
  s = escapeHtml(s);
  s = s.replace(LINK_RE, (_m, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer nofollow">${t}</a>`);
  s = s.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
  // 3. restore stashed spans
  return s.replace(/\x00(\d+)\x00/g, (_m, i) => stash[Number(i)]);
}

/** Render a note string to safe HTML (paragraphs + simple lists). */
export function renderNote(src: string): string {
  const lines = (src || "").slice(0, NOTE_MAX).replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = (): void => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ul) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push("<li>" + inline(ul[1]) + "</li>");
    } else if (ol) {
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push("<li>" + inline(ol[1]) + "</li>");
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push("<p>" + inline(line) + "</p>");
    }
  }
  closeList();
  return out.join("");
}
