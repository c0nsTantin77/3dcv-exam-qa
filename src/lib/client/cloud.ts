import { Store, setCloudSchedule, type Progress } from "./store";
import { applyAllStudy } from "./study";
import { renderProgressUI } from "./progress";
import { startPresence } from "./presence";
import { runMigrations } from "./migrate";
import type { FirebaseConfig } from "../config";

// Cloud sync (Firebase) — localStorage stays primary; this batches the single
// progress doc per user (push on a 30s interval / on tab hide). Firebase compat
// SDKs are loaded on demand from gstatic so they cost nothing until configured.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const firebase: any;

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";

const load = (src: string): Promise<void> =>
  new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res();
    s.onerror = rej;
    document.head.appendChild(s);
  });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function initAnalytics(cfg: FirebaseConfig): void {
  if (!cfg.measurementId) return;
  // Analytics is optional: blockers or unsupported browsers must not disable
  // authentication, cloud sync, or realtime presence.
  void load(FB + "firebase-analytics-compat.js")
    .then(() => firebase.analytics())
    .catch((e: unknown) => console.warn("Firebase Analytics init failed", e));
}

let db: any = null;
let uid: string | null = null;
let ready = false;
let dirty = false;

const cloudDocument = (): Record<string, unknown> => ({
  progress: Store.data(),
  // Keep the numeric field for compatibility. Retention should use only the
  // server-generated Timestamp below, never this client-controlled value.
  updated: Date.now(),
  lastActiveAt: firebase.firestore.FieldValue.serverTimestamp(),
  retentionPolicyVersion: 1,
});

function mergeProgress(local: Progress, cloud: Partial<Progress>): Progress {
  const out: any = {};
  (["reviewed", "wrong", "srs", "activity", "notes"] as (keyof Progress)[]).forEach((k) => {
    out[k] = Object.assign({}, cloud[k] || {}, local[k] || {});
  });
  return out as Progress;
}

function pushNow(): void {
  if (!ready || !uid) return;
  dirty = false;
  db.collection("users")
    .doc(uid)
    .set(cloudDocument(), { merge: true })
    .catch((e: unknown) => {
      dirty = true;
      console.warn("cloud push failed", e);
    });
}

async function pullMergePush(): Promise<void> {
  try {
    const activeUid = uid;
    if (!activeUid) return;
    const document = db.collection("users").doc(activeUid);
    const doc = await document.get();
    const cloud = doc.exists ? doc.data().progress || {} : {};
    const merged = mergeProgress(Store.data(), cloud);
    Store.importBlob(JSON.stringify(merged));
    // a cloud doc from another device may still carry pre-dedup ids
    runMigrations();
    // A successful sign-in counts as activity even if no study data changed.
    await document.set(cloudDocument(), { merge: true });
    applyAllStudy();
    renderProgressUI();
  } catch (e) {
    console.warn("cloud pull failed", e);
  }
}

function renderAuth(user: any): void {
  const el = document.getElementById("authctl");
  if (!el) return;
  if (user) {
    el.innerHTML =
      "<span class='auth-on'>☁ Synced · " +
      esc(user.email || user.displayName || "signed in") +
      "</span><button type='button' class='auth-btn' id='signoutBtn'>Sign out</button>";
    el.querySelector("#signoutBtn")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      signOut();
    });
  } else {
    el.innerHTML =
      "<button type='button' class='auth-btn primary' id='signinBtn'>Sign in to sync</button>";
    el.querySelector("#signinBtn")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      signIn();
    });
  }
}

function signIn(): void {
  firebase
    .auth()
    .signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .catch((e: any) => alert("Sign-in failed: " + e.message));
}

function signOut(): void {
  if (dirty) pushNow();
  firebase.auth().signOut();
}

async function init(cfg: FirebaseConfig): Promise<void> {
  try {
    await load(FB + "firebase-app-compat.js");
    const extra = [load(FB + "firebase-auth-compat.js"), load(FB + "firebase-firestore-compat.js")];
    if (cfg.databaseURL) extra.push(load(FB + "firebase-database-compat.js"));
    await Promise.all(extra);
    firebase.initializeApp(cfg);
    initAnalytics(cfg);
    db = firebase.firestore();
    if (cfg.databaseURL) startPresence();
    firebase.auth().onAuthStateChanged(async (user: any) => {
      if (user) {
        uid = user.uid;
        ready = true;
        await pullMergePush();
        renderAuth(user);
      } else {
        uid = null;
        ready = false;
        renderAuth(null);
      }
    });
  } catch (e) {
    console.warn("Firebase init failed", e);
  }
}

setInterval(() => {
  if (dirty) pushNow();
}, 30000);
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.hidden && dirty) pushNow();
  });
  window.addEventListener("beforeunload", () => {
    if (dirty) pushNow();
  });
}

/** Wire the Store -> cloud "dirty" hook and kick off Firebase. */
export function initCloud(cfg: FirebaseConfig): void {
  setCloudSchedule(() => {
    dirty = true;
  });
  const a = document.getElementById("authctl");
  if (a) a.innerHTML = "<span class='auth-load'>☁ sync loading…</span>";
  init(cfg);
}
