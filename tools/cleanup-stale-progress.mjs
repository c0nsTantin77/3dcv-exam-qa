#!/usr/bin/env node

// Uses the Firestore REST API so the maintenance job needs no runtime
// dependency beyond Node 22 and the short-lived access token minted by GitHub
// Workload Identity Federation.

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_MODES = new Set(["cleanup", "migrate", "all"]);

function integerEnv(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function booleanEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be "true" or "false".`);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const accessToken = process.env.FIRESTORE_ACCESS_TOKEN;
if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required.");
if (!accessToken) throw new Error("FIRESTORE_ACCESS_TOKEN is required.");

const mode = process.env.CLEANUP_MODE || "cleanup";
if (!VALID_MODES.has(mode)) {
  throw new Error(`CLEANUP_MODE must be one of: ${[...VALID_MODES].join(", ")}.`);
}

const dryRun = booleanEnv("CLEANUP_DRY_RUN", true);
const retentionDays = integerEnv("RETENTION_DAYS", 180, 30, 3650);
const pageSize = integerEnv("CLEANUP_PAGE_SIZE", 400, 1, 500);
const maxScanned = integerEnv("CLEANUP_MAX_SCANNED", 10000, 1, 50000);
const maxChanges = integerEnv("CLEANUP_MAX_CHANGES", 10000, 1, 10000);

if (!dryRun && process.env.CLEANUP_CONFIRM_PROJECT !== projectId) {
  throw new Error(
    "Refusing to modify Firestore: CLEANUP_CONFIRM_PROJECT must exactly match FIREBASE_PROJECT_ID.",
  );
}

const databaseRoot =
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
  "/databases/(default)";
const documentsRoot = `${databaseRoot}/documents`;

async function firestoreRequest(url, options = {}, attempt = 0) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return firestoreRequest(url, options, 1);
    }
    throw new Error(`Firestore ${response.status}: ${body.slice(0, 1000)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function batchWrite(writes) {
  for (let start = 0; start < writes.length; start += pageSize) {
    const response = await firestoreRequest(`${documentsRoot}:batchWrite`, {
      method: "POST",
      body: JSON.stringify({ writes: writes.slice(start, start + pageSize) }),
    });
    const failures = (response.status || []).filter((status) => status.code);
    if (failures.length) {
      throw new Error(
        `Firestore rejected ${failures.length} batch writes: ` +
          failures.map((status) => status.message || `code ${status.code}`).join("; "),
      );
    }
  }
}

function hasValidTimestamp(document) {
  const value = document.fields?.lastActiveAt?.timestampValue;
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

/**
 * Give legacy documents a fresh server-side activity Timestamp. This is a
 * deliberate grace period: no pre-policy user can be deleted immediately.
 */
async function migrateLegacyDocuments() {
  let scanned = 0;
  let candidates = 0;
  let pageToken = "";
  let exhausted = false;

  while (scanned < maxScanned && candidates < maxChanges && !exhausted) {
    const remaining = maxScanned - scanned;
    const params = new URLSearchParams({
      pageSize: String(Math.min(pageSize, remaining)),
      "mask.fieldPaths": "lastActiveAt",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await firestoreRequest(`${documentsRoot}/users?${params}`);
    const documents = response.documents || [];
    pageToken = response.nextPageToken || "";
    exhausted = !pageToken;
    if (!documents.length) break;

    const writes = [];
    for (const document of documents) {
      scanned += 1;
      if (hasValidTimestamp(document)) continue;

      candidates += 1;
      if (!dryRun) {
        writes.push({
          update: {
            name: document.name,
            fields: {
              retentionPolicyVersion: { integerValue: "1" },
            },
          },
          updateMask: {
            fieldPaths: ["retentionPolicyVersion"],
          },
          updateTransforms: [
            {
              fieldPath: "lastActiveAt",
              setToServerValue: "REQUEST_TIME",
            },
          ],
          currentDocument: { exists: true },
        });
      }
      if (candidates >= maxChanges) break;
    }
    if (writes.length) await batchWrite(writes);
  }

  console.log(
    JSON.stringify({
      operation: "migrate",
      dryRun,
      scanned,
      legacyCandidates: candidates,
      changed: dryRun ? 0 : candidates,
      scanLimitReached: scanned >= maxScanned && !exhausted,
      changeLimitReached: candidates >= maxChanges,
    }),
  );
}

/**
 * Delete only the Firestore progress document. Firebase Authentication users
 * are intentionally outside this script's scope.
 */
async function cleanupExpiredDocuments() {
  const cutoff = new Date(Date.now() - retentionDays * DAY_MS).toISOString();
  const response = await firestoreRequest(`${documentsRoot}:runQuery`, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        select: {
          fields: [{ fieldPath: "__name__" }, { fieldPath: "lastActiveAt" }],
        },
        from: [{ collectionId: "users" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "lastActiveAt" },
            op: "LESS_THAN",
            value: { timestampValue: cutoff },
          },
        },
        orderBy: [
          {
            field: { fieldPath: "lastActiveAt" },
            direction: "ASCENDING",
          },
        ],
        limit: maxScanned,
      },
    }),
  });

  const documents = response.flatMap((item) => (item.document ? [item.document] : []));
  let skippedInvalidTimestamp = 0;
  const candidates = [];

  for (const document of documents) {
    if (!hasValidTimestamp(document)) {
      skippedInvalidTimestamp += 1;
      continue;
    }
    candidates.push(document);
    if (candidates.length >= maxChanges) break;
  }

  if (!dryRun) {
    await batchWrite(
      candidates.map((document) => ({
        delete: document.name,
        currentDocument: { exists: true },
      })),
    );
  }

  console.log(
    JSON.stringify({
      operation: "cleanup",
      dryRun,
      retentionDays,
      cutoff,
      scanned: documents.length,
      expiredCandidates: candidates.length,
      deleted: dryRun ? 0 : candidates.length,
      skippedInvalidTimestamp,
      scanLimitReached: documents.length >= maxScanned,
      changeLimitReached: candidates.length >= maxChanges,
    }),
  );
}

console.log(
  JSON.stringify({
    operation: "start",
    projectId,
    mode,
    dryRun,
    retentionDays,
    maxScanned,
    maxChanges,
  }),
);

if (mode === "migrate" || mode === "all") await migrateLegacyDocuments();
if (mode === "cleanup" || mode === "all") await cleanupExpiredDocuments();
