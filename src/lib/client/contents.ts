// Topbar "you are here" pill + floating contents popover with scroll-spy.
// Used on chapter pages (server-rendered section links) and re-run by the
// tag/exam islands once their sections are rendered.

export function slug(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface ContentsGroup {
  id: string;
  title: string;
  n: number;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Build the popover list from rendered groups, then (re)wire the pill. */
export function buildContents(groups: ContentsGroup[]): void {
  const pop = document.getElementById("tocPop");
  if (!pop) return;
  pop.innerHTML =
    "<ol>" +
    groups
      .map(
        (g) =>
          "<li><a href='#" +
          g.id +
          "'><span class='toc-label'>" +
          escapeHtml(g.title) +
          "</span><span class='toc-n'>" +
          g.n +
          "</span></a></li>",
      )
      .join("") +
    "</ol>";
  setupContentsPill();
}

interface PillEl extends HTMLElement {
  _io?: IntersectionObserver;
}

export function setupContentsPill(): void {
  const pill = document.getElementById("nowAt") as PillEl | null;
  const pop = document.getElementById("tocPop");
  const here = pill && pill.querySelector(".nowat-here");
  if (!pill || !pop) return;
  const wrap = pill.closest(".nowat-wrap") as HTMLElement | null;
  const links = Array.from(pop.querySelectorAll<HTMLAnchorElement>("a[href^='#']"));
  if (!links.length) {
    if (wrap) wrap.hidden = true;
    return;
  }
  if (wrap) wrap.hidden = false;

  const place = () => {
    if (window.innerWidth <= 700) {
      const pr = pill.getBoundingClientRect();
      pop.style.position = "fixed";
      pop.style.left = "8px";
      pop.style.right = "8px";
      pop.style.width = "auto";
      pop.style.maxWidth = "none";
      pop.style.top = Math.round(pr.bottom + 6) + "px";
    } else {
      pop.style.position = "";
      pop.style.right = "";
      pop.style.top = "";
      pop.style.width = "";
      pop.style.maxWidth = "";
      pop.style.left = "0px";
      const r = pop.getBoundingClientRect();
      const m = 8;
      let shift = 0;
      if (r.right > window.innerWidth - m) shift = window.innerWidth - m - r.right;
      if (r.left + shift < m) shift = m - r.left;
      pop.style.left = shift + "px";
    }
  };

  const setOpen = (on: boolean) => {
    pop.hidden = !on;
    pill.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) place();
  };

  if (!pill.dataset.wired) {
    pill.dataset.wired = "1";
    window.addEventListener("resize", () => {
      if (!pop.hidden) place();
    });
    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(Boolean(pop.hidden));
    });
    pop.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("a")) setOpen(false);
    });
    document.addEventListener("click", (e) => {
      if (!pop.hidden && !pop.contains(e.target as Node) && !pill.contains(e.target as Node))
        setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  // scroll-spy
  const linkFor = new Map<Element, HTMLAnchorElement>();
  links.forEach((a) => {
    const el = document.getElementById(decodeURIComponent(a.getAttribute("href")!.slice(1)));
    if (el) linkFor.set(el, a);
  });
  let active: HTMLAnchorElement | null = null;
  const setActive = (a: HTMLAnchorElement | undefined) => {
    if (!a || a === active) return;
    if (active) active.classList.remove("active");
    active = a;
    active.classList.add("active");
    if (here) {
      here.textContent = "";
      const n = a.querySelector(".toc-num");
      if (n) {
        const s = document.createElement("span");
        s.className = "nowat-n";
        s.textContent = n.textContent;
        here.appendChild(s);
      }
      const lbl = a.querySelector(".toc-label");
      here.appendChild(document.createTextNode(lbl ? lbl.textContent ?? "" : a.textContent ?? ""));
    }
    if (!pop.hidden) active.scrollIntoView({ block: "nearest" });
  };

  if ("IntersectionObserver" in window) {
    if (pill._io) pill._io.disconnect();
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis.length) setActive(linkFor.get(vis[0].target));
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 },
    );
    linkFor.forEach((_a, el) => io.observe(el));
    pill._io = io;
  }
  setActive(links[0]);
}
