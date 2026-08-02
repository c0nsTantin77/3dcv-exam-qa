import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(
  path.join(repoRoot, "src", "lib", "client", "store.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const moduleUrl =
  "data:text/javascript;base64," +
  Buffer.from(compiled, "utf8").toString("base64");

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};
globalThis.window = { addEventListener: () => {} };

const firstLoad = await import(moduleUrl + "#first-load");
firstLoad.Store.setNote("q-note-regression", "survives immediate refresh");

const raw = storage.get("cv2_progress_v1");
if (!raw) {
  throw new Error("setNote did not persist synchronously");
}
if (JSON.parse(raw).notes?.["q-note-regression"] !== "survives immediate refresh") {
  throw new Error("persisted note does not match the typed value");
}

const refreshed = await import(moduleUrl + "#refreshed");
if (refreshed.Store.note("q-note-regression") !== "survives immediate refresh") {
  throw new Error("note was not restored after a simulated refresh");
}

console.log("Note persistence OK: a newly typed note survives an immediate refresh.");
