import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(repoRoot, "data");
const manifest = JSON.parse(
  fs.readFileSync(path.join(dataDir, "chapters.json"), "utf8"),
);
const counts = Object.fromEntries(manifest.exams.map((code) => [code, 0]));
const questionManifest = JSON.parse(
  fs.readFileSync(path.join(dataDir, "exam-question-manifest.json"), "utf8"),
);
const labels = Object.fromEntries(
  Object.keys(questionManifest).map((code) => [code, new Set()]),
);
const exerciseOccurrences = new Map();
const sourceCode = /^(\d\d[MER][A-Z]{2}|EX\d\d)\b/;

for (const file of fs.readdirSync(dataDir)) {
  if (!/^ch\d\d_.*\.json$/.test(file)) continue;
  const chapter = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  for (const knowledgePoint of chapter.knowledge_points) {
    for (const question of knowledgePoint.questions) {
      const seen = new Set();
      for (const source of question.sources) {
        const code = source.match(sourceCode)?.[1];
        if (code && code in counts && !seen.has(code)) {
          counts[code] += 1;
          seen.add(code);
        }
        if (code && code in labels) {
          const label = source.slice(code.length).trim();
          labels[code].add(label);
          if (code.startsWith("EX")) {
            const key = `${code} ${label}`;
            exerciseOccurrences.set(key, (exerciseOccurrences.get(key) ?? 0) + 1);
          }
        }
      }
    }
  }
}

const empty = Object.entries(counts)
  .filter(([, count]) => count === 0)
  .map(([code]) => code);

if (empty.length > 0) {
  console.error("Exam coverage check failed; no questions for: " + empty.join(", "));
  process.exit(1);
}

const incomplete = [];
for (const [code, expected] of Object.entries(questionManifest)) {
  const actual = labels[code] ?? new Set();
  const missing = expected.filter((label) => !actual.has(label));
  const unexpected = [...actual].filter((label) => !expected.includes(label));
  if (missing.length || unexpected.length) {
    incomplete.push({ code, missing, unexpected });
  }
}

const duplicateExercises = [...exerciseOccurrences]
  .filter(([, count]) => count !== 1)
  .map(([source, count]) => `${source} (${count} cards)`);

if (incomplete.length > 0 || duplicateExercises.length > 0) {
  console.error("Exact exam-question coverage failed:");
  for (const item of incomplete) {
    if (item.missing.length) {
      console.error("  " + item.code + " missing: " + item.missing.join(", "));
    }
    if (item.unexpected.length) {
      console.error("  " + item.code + " unexpected: " + item.unexpected.join(", "));
    }
  }
  if (duplicateExercises.length) {
    console.error("  duplicate exercise sub-questions: " + duplicateExercises.join(", "));
  }
  process.exit(1);
}

console.log(
  "Exam coverage OK: " +
    Object.entries(counts)
      .map(([code, count]) => code + "=" + count)
      .join(", "),
);
console.log(
  "Exact paper coverage OK: " +
    Object.entries(questionManifest)
      .map(([code, expected]) => code + "=" + expected.length + "/" + expected.length)
      .join(", "),
);
