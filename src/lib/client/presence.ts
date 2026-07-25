// Live "people online now" banner via Firebase Realtime Database. Each open tab
// pushes a child under /presence and removes it on disconnect (server-side
// onDisconnect), so the count tracks real concurrent visitors with no backend.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const firebase: any;

function render(n: number): void {
  const el = document.getElementById("presence-bar");
  if (!el) return;
  const others = Math.max(0, n - 1);
  el.textContent =
    others > 0
      ? "🟢 You are not alone! " +
        others +
        (others === 1 ? " other person is" : " others are") +
        " studying right now"
      : "🟢 You're the only one studying right now — keep going!";
  el.classList.add("show");
}

export function startPresence(): void {
  try {
    const dbRT = firebase.database();
    const listRef = dbRT.ref("presence");
    const connRef = dbRT.ref(".info/connected");
    connRef.on("value", (snap: any) => {
      if (snap.val() !== true) return;
      const myRef = listRef.push();
      myRef.onDisconnect().remove();
      myRef.set({ t: firebase.database.ServerValue.TIMESTAMP });
    });
    listRef.on("value", (snap: any) => render(snap.numChildren()));
  } catch (e) {
    console.warn("Presence init failed", e);
  }
}
