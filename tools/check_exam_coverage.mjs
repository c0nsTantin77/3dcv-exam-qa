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
const exerciseProblemOccurrences = new Map();
const exerciseMetadataErrors = [];
const stableExerciseIds = new Map();
const sourceCode = /^(\d\d[MER][A-Z]{2}|EX\d\d)\b/;

for (const file of fs.readdirSync(dataDir)) {
  if (!/^ch\d\d_.*\.json$/.test(file)) continue;
  const chapter = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  for (const knowledgePoint of chapter.knowledge_points) {
    for (const question of knowledgePoint.questions) {
      const seen = new Set();
      const exerciseSources = question.sources.filter((source) => source.startsWith("EX"));
      for (const source of exerciseSources) {
        exerciseProblemOccurrences.set(source, (exerciseProblemOccurrences.get(source) ?? 0) + 1);
        if (!/^EX\d\d \d+$/.test(source)) {
          exerciseMetadataErrors.push(`${source}: displayed source must stop at the problem number`);
        }
      }
      if (exerciseSources.length && !(question.coverage?.length > 0)) {
        exerciseMetadataErrors.push(`${exerciseSources.join(", ")}: missing hidden sub-question coverage`);
      }
      if (exerciseSources.length && !question.id) {
        exerciseMetadataErrors.push(`${exerciseSources.join(", ")}: missing stable id for notes/progress`);
      } else if (exerciseSources.length) {
        const previous = stableExerciseIds.get(question.id);
        if (previous) {
          exerciseMetadataErrors.push(`${question.id}: reused by ${previous} and ${exerciseSources.join(", ")}`);
        }
        stableExerciseIds.set(question.id, exerciseSources.join(", "));
      }
      for (const source of question.sources) {
        const code = source.match(sourceCode)?.[1];
        if (code && code in counts && !seen.has(code)) {
          counts[code] += 1;
          seen.add(code);
        }
        if (code && code in labels && !code.startsWith("EX")) {
          const label = source.slice(code.length).trim();
          labels[code].add(label);
        }
      }
      for (const covered of question.coverage ?? []) {
        const match = covered.match(/^(EX\d\d)\s+(.+)$/);
        if (!match || !(match[1] in labels)) {
          exerciseMetadataErrors.push(`${covered}: invalid hidden coverage label`);
          continue;
        }
        const [, code, label] = match;
        const problem = label.match(/^\d+/)?.[0];
        if (!problem || !exerciseSources.includes(`${code} ${problem}`)) {
          exerciseMetadataErrors.push(`${covered}: no matching displayed problem source`);
        }
        const subpart = label.match(/[a-z]$/)?.[0];
        if (subpart && !question.q.includes(`(${subpart})`)) {
          exerciseMetadataErrors.push(`${covered}: visible question is missing the (${subpart}) prompt`);
        }
        labels[code].add(label);
        exerciseOccurrences.set(covered, (exerciseOccurrences.get(covered) ?? 0) + 1);
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

const expectedExerciseProblems = new Set();
for (const [code, expected] of Object.entries(questionManifest)) {
  if (!code.startsWith("EX")) continue;
  for (const label of expected) {
    expectedExerciseProblems.add(`${code} ${label.match(/^\d+/)?.[0]}`);
  }
}
const exerciseProblemErrors = [];
for (const source of expectedExerciseProblems) {
  const count = exerciseProblemOccurrences.get(source) ?? 0;
  if (count !== 1) exerciseProblemErrors.push(`${source} (${count} cards)`);
}
for (const source of exerciseProblemOccurrences.keys()) {
  if (!expectedExerciseProblems.has(source)) exerciseProblemErrors.push(`${source} (unexpected problem)`);
}

const requiredPreambleFragments = {
  "EX02 5": ["four-dimensional extension", "conjugate", "unit quaternion"],
  "EX02 7": ["unit complex number", "mutually orthogonal 2D planes"],
  "EX03 2": ["camera coordinates", "non-homogeneous coordinates", "s_x=s_y=1", "s_\\theta=0", "pixel coordinates"],
  "EX03 3": ["generic projection", "normalized image plane"],
  "EX03 4": ["after $\\pi$ and before $K$", "(i)", "(ii)", "(iii)"],
  "EX03 5": ["forward direction", "inverse direction", "normalized distorted coordinates"],
  "EX04 1": ["consecutive frames", "intensities are preserved"],
  "EX04 2": ["window $W(x)$", "Gaussian weighting kernel", "convolution"],
  "EX04 3": ["valid only for small displacements", "image pyramid"],
  "EX04 4": ["positive semi-definite (why?)", "direct geometric meaning"],
  "EX05 1": ["Camera 1 is at the origin", "normalized-coordinate projections"],
  "EX05 2": ["projection of camera 1's center", "projection of camera 2's center"],
  "EX05 4": ["linear in the nine entries"],
  "EX05 6": ["five degrees of freedom", "algebraic constraint"],
  "EX05 7": ["candidate rotations and translation matrices", "R_1=", "\\hat T_1="],
  "EX06 1": ["homogeneous 3D point", "where $\\hat x$ is"],
  "EX06 3": ["viewing rays of a stereo pair are skew", "shortest connecting segment"],
  "EX07 1": ["We want to minimize", "residual vector"],
  "EX07 2": ["add damping", "typically $I$"],
  "EX07 3": ["Huber loss", "F_\\rho"],
  "EX07 4": ["jointly optimizes camera poses and 3D landmarks", "exactly one camera and one landmark"],
  "EX07 5": ["Levenberg-Marquardt normal equations", "In block form"],
  "EX08 1": ["RGB-D frame", "The warp is", "backprojects a pixel with depth"],
  "EX08 2": ["photometric residual", "image-gradient", "transformation-Jacobian"],
  "EX08 3": ["standard forward approach", "inverse-compositional formulation"],
  "EX08 6": ["measured relative transformations", "where $\\log"],
};
const exerciseQuestions = new Map();
for (const file of fs.readdirSync(dataDir)) {
  if (!/^ch\d\d_.*\.json$/.test(file)) continue;
  const chapter = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  for (const knowledgePoint of chapter.knowledge_points) {
    for (const question of knowledgePoint.questions) {
      for (const source of question.sources.filter((item) => item.startsWith("EX"))) {
        exerciseQuestions.set(source, question.q);
      }
    }
  }
}
const preambleErrors = [];
for (const [source, fragments] of Object.entries(requiredPreambleFragments)) {
  const prompt = exerciseQuestions.get(source) ?? "";
  const normalizedPrompt = prompt.toLowerCase();
  const missing = fragments.filter((fragment) => !normalizedPrompt.includes(fragment.toLowerCase()));
  if (missing.length) preambleErrors.push(`${source} missing: ${missing.join(", ")}`);
}

if (incomplete.length > 0 || duplicateExercises.length > 0 || exerciseProblemErrors.length > 0 || preambleErrors.length > 0 || exerciseMetadataErrors.length > 0) {
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
  if (exerciseProblemErrors.length) {
    console.error("  exercise problems must each occupy exactly one complete card: " + exerciseProblemErrors.join(", "));
  }
  if (preambleErrors.length) {
    console.error("  missing original exercise preambles: " + preambleErrors.join("; "));
  }
  if (exerciseMetadataErrors.length) {
    console.error("  exercise metadata errors: " + exerciseMetadataErrors.join("; "));
  }
  process.exit(1);
}

console.log(
  "Exam coverage OK: " +
    Object.entries(counts)
      .map(([code, count]) => code + "=" + count)
      .join(", "),
);
console.log(`Complete exercise-card structure OK: ${expectedExerciseProblems.size} problems, one card each; required preambles present.`);
console.log(
  "Exact paper coverage OK: " +
    Object.entries(questionManifest)
      .map(([code, expected]) => code + "=" + expected.length + "/" + expected.length)
      .join(", "),
);
