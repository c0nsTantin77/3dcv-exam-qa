// Live "people online now" banner via Firebase Realtime Database. Each open tab
// owns one connection record. onDisconnect removes it, while a heartbeat and
// five-minute freshness window prevent abandoned records inflating the count.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const firebase: any;

const HEARTBEAT_MS = 60_000;
const ACTIVE_WINDOW_MS = 5 * 60_000;

let started = false;

function hide(): void {
  const el = document.getElementById("presence-bar");
  if (!el) return;
  el.textContent = "";
  el.classList.remove("show");
}

function render(n: number): void {
  const el = document.getElementById("presence-bar");
  if (!el || n < 1) {
    hide();
    return;
  }

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
  if (started) return;
  started = true;

  try {
    const dbRT = firebase.database();
    const listRef = dbRT.ref("presence");
    const connRef = dbRT.ref(".info/connected");
    const recentRef = listRef
      .orderByChild("t")
      .startAt(Date.now() - ACTIVE_WINDOW_MS);

    let joined = false;
    let myRef: any = null;
    let heartbeatId: number | undefined;
    let latestSnapshot: any = null;

    const stopHeartbeat = (): void => {
      if (heartbeatId !== undefined) window.clearInterval(heartbeatId);
      heartbeatId = undefined;
    };

    const renderSnapshot = (snap: any): void => {
      if (!joined) {
        hide();
        return;
      }

      const cutoff = Date.now() - ACTIVE_WINDOW_MS;
      let active = 0;
      snap.forEach((child: any) => {
        const timestamp = child.child("t").val();
        if (typeof timestamp === "number" && timestamp >= cutoff) active += 1;
      });
      render(active);
    };

    recentRef.on(
      "value",
      (snap: any) => {
        latestSnapshot = snap;
        renderSnapshot(snap);
      },
      (error: unknown) => {
        hide();
        console.warn("Presence read failed", error);
      },
    );

    const freshnessId = window.setInterval(() => {
      if (latestSnapshot) renderSnapshot(latestSnapshot);
    }, HEARTBEAT_MS);

    connRef.on("value", (snap: any) => {
      if (snap.val() !== true) {
        joined = false;
        myRef = null;
        stopHeartbeat();
        hide();
        return;
      }
      if (myRef) return;

      const connectionRef = listRef.push();
      myRef = connectionRef;

      // Register server-side cleanup before publishing the online record.
      connectionRef
        .onDisconnect()
        .remove()
        .then(() => connectionRef.set({ t: firebase.database.ServerValue.TIMESTAMP }))
        .then(() => {
          if (myRef !== connectionRef) return;
          joined = true;
          if (latestSnapshot) renderSnapshot(latestSnapshot);
          heartbeatId = window.setInterval(() => {
            connectionRef
              .update({ t: firebase.database.ServerValue.TIMESTAMP })
              .catch((error: unknown) => console.warn("Presence heartbeat failed", error));
          }, HEARTBEAT_MS);
        })
        .catch((error: unknown) => {
          if (myRef === connectionRef) myRef = null;
          joined = false;
          hide();
          console.warn("Presence write failed", error);
        });
    });

    window.addEventListener("pagehide", (event: PageTransitionEvent) => {
      if (event.persisted) return;
      window.clearInterval(freshnessId);
      stopHeartbeat();
      if (myRef) myRef.remove().catch(() => undefined);
    });
  } catch (e) {
    started = false;
    hide();
    console.warn("Presence init failed", e);
  }
}
