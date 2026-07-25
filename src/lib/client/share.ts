// Share button: copy the site link so users can send it to a friend.

interface ShareBtn extends HTMLElement {
  _t?: ReturnType<typeof setTimeout>;
}

export function initShare(): void {
  document.querySelectorAll<ShareBtn>(".share-pill").forEach((btn) => {
    const txt = btn.querySelector<HTMLElement>(".share-txt");
    btn.addEventListener("click", async () => {
      const url = btn.dataset.share || location.href;
      let ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          ok = true;
        } else {
          const ta = document.createElement("textarea");
          ta.value = url;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          ok = document.execCommand("copy");
          document.body.removeChild(ta);
        }
      } catch {
        ok = false;
      }
      // GA4 share event — only for the real "share with a friend" button
      // (has data-share), so the GitHub-star link doesn't fire it.
      if (ok && btn.dataset.share) {
        (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.(
          "event",
          "share",
          { method: "copy_link", content_type: "website", item_id: "share-with-a-friend" },
        );
      }
      if (!txt) return;
      const orig = btn.dataset.label || (btn.dataset.label = txt.textContent ?? "");
      txt.textContent = ok ? "Copied — paste & send! 🎉" : "Press Ctrl+C to copy";
      btn.classList.toggle("copied", ok);
      if (btn._t) clearTimeout(btn._t);
      btn._t = setTimeout(() => {
        txt.textContent = orig;
        btn.classList.remove("copied");
      }, 1800);
    });
  });
}
