import assert from "node:assert/strict";
import {
  contextualQuestionHref,
  examReturnCode,
  examReturnHref,
  initExamReturn,
  isExamCode,
} from "../src/lib/client/exam-return.ts";

const base = "/3dcv-exam-qa";
const entry = { chapter: "ch05", anchor: "q-eight-point" };

assert.equal(
  contextualQuestionHref(base, entry.chapter, entry.anchor),
  "/3dcv-exam-qa/chapters/ch05/#q-eight-point",
  "ordinary links must remain unchanged",
);
assert.equal(
  contextualQuestionHref(base, entry.chapter, entry.anchor, "23ELI"),
  "/3dcv-exam-qa/chapters/ch05/?fromExam=23ELI#q-eight-point",
  "exam context must appear before the hash so it survives navigation and refresh",
);
assert.equal(
  contextualQuestionHref(base, entry.chapter, entry.anchor, "bad-code"),
  "/3dcv-exam-qa/chapters/ch05/#q-eight-point",
  "invalid context must not be reflected into a URL",
);

assert.equal(isExamCode("23ELI"), true);
assert.equal(isExamCode("EX05"), true);
assert.equal(isExamCode("23eli"), false);
assert.equal(isExamCode("../exams"), false);

const chapterSources = ["25EDC 2.1", "23ELI 3a", "EX05 4"];
assert.equal(
  examReturnCode("?fromExam=23ELI", chapterSources),
  "23ELI",
  "a matching past-paper context should be accepted",
);
assert.equal(
  examReturnCode("?fromExam=ex05", chapterSources),
  "EX05",
  "exercise-sheet codes should be normalized and accepted",
);
assert.equal(
  examReturnCode("?fromExam=23RLI", chapterSources),
  null,
  "a valid code not present in the chapter must not create a misleading button",
);
assert.equal(
  examReturnCode("?fromExam=%3Cscript%3E", chapterSources),
  null,
  "malformed or unsafe context must be rejected",
);
assert.equal(examReturnCode("", chapterSources), null);
assert.equal(
  examReturnHref("/3dcv-exam-qa/exams", "23ELI"),
  "/3dcv-exam-qa/exams?e=23ELI",
);

const codeLabel = { textContent: "exam" };
const matchingSource = {
  textContent: "23ELI 3a",
  getAttribute: (name) => (name === "title" ? "2023 Endterm · Li" : null),
};
const linkAttributes = new Map();
const link = {
  dataset: { examsBase: "/3dcv-exam-qa/exams" },
  hidden: true,
  href: "",
  title: "",
  querySelector: (selector) => (selector === ".exam-return-code" ? codeLabel : null),
  removeAttribute: (name) => {
    if (name === "href") link.href = "";
    linkAttributes.delete(name);
  },
  setAttribute: (name, value) => linkAttributes.set(name, value),
};

globalThis.document = {
  getElementById: (id) => (id === "examReturn" ? link : null),
  querySelectorAll: () => [matchingSource],
};
globalThis.location = { search: "?fromExam=23eli" };
initExamReturn();

assert.equal(link.hidden, false, "a matching context must reveal the topbar link");
assert.equal(link.href, "/3dcv-exam-qa/exams?e=23ELI");
assert.equal(link.title, "Back to 2023 Endterm · Li");
assert.equal(linkAttributes.get("aria-label"), "Back to 2023 Endterm · Li");
assert.equal(codeLabel.textContent, "23ELI");

globalThis.location.search = "?fromExam=23RLI";
initExamReturn();
assert.equal(link.hidden, true, "a mismatched context must keep the link hidden");
assert.equal(link.href, "", "a hidden invalid link must not retain a stale destination");

console.log("Exam return navigation OK: contextual, refreshed, invalid, and non-exam paths covered.");
