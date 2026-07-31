import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(repoRoot, "data");
const chapterFiles = fs
  .readdirSync(dataDir)
  .filter((file) => /^ch\d\d_.*\.json$/.test(file))
  .sort();

let knowledgePointCount = 0;
let aiQuestionCount = 0;
let minimum = Number.POSITIVE_INFINITY;
let maximum = 0;
const failures = [];

for (const file of chapterFiles) {
  const chapter = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  for (const knowledgePoint of chapter.knowledge_points) {
    const count = knowledgePoint.questions.filter(
      (question) => question.type === "ai",
    ).length;
    knowledgePointCount += 1;
    aiQuestionCount += count;
    minimum = Math.min(minimum, count);
    maximum = Math.max(maximum, count);
    if (count < 2) {
      failures.push(
        chapter.id +
          "/" +
          knowledgePoint.id +
          " has " +
          count +
          " AI question" +
          (count === 1 ? "" : "s"),
      );
    }
  }
}

if (failures.length > 0) {
  console.error("AI coverage check failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log(
  "AI coverage OK: " +
    knowledgePointCount +
    " knowledge points, " +
    aiQuestionCount +
    " AI questions (minimum " +
    minimum +
    ", maximum " +
    maximum +
    " per knowledge point).",
);
