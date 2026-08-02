import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(repoRoot, "data");
const manifest = JSON.parse(
  fs.readFileSync(path.join(dataDir, "chapters.json"), "utf8"),
);
const counts = Object.fromEntries(manifest.exams.map((code) => [code, 0]));
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

console.log(
  "Exam coverage OK: " +
    Object.entries(counts)
      .map(([code, count]) => code + "=" + count)
      .join(", "),
);
