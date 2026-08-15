#!/usr/bin/env node
// ============================================================================
// The seven-step workflow is written once. This proves it.
//
//   node tests/governance/workflow.check.mjs
//
// Needs nothing: no Docker, no network, no database. Reads the tracked
// markdown files.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
//
// `CLAUDE.md` §1 carries the seven-step workflow and says so: it is "the only
// mechanism that constrains all three at once", and §2 puts it first in the
// order of sources. On 2026-08-15 the same seven steps also existed, written
// out as a numbered list, in `TEAM.md` §7 and in `docs/v2/SPEC.md` §5.1.
//
// Three copies that agree are not a problem the day they are written. They are
// a problem the day one of them is edited. This repository has the receipt:
// the ownership model was amended in `CLAUDE.md` §1 and the amendment note had
// to name six other documents that still described the old one, because they
// had each restated it. `SPEC.md` says two copies of a graph drift "in the
// direction that makes the plan look better" — prose drifts the same way, and
// a session reads whichever document it opened.
//
// So the rule is: **the numbered list lives in `CLAUDE.md` §1, and every other
// document points at it.** A document may add whatever its own audience needs
// — what `ready` means on the V2 board, which lane a surface belongs to, what
// happens when a steward is away. What it may not do is restate the steps,
// because a restatement is a copy and a copy goes stale silently.
//
// ---------------------------------------------------------------------------
// WHAT THIS CATCHES, AND WHAT IT DOES NOT
//
// The key phrases are not written here. They are EXTRACTED from `CLAUDE.md`
// §1 — every bolded run in each step, long ones only — so rewording the
// canonical list moves the detector with it and there is no fourth copy to
// maintain.
//
// That makes the detector one of phrase reuse, which is what copy-paste
// produces and is how all three copies came to exist. **It does not catch a
// restatement written from scratch in different words.** Nothing mechanical
// does; that one is caught by section 3 below only if the file forgets to cite
// `CLAUDE.md` §1 as well.
// ============================================================================
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
let fail = 0;
const chk = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) {
    pass++;
    console.log(`PASS  ${name}  (${g})`);
  } else {
    fail++;
    console.log(`FAIL  ${name}\n        got  ${g}\n        want ${w}`);
  }
};

// Markdown emphasis and code ticks are formatting, not content: `TEAM.md`
// bolds "`ready`" where CLAUDE.md bolds the whole sentence around it. Strip
// both before comparing, or the check is testing typography.
const norm = (s) =>
  s.replace(/[*`_]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const CANON = "CLAUDE.md";
const CLAUDE = read(CANON);

// ---------------------------------------------------------------------------
// 1. The canonical list is intact and says how long it is
//
//    CLAUDE.md §9 records its own version of this failure: the stated check
//    count went wrong twice in two commits. A heading that says "seven steps"
//    over a list of six is the same defect one document up.
// ---------------------------------------------------------------------------
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven",
  "eight", "nine", "ten"];

const secRe = /\n### The workflow, in ([a-z]+) steps\n([\s\S]*?)(?=\n> |\n## |\n### )/;
const sec = CLAUDE.match(secRe);
if (!sec) {
  console.log(
    "FAIL  the canonical workflow section could not be located\n" +
      "        CLAUDE.md's '### The workflow, in <n> steps' heading was renamed,\n" +
      "        and every assertion below would pass vacuously",
  );
  process.exit(1);
}

// A step runs from its "N. " line to the next one — the steps wrap.
const steps = [];
for (const line of sec[2].split("\n")) {
  const m = line.match(/^(\d+)\.\s+(.*)$/);
  if (m) steps.push({ n: Number(m[1]), text: m[2] });
  else if (steps.length && line.trim()) steps[steps.length - 1].text += " " + line.trim();
}

chk("CLAUDE.md §1: the heading's step count matches the list", WORDS.indexOf(sec[1]), steps.length);
chk(
  "CLAUDE.md §1: the steps are numbered 1..N in order",
  steps.map((s) => s.n),
  Array.from({ length: steps.length }, (_, i) => i + 1),
);

// Every bolded run in a step is one of that step's fingerprints, and a
// document matches the step if it reuses ANY of them. Taking only the longest
// was the first design and a probe killed it: deleting one of step 4's two
// bolds left the other standing, so the check still passed while the detector
// for "expected change surface" had quietly gone away.
//
// Short runs are dropped. Step 2's first bold is "Claim it" — two words that
// appear in any prose about claiming a ticket, and a fingerprint that matches
// everything identifies nothing.
//
// The opening words of the step are a fingerprint too, and the one that does
// not move when the emphasis does. A second probe killed the bolds-only
// design as well: unbold "expected change surface" in step 4 and paste a copy
// of step 4 into another document, and the copy is invisible, because the only
// fingerprint left was step 4's *other* bold, which the copy did not use.
// Emphasis is the most-edited thing in a markdown sentence; the words are not.
const MIN = 12;
const LEAD = 7; // words — long enough to be specific, short enough to survive an edit
const phrases = [];
for (const s of steps) {
  const bolds = [...s.text.matchAll(/\*\*(.+?)\*\*/g)]
    .map((m) => norm(m[1]).replace(/[.:,;]+$/, ""));
  const lead = norm(s.text).split(" ").slice(0, LEAD).join(" ");
  phrases.push({
    n: s.n,
    fingerprints: [...new Set([...bolds, lead])].filter((t) => t.length >= MIN),
  });
}
// Two fingerprints per step, minimum. One is a single point of failure: the
// step that has only its lead words is a step that stops being detectable the
// moment someone reflows the sentence.
chk(
  "CLAUDE.md §1: no step rests on a single fingerprint",
  phrases.filter((p) => p.fingerprints.length < 2).map((p) => p.n),
  [],
);
// A fingerprint shared by two steps cannot say which one a copy came from,
// and would report the same document twice for one restatement.
const seen = new Map();
for (const p of phrases) for (const fp of p.fingerprints) {
  seen.set(fp, [...(seen.get(fp) ?? []), p.n]);
}
chk(
  "CLAUDE.md §1: no fingerprint belongs to two steps",
  [...seen.entries()].filter(([, ns]) => ns.length > 1).map(([fp]) => fp),
  [],
);

// ---------------------------------------------------------------------------
// 2. No other document restates the steps as a numbered list
// ---------------------------------------------------------------------------
const files = execFileSync("git", ["ls-files", "*.md"], { cwd: ROOT, encoding: "utf8" })
  .split("\n").filter(Boolean).filter((f) => !f.startsWith("node_modules/"));
chk("the tracked markdown set was found", files.length > 5, true);

const numberedLines = new Map(); // path -> normalized "N. …" lines
for (const f of files) {
  const out = [];
  const src = read(f).split("\n");
  for (let i = 0; i < src.length; i++) {
    if (!/^\s*\d+\.\s+\S/.test(src[i])) continue;
    // a numbered item wraps; join its continuation so a phrase split across
    // a line break is still one string
    let t = src[i];
    while (i + 1 < src.length && /^\s+\S/.test(src[i + 1]) && !/^\s*\d+\.\s/.test(src[i + 1])) {
      t += " " + src[++i].trim();
    }
    out.push(norm(t));
  }
  numberedLines.set(f, out);
}

for (const { n, fingerprints } of phrases) {
  const where = files.filter((f) =>
    numberedLines.get(f).some((l) => fingerprints.some((fp) => l.includes(fp)))
  );
  chk(`step ${n} is a numbered step in exactly one document`, where, [CANON]);
}

// ---------------------------------------------------------------------------
// 3. Anything that talks about the workflow points at the canonical statement
//
//    A document is "talking about the workflow" if it names it — "seven steps",
//    "seven-step" — or reuses two or more of the canonical phrases anywhere,
//    prose or table cell. Two is the threshold on the second trigger because
//    one is a coincidence: "expected change surface" appears on its own in a
//    lane table that is not describing the workflow at all.
//
//    The first trigger is the load-bearing one, and it was not the original.
//    The original used only the phrase count — and the moment section 2 was
//    satisfied by deleting the two restatements, the phrase count fell below
//    the threshold everywhere and this section went vacuous. The vacuity guard
//    below is what said so. A check that passes because it stopped looking is
//    the failure mode `negative.sh` exists for; here it announced itself.
// ---------------------------------------------------------------------------
const CITES = /`?CLAUDE\.md`?\s*§1\b/;
const NAMES_IT = /seven[ -]steps?\b/i;
const talkers = [];
for (const f of files) {
  if (f === CANON) continue;
  const raw = read(f);
  const body = norm(raw);
  const hits = phrases.filter((p) => p.fingerprints.some((fp) => body.includes(fp))).length;
  if (NAMES_IT.test(raw) || hits >= 2) talkers.push(f);
}
chk("more than one document discusses the workflow (else this check is vacuous)", talkers.length > 1, true);
chk(
  "every document discussing the workflow cites CLAUDE.md §1 as the governing one",
  talkers.filter((f) => !CITES.test(read(f))),
  [],
);

console.log();
console.log(`${pass} passed, ${fail} failed`);
console.log(fail === 0 ? "GOVERNANCE-WORKFLOW: PASS" : "GOVERNANCE-WORKFLOW: FAIL");
process.exit(fail === 0 ? 0 : 1);
