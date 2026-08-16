#!/usr/bin/env node
// ============================================================================
// The V2 board states its own totals in prose. This recomputes every one.
//
//   node tests/v2/graph.check.mjs
//
// Needs nothing: no Docker, no network, no database. Reads three markdown files.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
//
// docs/v2/SPEC.md §4.3 has a `blocks` column. docs/v2/TICKETS.md has a
// `blocked on` column. They are THE SAME GRAPH, WRITTEN TWICE — SPEC.md says
// so itself, and says two copies of a graph drift "in the direction that makes
// the plan look better." It then claims they "were checked against each other
// mechanically." That was true when it was written, by a session, once, by
// hand. There was no way for the next reader to confirm it and no way for the
// next editor to fail. This file is that sentence, made runnable.
//
// The counts are the same problem one level up. Both documents state totals in
// English — "39 tickets", "67 dependency edges", "Seven tickets startable" —
// and every one of those goes stale the moment a cell changes. CLAUDE.md §9
// records the same failure in the guard suite: its stated check count went
// wrong twice in two commits before a check started parsing it. So the numbers
// below are not recomputed and reported. They are recomputed and ASSERTED
// against what the prose claims, and a disagreement is a failure.
//
// ---------------------------------------------------------------------------
// WHAT IT FOUND THE FIRST TIME IT RAN
//
// Nothing — and that is worth writing down, because it is the finding. Every
// stated number was correct: 39, 67, 33, 24, 23, O11, 7, 12, 14, 27-of-39, all
// ten reproduced exactly. The board was internally consistent and it was still
// wrong, because six real blockers (D-01 §5, now O25–O30) had no ids, and an
// item with no id cannot appear in either copy of a graph. A consistency check
// cannot see a question that was never written as data. That is what the
// "every O-id is contiguous" and "every cited id exists" assertions below are
// for, and it is why they are not enough on their own.
// ============================================================================
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
/* Same, but null instead of throwing — for the citation resolver, which probes
   several candidate locations for one cited basename and must not die on the
   misses. Everywhere else, a missing file IS the finding: keep using `read`. */
const readIfAny = (p) => {
  try {
    return readFileSync(join(ROOT, p), "utf8");
  } catch {
    return null;
  }
};

const TICKETS = read("docs/v2/TICKETS.md");
const SPEC = read("docs/v2/SPEC.md");
const DEC_README = read("docs/decisions/README.md");

let pass = 0;
let fail = 0;
// Every label that has been printed, in order. The negative suite finds a check
// by substring — `grep -F "<label>" | head -1` — so a label that CONTAINS
// another one, and prints first, silently answers for it. See the collision
// assertion at the bottom of this file; it was written because two probes went
// MISSED the day three `…, restated` labels were added.
const LABELS = [];
const chk = (name, got, want) => {
  LABELS.push(name);
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

// Prose writes small totals as words. A word is exactly as capable of going
// stale as a digit, so it has to be parsed, not exempted.
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven",
  "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50 };
const word2num = (s) => {
  const w = String(s).toLowerCase().trim();
  const i = WORDS.indexOf(w);
  if (i >= 0) return i;
  if (TENS[w] !== undefined) return TENS[w];
  const m = w.match(/^(twenty|thirty|forty|fifty)-(\w+)$/);
  if (m && WORDS.indexOf(m[2]) > 0) return TENS[m[1]] + WORDS.indexOf(m[2]);
  return NaN;
};

// A cell may say "**O1, O2**" or "V2-A1, V2-C1" or "**no ticket** — see below".
const idsIn = (cell) => cell.match(/\bV2-(?:00|[A-C]\d+)\b|\bO\d+\b/g) ?? [];
// An `R` item is NOT an `O` item. decisions/README.md says so in bold — "these
// are not `O` items and must not be merged into that register" — so they get
// their own matcher, and the structural checks below assert the two never mix.
const rIdsIn = (cell) => cell.match(/\bR\d+\b/g) ?? [];

// ---------------------------------------------------------------------------
// Parse the two tables
//
// The board's 6th column is `ratification`, and this regex REQUIRES it. That is
// deliberate: a row written with five cells does not parse, board.size drops,
// and the header's ticket count goes red. The alternative — an optional group —
// would read a forgotten cell as "no ratification needed", which is the exact
// shape of the defect this column exists to remove. A missing cell must be
// loud, because `—` and "nobody filled this in" are indistinguishable and the
// board has now been bitten by that twice (D-01 §5 → O25–O30, and this).
// ---------------------------------------------------------------------------
const board = new Map(); // V2-xx -> {deps, blocked, ratif}
for (const line of TICKETS.split("\n")) {
  const m = line.match(
    /^\|\s*\*\*(V2-[^*]+)\*\*\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/,
  );
  if (m) {
    board.set(m[1].trim(), {
      deps: idsIn(m[4]),
      blocked: idsIn(m[5]),
      ratif: rIdsIn(m[6]),
      // kept verbatim so the cross-contamination checks can read the raw cells
      rawDeps: m[4],
      rawBlocked: m[5],
      rawRatif: m[6],
    });
  }
}

const register = new Map(); // O-n -> tickets the register says it blocks
for (const line of SPEC.split("\n")) {
  const m = line.match(/^\|\s*\*\*(O\d+)\*\*\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/);
  if (m) register.set(m[1], idsIn(m[4]));
}

// The R register lives in decisions/README.md, not SPEC.md, because it is a
// property of a decision record and not of a ticket.
//   | id | record | the PRD today | conflict? | what ratifying it requires |
const rRegister = new Map(); // R-n -> {record, conflict}
for (const line of DEC_README.split("\n")) {
  const m = line.match(
    /^\|\s*\*\*(R\d+)\*\*\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/,
  );
  if (m) {
    rRegister.set(m[1], {
      record: (m[2].match(/\bD-\d+\b/) ?? [null])[0],
      // "**YES — direct**", "**depends on an open item**", "no"
      conflicts: !/^\s*no\s*$/i.test(m[4].replace(/\*/g, "")),
      // A conflict that holds today, vs one that holds only if an open item is
      // answered a particular way. Both gate a ticket; only the first can be
      // described as contradicting the PRD right now, and conflating them is
      // what let the index say "three" while its own table listed four.
      direct: /^\s*yes\b/i.test(m[4].replace(/\*/g, "")),
    });
  }
}

if (board.size === 0 || register.size === 0 || rRegister.size === 0) {
  console.log(
    `FAIL  parsed ${board.size} tickets, ${register.size} register rows and ` +
      `${rRegister.size} ratification rows — a table shape changed and every ` +
      `assertion below would pass vacuously`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// The closure. `answered` lets a caller ask "what opens up if these are decided?"
// ---------------------------------------------------------------------------
const closure = (answered, ratified) => {
  const memo = new Map();
  const walk = (id, seen) => {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return false; // a cycle is never startable
    seen.add(id);
    const n = board.get(id);
    if (!n) return false;
    const ok = n.blocked.every((o) => answered.has(o)) &&
      n.ratif.every((r) => ratified.has(r)) &&
      n.deps.every((d) => walk(d, new Set(seen)));
    memo.set(id, ok);
    return ok;
  };
  return [...board.keys()].filter((id) => id !== "V2-00" && walk(id, new Set()));
};

// UNBLOCKED asks only the question graph: is any O-item on this chain still
// open? It is the property TICKETS.md's glossary defines, and it deliberately
// ignores ratification — so `ALL_RATIFIED` is passed, not the real state.
const ALL_RATIFIED = new Set([...rRegister.keys()]);
const startableWith = (answered = new Set()) => closure(answered, ALL_RATIFIED);

// CLEARED adds the second gate, and it is the one `ready` actually needs.
// decisions/README.md's precedence table is unambiguous about the case where a
// record supersedes a ratified requirement: "The owner ratifies, or nothing is
// safe." A ticket whose deliverable is the thing PRD.md forbids is therefore
// not ready, however many owner questions have been answered — and until the
// `ratification` column existed there was no id it could cite to say so, which
// is the D-01 failure one register over.
//
// `ratified` is the set the owner has actually moved into PRD.md. Today that is
// EMPTY, and every figure below that passes a non-empty set is answering a
// hypothetical — which is exactly why the sentences those figures back now name
// the ratification out loud instead of assuming it.
const clearedWith = (answered = new Set(), ratified = new Set()) =>
  closure(answered, ratified);

// UNBLOCKED IS NOT STARTABLE, and conflating them is what made this board
// report 2.3x the parallelism it had.
//
// TICKETS.md defines `ready` itself: "every id in *depends on* is merged, AND
// no id in *blocked on* is still open." The closure above only answers the
// second half. V2-B2 and V2-B3 have no open question anywhere in their chain —
// and both depend on V2-B1, which is not merged, so neither can be claimed the
// day V2-00 lands. Listing them as "startable today" reads as a headcount of
// people who can work in parallel, which is the only reason anyone reads that
// section.
//
// Waves answer the schedule question the closure cannot: wave 1 is what starts
// when V2-00 merges, wave N is what starts when wave N-1 has.
//
// Waves are computed from CLEARED, not from unblocked. A wave answers "who can
// claim work the day V2-00 merges", and a ticket the PRD forbids cannot be
// claimed however many questions have been answered. The two sets are the same
// today; they stop being the same the day O1 and O2 are answered, and the
// figure below that states the gap is what makes that visible in advance.
const waves = () => {
  const unblocked = new Set(clearedWith());
  const out = [];
  const merged = new Set(["V2-00"]); // the unblock step is wave 0 by definition
  let remaining = new Set(unblocked);
  while (remaining.size) {
    const w = [...remaining].filter((id) =>
      board.get(id).deps.every((d) => merged.has(d))
    ).sort();
    if (w.length === 0) break; // everything left waits on something blocked
    out.push(w);
    for (const id of w) {
      merged.add(id);
      remaining.delete(id);
    }
  }
  return out;
};

// A ticket is "reached" by an item if the item blocks it, or blocks anything
// it transitively waits on. Reach is not startability — SPEC.md §4.3 and
// TICKETS.md both say so, in the paragraph this function backs.
const reachOf = (os) => {
  const hit = new Set();
  const walk = (id, seen) => {
    if (seen.has(id)) return false;
    seen.add(id);
    const n = board.get(id);
    if (!n) return false;
    return n.blocked.some((o) => os.includes(o)) ||
      n.deps.some((d) => walk(d, new Set(seen)));
  };
  for (const id of board.keys()) if (id !== "V2-00" && walk(id, new Set())) hit.add(id);
  return hit;
};

// The same walk over the ratification column. An R sits upstream of a ticket if
// the ticket carries it, or carries a dependency that does.
const reachOfR = (rs) => {
  const hit = new Set();
  const walk = (id, seen) => {
    if (seen.has(id)) return false;
    seen.add(id);
    const n = board.get(id);
    if (!n) return false;
    return n.ratif.some((r) => rs.includes(r)) ||
      n.deps.some((d) => walk(d, new Set(seen)));
  };
  for (const id of board.keys()) if (id !== "V2-00" && walk(id, new Set())) hit.add(id);
  return hit;
};

const tickets = board.size - 1; // V2-00 is the unblock step, not a ticket
const depEdges = [...board.values()].reduce((n, v) => n + v.deps.length, 0);
const blkEdges = [...board.values()].reduce((n, v) => n + v.blocked.length, 0);
const blocking = new Set([...board.values()].flatMap((v) => v.blocked));
const startable = startableWith();

console.log("==> V2 board — the graph is written twice; both copies must agree");
console.log();
console.log("--- the two copies of the graph");

// ---------------------------------------------------------------------------
// 1. SPEC's `blocks` column and TICKETS' `blocked on` column are one graph
// ---------------------------------------------------------------------------
const fromBoard = new Set();
for (const [t, { blocked }] of board) for (const o of blocked) fromBoard.add(`${o} -> ${t}`);
const fromRegister = new Set();
for (const [o, ts] of register) for (const t of ts) fromRegister.add(`${o} -> ${t}`);

chk(
  "edges in TICKETS.md 'blocked on' that SPEC.md §4.3 'blocks' omits",
  [...fromBoard].filter((e) => !fromRegister.has(e)).sort(),
  [],
);
chk(
  "edges in SPEC.md §4.3 'blocks' that TICKETS.md 'blocked on' omits",
  [...fromRegister].filter((e) => !fromBoard.has(e)).sort(),
  [],
);

console.log();
console.log("--- the register is whole");

// ---------------------------------------------------------------------------
// 2. Ids are contiguous, cited ids exist, and nothing dangles.
//    A gap in the numbering is how six real blockers stayed invisible.
// ---------------------------------------------------------------------------
const nums = [...register.keys()].map((o) => Number(o.slice(1))).sort((a, b) => a - b);
chk(
  "O-ids run 1..N with no gap and no duplicate",
  nums,
  Array.from({ length: register.size }, (_, i) => i + 1),
);

const citedAnywhere = new Set();
for (const src of [TICKETS, SPEC, DEC_README]) {
  for (const m of src.matchAll(/\bO(\d+)\b/g)) citedAnywhere.add(`O${m[1]}`);
}
chk(
  "every O-id cited in the V2 docs or the decisions index exists in the register",
  [...citedAnywhere].filter((o) => !register.has(o)).sort(),
  [],
);
chk(
  "every ticket named in a 'depends on' cell is a real ticket",
  [...new Set([...board.values()].flatMap((v) => v.deps))]
    .filter((d) => !board.has(d)).sort(),
  [],
);
chk(
  "every ticket named in the register's 'blocks' column is a real ticket",
  [...new Set([...register.values()].flat())].filter((t) => !board.has(t)).sort(),
  [],
);

// ---------------------------------------------------------------------------
// 2b. The register's `source` column and the decisions index are a THIRD copy
//     of the same mapping, and until 2026-08-15 nothing compared them.
//
// A negative probe deleting `O31–O33` from the D-03 index row left this check
// green: the ids still existed, still blocked V2-A19, still passed every
// assertion above. Only the index — the page a reader opens FIRST to ask "what
// is still open under sessions?" — had gone quiet about them. That is the D-01
// failure exactly: a record whose open questions are real and whose index cell
// does not mention them. `README.md` rule 5 says open items are tracked with
// ids; this asserts the tracking actually reaches the tracker.
// ---------------------------------------------------------------------------
const expandOs = (cell) => {
  const out = new Set();
  // Ranges are written with an en dash: "O4–O10". A plain list is "O1, O2, O3".
  for (const m of cell.matchAll(/\bO(\d+)\b(?:\s*\*{0,2}\s*[–-]\s*\*{0,2}O(\d+)\b)?/g)) {
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    for (let i = a; i <= b; i++) out.add(`O${i}`);
  }
  return [...out].sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)));
};

const indexRows = new Map(); // D-0n -> the O-ids its Open items cell claims
for (const line of DEC_README.split("\n")) {
  const m = line.match(/^\|\s*\[(D-\d+)\]\([^)]*\)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/);
  if (m) indexRows.set(m[1], expandOs(m[4]));
}
chk("decisions index: every D-record row was parsed", indexRows.size, 6);

const bySource = new Map(); // D-0n -> the O-ids the register sources to it
for (const line of SPEC.split("\n")) {
  const m = line.match(/^\|\s*\*\*(O\d+)\*\*\s*\|([^|]*)\|([^|]*)\|/);
  if (!m) continue;
  for (const rec of m[3].match(/\bD-\d+\b/g) ?? []) {
    if (!bySource.has(rec)) bySource.set(rec, []);
    bySource.get(rec).push(m[1]);
  }
}
for (const rec of [...indexRows.keys()].sort()) {
  chk(
    `decisions index: ${rec}'s open items match the register's source column`,
    indexRows.get(rec),
    (bySource.get(rec) ?? []).sort((x, y) => Number(x.slice(1)) - Number(y.slice(1))),
  );
}

// ---------------------------------------------------------------------------
// 2c. The records themselves are a FOURTH copy — and the ONLY one a human
//     writes into first. An item is raised in a record's §5; the register and
//     the index are where it is then copied to. So this is the copy most likely
//     to be right and the copy least likely to be read, and until 2026-08-15
//     nothing compared it to anything.
//
//     Two shapes exist and both parse: D-04 writes §5 as a table, the other
//     five write it as a numbered list. The assertion is exact equality in both
//     directions, per record — an item in the record and not the register is
//     the D-01 failure (a real blocker the board cannot see); an item in the
//     register and not the record is a question with no text behind it.
//
//     The reciprocal covers `docs/ai/local-model.md`, which owns no items and
//     is where a stale id hides: it describes all five AI features in detail,
//     and it described point 5's range as a settled property of the feature
//     until `O34` was raised.
// ---------------------------------------------------------------------------
const RECORDS = new Map(); // D-0n -> its file text
for (const f of readdirSync(join(ROOT, "docs/decisions")).sort()) {
  const m = f.match(/^(D-\d+)-.+\.md$/);
  if (m) RECORDS.set(m[1], read(`docs/decisions/${f}`));
}
chk(
  "every D-record the index names has a file on disk",
  [...indexRows.keys()].filter((r) => !RECORDS.has(r)).sort(),
  [],
);

const byNum = (a, b) => Number(a.slice(1)) - Number(b.slice(1));
const declaredIn = (text) => {
  const out = new Set();
  // the five numbered-list records: "3. **`O27` — is there an upper bound…"
  for (const m of text.matchAll(/^\d+\.\s+\*\*`?(O\d+)`?\s*[—-]/gm)) out.add(m[1]);
  // D-04's table: "| **O34** | **Point 5's range…"
  for (const m of text.matchAll(/^\|\s*\*\*(O\d+)\*\*\s*\|/gm)) out.add(m[1]);
  return [...out].sort(byNum);
};

const declaredAll = new Set();
for (const rec of [...RECORDS.keys()].sort()) {
  const declared = declaredIn(RECORDS.get(rec));
  for (const o of declared) declaredAll.add(o);
  chk(
    `${rec}: its §5 open items are exactly the ones the register sources to it`,
    declared,
    (bySource.get(rec) ?? []).sort(byNum),
  );
}
chk(
  "every open item raised in a record reached the register, and vice versa",
  [...declaredAll].sort(byNum),
  [...register.keys()].sort(byNum),
);

// The measurement report is not a decision record and raises nothing; it only
// cites. A citation of an id that does not exist is a renumber nobody finished.
const AI_REPORT = read("docs/ai/local-model.md");
const citedInProse = new Set();
for (const src of [...RECORDS.values(), AI_REPORT]) {
  for (const m of src.matchAll(/\bO(\d+)\b/g)) citedInProse.add(`O${m[1]}`);
}
chk(
  "every O-id cited in a decision record or the measurement report exists in the register",
  [...citedInProse].filter((o) => !register.has(o)).sort(byNum),
  [],
);

// ---------------------------------------------------------------------------
// 2d. THE RATIFICATION GATE — the third register, and the one that had no
//     column until 2026-08-15.
//
// decisions/README.md's `R` register records, per decision record, what the
// ratified PRD still says instead. Four of the six conflict with PRD.md today.
// The register had ids from the day it was written — and no ticket could cite
// them, because the board had five columns and none of them was for this.
//
// That is the D-01 failure reproduced exactly, one register over, and the
// board's own record of it (decisions/README.md, under the index) is the
// clearest statement of why it is not cosmetic:
//
//     "They had no ids, so no ticket could cite them, so three tickets carried
//      `blocked on: —` and the board counted them startable."
//
// Here the ids existed and the COLUMN did not, which produces the same render:
// V2-C1, V2-A1, V2-B4, V2-C2, V2-A2, V2-B7, V2-A19, V2-C3, V2-A3 and V2-B5 all
// implement something PRD.md currently forbids, and every one of them would
// have read as ready the moment its O-items were answered.
//
// The checks below hold three separate things, and they fail differently:
//   - the two registers stay separate       (README.md's bold instruction)
//   - the R register is whole and reciprocal (no id without a row, no row
//     without a record, no conflicting record without a ticket carrying it)
//   - the column is REACHABLE from the closure, so it changes an answer
// ---------------------------------------------------------------------------
console.log();
console.log("--- the ratification gate: R is not O, and both must stay that way");

// An id in the wrong column is the failure that "must not be merged into that
// register" is warning about, and it is silent: R4 sitting in `blocked on`
// would make the ticket look blocked by a question nobody can answer, because
// no such O-item exists. Three assertions, one per direction that can leak.
chk(
  "no 'blocked on' cell names an R-id — a ratification is not an open question",
  [...board].filter(([, v]) => rIdsIn(v.rawBlocked).length).map(([t]) => t).sort(),
  [],
);
chk(
  "no 'depends on' cell names an R-id — a ratification is not a ticket",
  [...board].filter(([, v]) => rIdsIn(v.rawDeps).length).map(([t]) => t).sort(),
  [],
);
chk(
  "no 'ratification' cell names an O-id or a ticket",
  [...board].filter(([, v]) => idsIn(v.rawRatif).length).map(([t]) => t).sort(),
  [],
);

const rNums = [...rRegister.keys()].map((r) => Number(r.slice(1))).sort((a, b) => a - b);
chk(
  "R-ids run 1..N with no gap and no duplicate",
  rNums,
  Array.from({ length: rRegister.size }, (_, i) => i + 1),
);

// One R per decision record, both directions. A seventh record cannot be added
// without saying what PRD.md says instead; an R cannot name a record that is
// not on disk. run.sh holds the prose half of this rule; this is the data half.
chk(
  "every R names a decision record that exists on disk",
  [...rRegister].filter(([, v]) => !v.record || !RECORDS.has(v.record))
    .map(([r]) => r).sort(byNum),
  [],
);
chk(
  "every decision record has exactly one R row",
  [...RECORDS.keys()].filter(
    (d) => [...rRegister.values()].filter((v) => v.record === d).length !== 1,
  ).sort(),
  [],
);

const rCitedAnywhere = new Set();
for (const src of [TICKETS, SPEC, DEC_README]) {
  for (const m of src.matchAll(/\bR(\d+)\b/g)) rCitedAnywhere.add(`R${m[1]}`);
}
chk(
  "every R-id cited in the V2 docs or the decisions index exists in the R register",
  [...rCitedAnywhere].filter((r) => !rRegister.has(r)).sort(byNum),
  [],
);

// THE ANTI-HOLE CHECK, and the reason this section is worth its length.
//
// It is reciprocal on purpose. A conflicting record with no ticket carrying it
// is a decision being built with PRD.md saying the opposite and nothing on the
// board admitting it — the original defect. A non-conflicting record carried by
// a ticket is the opposite error: R5 and R6 are gap-filling, README.md rule 4
// makes them safe to build, and blocking a ticket on them would invent a gate
// the owner never asked for.
const carriedBy = new Map([...rRegister.keys()].map((r) => [r, []]));
for (const [t, v] of board) for (const r of v.ratif) carriedBy.get(r)?.push(t);
chk(
  "every R that conflicts with PRD.md is carried by at least one ticket",
  [...rRegister].filter(([r, v]) => v.conflicts && carriedBy.get(r).length === 0)
    .map(([r]) => r).sort(byNum),
  [],
);
chk(
  "no ticket is gated on an R that does not conflict with PRD.md",
  [...rRegister].filter(([r, v]) => !v.conflicts && carriedBy.get(r).length > 0)
    .map(([r]) => r).sort(byNum),
  [],
);

console.log();
console.log("--- the totals both documents state about themselves");

// ---------------------------------------------------------------------------
// 3. Every number written in prose, checked against the graph it describes
// ---------------------------------------------------------------------------
const grab = (src, re, label) => {
  const m = src.match(re);
  if (!m) {
    fail++;
    console.log(`FAIL  ${label}\n        the sentence this reads is gone — reword the check, not the board`);
    return null;
  }
  return m;
};

const hdr = grab(
  TICKETS,
  /\*\*(\d+) tickets, plus `V2-00`\.\*\*\s*(\d+) dependency edges between tickets;\s*(\d+) blocking edges onto\s*\*\*(\d+)\*\* of the (\d+) open owner questions/,
  "TICKETS.md board header states its own totals",
);
if (hdr) {
  chk("TICKETS.md header: ticket count", Number(hdr[1]), tickets);
  chk("TICKETS.md header: dependency edges", Number(hdr[2]), depEdges);
  chk("TICKETS.md header: blocking edges", Number(hdr[3]), blkEdges);
  chk("TICKETS.md header: items that block a ticket", Number(hdr[4]), blocking.size);
  chk("TICKETS.md header: register size", Number(hdr[5]), register.size);
}

// The decisions index states the register size too, in words, in a third
// document — and a probe reverting it to "Thirty" left every other assertion
// green. Three copies of a number is three chances for one of them to rot.
const decTotal = grab(
  DEC_README,
  /All ([a-z-]+) records are `DECIDED`\. ([A-Za-z-]+) open items remain/,
  "the decisions index states the record count and the register size",
);
if (decTotal) {
  chk("decisions index: record count", word2num(decTotal[1]), indexRows.size);
  chk("decisions index: register size", word2num(decTotal[2]), register.size);
}

const ticketsReg = grab(
  TICKETS,
  /\n([A-Za-z-]+) open items, listed in full with their sources in/,
  "TICKETS.md's register section states the register size",
);
if (ticketsReg) {
  chk("TICKETS.md reach section: register size", word2num(ticketsReg[1]), register.size);
}

// ---------------------------------------------------------------------------
// The numbers stated OUTSIDE the two tables, in headers and glossaries.
//
// Four of these were stale when this block was written, and all four had been
// stale for at least one commit: SPEC.md's header card and README.md's
// closing paragraph both still said "39 tickets" after V2-A20 landed, and both
// glossaries still said the ids run "`O1` … `O30`" after O31–O33 did. Nothing
// read a header card or a glossary line, so nothing went red.
//
// A number in a header is the FIRST number a reader sees and the last one
// anybody thinks to update. Assert them where they are written.
// ---------------------------------------------------------------------------
for (const [label, src] of [["SPEC.md", SPEC], ["decisions/README.md", DEC_README]]) {
  const m = grab(
    src,
    /\*\*(\d+) tickets plus the unblock step\*\*/,
    `${label} states the ticket count outside the board`,
  );
  if (m) chk(`${label}: ticket count`, Number(m[1]), tickets);

  const r = grab(
    src,
    /`O1` … `O(\d+)`/,
    `${label} states the O-id range in its glossary`,
  );
  if (r) chk(`${label}: highest O-id`, Number(r[1]), register.size);
}

const issues = grab(
  TICKETS,
  /The repository is public and ([a-z-]+) issues are hard/,
  "TICKETS.md states how many issues opening the board would create",
);
if (issues) chk("TICKETS.md: issues the board would open", word2num(issues[1]), tickets);

const spec43 = grab(
  SPEC,
  /### 4\.3 The open register — ([a-z-]+) real blockers/,
  "SPEC.md §4.3 heading states the register size",
);
if (spec43) chk("SPEC.md §4.3 heading: register size", word2num(spec43[1]), register.size);

const specBlk = grab(
  SPEC,
  /\*\*(\d+) of the (\d+) items block a ticket\./,
  "SPEC.md §4.3 states how many items block a ticket",
);
if (specBlk) {
  chk("SPEC.md §4.3: items that block a ticket", Number(specBlk[1]), blocking.size);
  chk("SPEC.md §4.3: register size", Number(specBlk[2]), register.size);
}

// The unblocked set is the number most worth being wrong about: it is the one
// a reader acts on. It is stated twice — as a word and as a list — and both
// are checked, because a correct count next to a stale list is still a lie.
const start = grab(
  TICKETS,
  /\*\*([A-Za-z-]+) tickets are unblocked: ([^*]+)\.\*\*/,
  "TICKETS.md states what is unblocked",
);
if (start) {
  chk("TICKETS.md: unblocked count", word2num(start[1]), startable.length);
  chk(
    "TICKETS.md: the unblocked list matches the closure",
    idsIn(start[2]).sort(),
    [...startable].sort(),
  );
}

// And the wave table, which is the half the old wording dropped.
console.log();
console.log("--- unblocked vs startable: the waves");
const computedWaves = waves();
const statedWaves = [...TICKETS.matchAll(/^\| \*\*(\d+)\*\* \| ((?:V2-[A-C]?\d+(?:, )?)+) \| /gm)];
chk("TICKETS.md: the wave table has a row per wave", statedWaves.length, computedWaves.length);
for (const [i, w] of computedWaves.entries()) {
  const row = statedWaves.find((m) => Number(m[1]) === i + 1);
  chk(`TICKETS.md: wave ${i + 1} membership`, row ? idsIn(row[2]).sort() : null, w);
}

const canStart = grab(
  TICKETS,
  /\*\*([A-Za-z-]+) of them can be started: ([^*]+)\.\*\*/,
  "TICKETS.md states how many tickets can actually be started",
);
if (canStart) {
  chk("TICKETS.md: wave-1 count — how many people can work at once", word2num(canStart[1]), computedWaves[0]?.length);
  chk("TICKETS.md: wave-1 list", idsIn(canStart[2]).sort(), computedWaves[0]);
}

// ---------------------------------------------------------------------------
// The figures the ratification section states about itself.
//
// Every one of these is a number in prose describing a graph, which is the
// category of thing this whole file exists for. The two that matter most are
// the last two: "zero today" and "five the day O1 and O2 are answered". The
// second is the one a reader acts on, and it is the number that did not exist
// before the column did — those five tickets read as startable, and the board
// had no way to say otherwise.
// ---------------------------------------------------------------------------
console.log();
console.log("--- the ratification section's own figures");

const cleared = clearedWith();
const conflictingR = [...rRegister].filter(([, v]) => v.conflicts).map(([r]) => r).sort(byNum);

const rCount = grab(
  TICKETS,
  /\*\*([A-Za-z-]+) of the ([a-z-]+) conflict with the ratified document\s+today\*\*/,
  "TICKETS.md states how many records conflict with the PRD",
);
if (rCount) {
  chk("TICKETS.md: records conflicting with the PRD", word2num(rCount[1]), conflictingR.length);
  chk("TICKETS.md: R register size", word2num(rCount[2]), rRegister.size);
}

// The decisions index restates the same split in prose, one document over, and
// it got it wrong: "three of them contradict it" next to a table with four
// non-`no` rows. Neither number was false — "three" was true of the DIRECT
// conflicts — but the sentence was read as the count of records holding work,
// and TICKETS.md gates ten tickets on four. Both lists are now re-derived from
// the `conflict?` column rather than counted by hand.
const idxSplit = grab(
  DEC_README,
  /\*\*None of the six is `IN PRD`\. ([A-Za-z-]+) contradict it directly\*\* — ((?:`R\d+`(?:, )?)+) — \*\*and\s+([a-z-]+)\s+contradicts it conditionally\*\*: `(R\d+)`/,
  "decisions index states the direct/conditional split",
);
if (idxSplit) {
  const directR = [...rRegister].filter(([, v]) => v.direct).map(([r]) => r).sort(byNum);
  const conditionalR = conflictingR.filter((r) => !directR.includes(r));
  chk("decisions index: how many records contradict the PRD directly", word2num(idxSplit[1]), directR.length);
  chk("decisions index: which records contradict the PRD directly", rIdsIn(idxSplit[2]).sort(byNum), directR);
  chk("decisions index: how many contradict it conditionally", word2num(idxSplit[3]), conditionalR.length);
  chk("decisions index: which record contradicts it conditionally", [idxSplit[4]], conditionalR);
  // The claim that motivated the edit: every record that gates a ticket on the
  // V2 board is one this sentence accounts for. Not implied by the two counts —
  // they could both be right about a register the board disagrees with.
  const gating = new Set();
  for (const [, v] of board) for (const r of v.ratif) gating.add(r);
  chk(
    "decisions index: the split accounts for every record gating a V2 ticket",
    [...gating].sort(byNum).filter((r) => !directR.includes(r) && !conditionalR.includes(r)),
    [],
  );
}

// ---------------------------------------------------------------------------
// The two cross-document pointers into the board's `ratification` column.
//
// A reader landing in `docs/decisions/README.md` or in `SPEC.md` §4.0 learns
// that six decisions are unratified and cannot find, from there, which work
// that holds. The pointers close that. They are checked for the same reason
// every other sentence here is: a hand-written cross-reference is the single
// most common stale thing in this repository, and a pointer that has rotted
// is worse than no pointer — it reads as an answer.
//
// The decisions index states the gating split IN WORDS, so the words are
// re-derived. It deliberately restates no reach figure; that is asserted too,
// below, because "do not duplicate this number" is only a rule if something
// notices when someone does.
{
  const gating = new Set();
  for (const [, v] of board) for (const r of v.ratif) gating.add(r);
  const gatingIds = [...gating].sort(byNum);
  const idleIds = [...rRegister.keys()].filter((r) => !gating.has(r)).sort(byNum);

  const ptr = grab(
    DEC_README,
    /\*\*([A-Za-z-]+) of the six gate at least one ticket: ((?:`R\d+`(?:, )?)+)\.\*\*\s+((?:`R\d+`(?: and )?)+) gate\s+nothing/,
    "decisions index points at the board's ratification column",
  );
  if (ptr) {
    chk("decisions index: how many records gate a ticket", word2num(ptr[1]), gatingIds.length);
    chk("decisions index: which records gate a ticket", rIdsIn(ptr[2]).sort(byNum), gatingIds);
    chk("decisions index: which records gate nothing", rIdsIn(ptr[3]).sort(byNum), idleIds);
  }

  // The pointer has to resolve. A relative link is not checked by any renderer
  // on the way to `main`, so a moved file leaves a sentence that still reads
  // correctly and goes nowhere.
  chk(
    "decisions index: the pointer links to the board",
    /\[`docs\/v2\/TICKETS\.md`\]\(\.\.\/v2\/TICKETS\.md\)/.test(DEC_README),
    true,
  );

  // SPEC.md §4.0 gets the same pointer and no figures at all. Slicing the
  // section rather than searching the whole file is the point: `SPEC.md`
  // mentions TICKETS.md in a dozen places, and a check that any of them exists
  // would pass with §4.0 saying nothing.
  //
  // Both bounds are asserted, in order, before the slice is trusted. A missing
  // heading makes `indexOf` return -1, and `slice` treats -1 as "one from the
  // end" rather than raising — so an unchecked slice of a renamed section
  // silently becomes either the empty string or most of the file, and the
  // check downstream of it passes for a reason that has nothing to do with
  // §4.0.
  const i40 = SPEC.indexOf("### 4.0 ");
  const i41 = SPEC.indexOf("### 4.1 ");
  chk("SPEC.md: §4.0 and §4.1 headings both found, in order", i40 >= 0 && i41 > i40, true);
  const s40 = i40 >= 0 && i41 > i40 ? SPEC.slice(i40, i41) : "";
  chk(
    "SPEC.md: §4.0 names the board's ratification column and links to it",
    /\*\*`ratification`\*\* column in\s+\[`TICKETS\.md`\]\(TICKETS\.md\)/.test(s40),
    true,
  );

  // Neither pointer may restate a reach figure. The reach table lives on the
  // board in one place; a copy is a second place for it to be wrong, and this
  // is the assertion that makes "do not restate" enforceable rather than
  // aspirational. `N of 40` is the shape those figures take.
  chk(
    "the decisions index and SPEC §4.0 restate no reach figure",
    [
      ...(DEC_README.match(/\b\d+ of (?:the )?40\b/g) ?? []),
      ...(s40.match(/\b\d+ of (?:the )?40\b/g) ?? []),
    ],
    [],
  );
}

// The grouped list, checked per group. A correct total next to a ticket filed
// under the wrong R is still a lie, and it is the more likely error of the two:
// the count is written once and the grouping is written ten times.
const direct = grab(
  TICKETS,
  /\*\*([A-Za-z-]+) tickets carry one directly:\*\*([^.]*)\./,
  "TICKETS.md lists the tickets that carry a ratification directly",
);
if (direct) {
  chk(
    "TICKETS.md: tickets carrying an R directly",
    word2num(direct[1]),
    [...board.values()].filter((v) => v.ratif.length).length,
  );
  chk(
    "TICKETS.md: the directly-carrying list matches the board",
    idsIn(direct[2]).sort(),
    [...board].filter(([, v]) => v.ratif.length).map(([t]) => t).sort(),
  );
  for (const group of direct[2].split(";")) {
    const r = rIdsIn(group);
    if (r.length !== 1) {
      fail++;
      console.log(`FAIL  a group in the directly-carrying list names ${r.length} R-ids, not 1`);
      continue;
    }
    chk(`TICKETS.md: the tickets listed under ${r[0]}`, idsIn(group).sort(), carriedBy.get(r[0]).sort());
  }
}

// The two sentences that were true under an unstated precondition. Both halves
// are asserted: the figure still holds, AND it holds only once the named R is
// ratified — the second half is checked by passing exactly that set.
const assume1 = grab(
  TICKETS,
  /\| answering `O1`\+`O2` moves the unblocked set \*\*(\d+) → (\d+)\*\* \|[^|]*\| that `(R\d+)` is ratified \|/,
  "TICKETS.md names what the O1/O2 figure assumes",
);
if (assume1) {
  chk("TICKETS.md: the assumption row's opening figure", Number(assume1[1]), startable.length);
  chk(
    "TICKETS.md: the assumption row's released figure",
    Number(assume1[2]),
    startableWith(new Set(["O1", "O2"])).length,
  );
  chk(
    `TICKETS.md: that figure needs ${assume1[3]} ratified to be a ready-count`,
    clearedWith(new Set(["O1", "O2"]), new Set([assume1[3]])).length,
    Number(assume1[2]),
  );
}

const assume2 = grab(
  TICKETS,
  /\| adding `O20` moves it \*\*(\d+) → (\d+)\*\* \|[^|]*\| that `(R\d+)` \*\*and\*\* `(R\d+)` are ratified \|/,
  "TICKETS.md names what the O20 figure assumes",
);
if (assume2) {
  chk(
    "TICKETS.md: the O20 assumption row's released figure",
    Number(assume2[2]),
    startableWith(new Set(["O1", "O2", "O20"])).length,
  );
  chk(
    `TICKETS.md: that figure needs ${assume2[3]}+${assume2[4]} ratified to be a ready-count`,
    clearedWith(new Set(["O1", "O2", "O20"]), new Set([assume2[3], assume2[4]])).length,
    Number(assume2[2]),
  );
}

const heldToday = grab(
  TICKETS,
  /\*\*Today ([a-z-]+) unblocked tickets are held by ratification alone\.\*\*/,
  "TICKETS.md states how many unblocked tickets ratification holds today",
);
if (heldToday) {
  chk(
    "TICKETS.md: unblocked but not cleared, today",
    word2num(heldToday[1]),
    startable.filter((t) => !cleared.includes(t)).length,
  );
}

const heldAfter = grab(
  TICKETS,
  /becomes \*\*([a-z-]+)\*\* — ([^—]+) —/,
  "TICKETS.md states how many O1/O2 releases that ratification then holds",
);
if (heldAfter) {
  const u = startableWith(new Set(["O1", "O2"]));
  const c = clearedWith(new Set(["O1", "O2"]));
  chk("TICKETS.md: unblocked but not cleared after O1/O2", word2num(heldAfter[1]), u.filter((t) => !c.includes(t)).length);
  chk(
    "TICKETS.md: which tickets ratification holds after O1/O2",
    idsIn(heldAfter[2]).sort(),
    u.filter((t) => !c.includes(t)).sort(),
  );
}

const rAssertedHere = new Set();
const rReachRows = TICKETS.split("\n").filter((l) => /^\| \*\*R\d+\*\*/.test(l));
let rRows = 0;
for (const line of rReachRows) {
  const m = line.match(/^\| \*\*(R\d+)\*\* \| [^|]* \| [^|]* \| \*\*(\d+) of (\d+)\*\* \|/);
  if (!m) continue;
  rRows++;
  rAssertedHere.add(m[1]);
  chk(`reach of \`${m[1]}\``, Number(m[2]), reachOfR([m[1]]).size);
  chk(`reach denominator on the ${m[1]} row`, Number(m[3]), tickets);
}
chk("every row of the R reach table was parsed", rRows, rReachRows.length);
chk(
  "the R reach table names exactly the records that conflict with the PRD",
  [...rAssertedHere].sort(byNum),
  conflictingR,
);

const downstream = grab(
  TICKETS,
  /\*\*(\d+) of the (\d+) tickets sit downstream of at least one unratified\s+decision\.\*\* The ([a-z-]+) that do\s+not are ([^—]+) —/,
  "TICKETS.md states how much of the board sits downstream of an unratified decision",
);
if (downstream) {
  const reached = reachOfR(conflictingR);
  const untouched = [...board.keys()].filter((t) => t !== "V2-00" && !reached.has(t)).sort();
  chk("TICKETS.md: tickets downstream of an unratified decision", Number(downstream[1]), reached.size);
  chk("TICKETS.md: that figure's denominator", Number(downstream[2]), tickets);
  chk("TICKETS.md: how many are untouched by ratification", word2num(downstream[3]), untouched.length);
  chk("TICKETS.md: which tickets are untouched by ratification", idsIn(downstream[4]).sort(), untouched);
}

// The wider readings of R3 are stated as measurements, so they are measured — on
// a throwaway copy of the board, because the narrow reading is what is committed.
// A hypothetical in prose is still a number, and an unchecked one rots exactly
// like the rest. This is the assertion that stops the owner being handed a
// made-up figure to decide against.
//
// Every stated reading is read, not just the first: the board argues its way to
// one number, then supersedes it with another, and a superseded number left on
// the page is exactly the kind that stops being re-derived.
//
// The labels below carry an ORDINAL and not the arrow, deliberately. A label
// built from the figures it is checking cannot be probed: the realistic mutation
// is to change a figure, which renames the assertion, and `neg_probe` then finds
// no line to match and reports a no-op instead of the catch it actually made.
{
  const readings = [
    ...TICKETS.matchAll(/\*\*`R3`'s reach goes (\d+) → (\d+)\*\* \(([^)]+)\)/g),
  ];
  chk(
    "TICKETS.md states what R3's reach becomes on a wider reading",
    readings.length > 0,
    true,
  );

  // How many readings the prose claims to have measured. Without this, deleting
  // a superseded reading is invisible — the loop simply runs one fewer time and
  // every remaining assertion still passes.
  const stated = grab(
    TICKETS,
    /\*\*(\w+) wider readings are measured above\*\*/,
    "TICKETS.md says how many wider readings it measured",
  );
  if (stated) {
    chk("TICKETS.md: how many wider R3 readings are stated", word2num(stated[1]), readings.length);
  }

  // Measured once, from the committed board, and never from the prose — this is
  // what the restore is checked against below.
  const realReach = reachOfR(["R3"]).size;

  readings.forEach((r, i) => {
    const tag = `TICKETS.md: wider reading #${i + 1}`;
    chk(`${tag} — the figure it starts from is R3's real reach`, Number(r[1]), realReach);

    const named = idsIn(r[3]);
    const widened = named.filter((t) => board.has(t));
    chk(`${tag} — every carrier it names is on the board`, widened, named);

    const saved = new Map(widened.map((t) => [t, [...board.get(t).ratif]]));
    for (const t of widened) if (!board.get(t).ratif.includes("R3")) board.get(t).ratif.push("R3");
    const wide = reachOfR(["R3"]).size;
    for (const [t, arr] of saved) board.get(t).ratif = arr; // put the real board back
    chk(`${tag} — the figure it arrives at is what those carriers reach`, Number(r[2]), wide);

    // The restore is asserted, not assumed. A hypothetical that leaks would make
    // every figure after this point quietly wrong, and all of them would agree.
    chk(`${tag} — the hypothetical was discarded`, reachOfR(["R3"]).size, realReach);
  });
}

// The same pin rule as the O reach section: an R named in this section costs a
// row or a checked sentence. "O11 reaches none" is the precedent — prose that
// reads as verified because it sits beside numbers that are.
const rSection = TICKETS.match(
  /\n### The second gate — [^\n]*\n([\s\S]*?)(?=\n### |\n## |$)/,
);
if (!rSection) {
  fail++;
  console.log(
    "FAIL  the ratification section could not be located\n" +
      "        the '### The second gate' heading was renamed",
  );
} else {
  // R5 and R6 are named in this section and have no reach row, because they
  // conflict with nothing and gate no ticket. The first draft of this pin check
  // auto-exempted them on exactly that reasoning — which made the check
  // unfallible: every conflicting item is forced to have a row by the assertion
  // above, so the only id left that could ever trip it was one absent from the
  // register, and two other checks already catch that. An exemption computed
  // from the data is not a pin; it is the check agreeing with itself.
  //
  // So they are pinned the same way everything else is: by a sentence that
  // states a fact and is checked against the graph.
  const silent = grab(
    TICKETS,
    /\*\*`(R\d+)` and `(R\d+)` carry no ticket at all\*\*/,
    "TICKETS.md names the records that gate nothing",
  );
  if (silent) {
    rAssertedHere.add(silent[1]).add(silent[2]);
    chk(
      "TICKETS.md: the records that gate no ticket are the ones that conflict with nothing",
      [silent[1], silent[2]].sort(byNum),
      [...rRegister].filter(([r]) => carriedBy.get(r).length === 0).map(([r]) => r).sort(byNum),
    );
  }
  if (direct) for (const r of rIdsIn(direct[2])) rAssertedHere.add(r);
  if (assume1) rAssertedHere.add(assume1[3]);
  if (assume2) rAssertedHere.add(assume2[3]).add(assume2[4]);
  chk(
    "every R-id discussed in the ratification section is pinned by a row or a checked sentence",
    [...new Set(rSection[1].match(/\bR\d+\b/g) ?? [])]
      .filter((r) => !rAssertedHere.has(r)).sort(byNum),
    [],
  );
}

console.log();
console.log("--- what answering an item opens up");

const opens = grab(
  TICKETS,
  /moves the unblocked set from \*\*(\d+) to (\d+)\*\* — ([^—]+) —/,
  "TICKETS.md states what answering O1 and O2 opens up",
);
if (opens) {
  const after = startableWith(new Set(["O1", "O2"]));
  chk("TICKETS.md: unblocked before O1/O2", Number(opens[1]), startable.length);
  chk("TICKETS.md: unblocked once O1 and O2 are answered", Number(opens[2]), after.length);
  chk(
    "TICKETS.md: which tickets O1/O2 release",
    idsIn(opens[3]).sort(),
    after.filter((t) => !startable.includes(t)).sort(),
  );
}

const plus20 = grab(
  TICKETS,
  /Add `O20` and the set goes (\d+) → (\d+)/,
  "TICKETS.md states what O20 adds on top",
);
if (plus20) {
  chk("TICKETS.md: the O20 sentence's opening figure", Number(plus20[1]), startableWith(new Set(["O1", "O2"])).length);
  chk("TICKETS.md: unblocked after O1/O2/O20", Number(plus20[2]), startableWith(new Set(["O1", "O2", "O20"])).length);
}

const reachRow = grab(
  TICKETS,
  /Two sentences from the owner sit upstream of \*\*(\d+) of the (\d+)\n?tickets\*\*/,
  "TICKETS.md states O1+O2's reach",
);
if (reachRow) {
  chk("TICKETS.md: reach of O1+O2", Number(reachRow[1]), reachOf(["O1", "O2"]).size);
  chk("TICKETS.md: reach denominator", Number(reachRow[2]), tickets);
}

// Every reach figure in the closing table, not just the headline one.
//
// The row count is asserted against the rows that EXIST, not against zero.
// The first version of this block ended with `reachRows > 0` and went green
// while silently skipping the newest row — its cell reads "**19 of 39 each**"
// and the regex required `**` immediately after the denominator. Seven of
// eight rows checked, one unchecked, PASS printed. That is the vacuous pass
// #121 was filed for: a check whose coverage can shrink to almost nothing
// without its result changing. Count the rows, then require that many.
console.log();
console.log("--- the reach table");
const reachTable = TICKETS.split("\n").filter((l) => /^\| \*\*O\d+\*\*/.test(l));
const assertedHere = new Set(); // ids this section actually pins to the graph
let reachRows = 0;
for (const line of reachTable) {
  const m = line.match(
    /^\| \*\*(O\d+)\*\*(?:–\*\*(O\d+)\*\*)? \| [^|]+ \| \*\*(\d+) of (\d+)[^*|]*\*\*/,
  );
  if (!m) continue;
  reachRows++;
  const [, from, to, n, denom] = m;
  const span = to
    ? Array.from(
      { length: Number(to.slice(1)) - Number(from.slice(1)) + 1 },
      (_, i) => `O${Number(from.slice(1)) + i}`,
    )
    : [from];
  // A span row states one figure that must hold for each member individually.
  for (const o of span) {
    assertedHere.add(o);
    // The id is delimited because these labels are generated, and `O2` is a
    // prefix of `O20`..`O29`. Undelimited, the O2 row's probe would be answered
    // by the O20 row's verdict — see the collision assertion at the bottom.
    chk(`reach of \`${o}\``, Number(n), reachOf([o]).size);
  }
  chk(`reach denominator on the ${from}${to ? `–${to}` : ""} row`, Number(denom), tickets);
}
chk("every row of the reach table was parsed", reachRows, reachTable.length);

// Counting the rows stops a row being SKIPPED. It does not stop one being
// DELETED — remove a row and both sides of that assertion drop together, and
// every figure left behind is still correct. A probe deleting O34's row proved
// it: silent, green, and the item's reach no longer stated anywhere.
//
// So the table's selection rule is written down and checked instead of being
// implicit. It lists the high-reach items; what it omits is a CLAIM about the
// omitted ones, and that claim is what makes a missing row detectable.
const sel = grab(
  TICKETS,
  /\*\*This table names ([a-z-]+) of the ([a-z-]+), and the omissions are a claim[^*]*reaches ([a-z-]+) tickets or fewer\.\*\*/,
  "TICKETS.md states which part of the register the reach table covers",
);
if (sel) {
  chk("TICKETS.md: items the reach table names", word2num(sel[1]), assertedHere.size);
  chk("TICKETS.md: register size, in the reach table's own claim", word2num(sel[2]), register.size);
  const bound = word2num(sel[3]);
  chk(
    `TICKETS.md: omitted items all reach ${bound} or fewer`,
    [...register.keys()].filter((o) => !assertedHere.has(o) && reachOf([o]).size > bound).sort(),
    [],
  );
}

// The prose AROUND the table, which is where the last wrong number was hiding.
//
// Every figure inside the table was asserted. The sentence under it — "O11
// reaches none" — was not, because O11 had no row, and it was the false one:
// O11 reached nothing only because the ticket it blocks (V2-A20, qualify the
// production provider) existed in no plan. Same for "the other eighteen carry a
// second blocker", which was reach minus the whole post-answer unblocked set
// instead of reach minus what that answer RELEASED — four of those nine were
// never in the reach set. Both were prose next to checked numbers, which is the
// most convincing place for a wrong number to sit.
console.log();
console.log("--- the prose around the table");

const reachEvery = new Map([...register.keys()].map((o) => [o, reachOf([o]).size]));

const second = grab(
  TICKETS,
  /The other \*\*(\d+)\*\* carry a \*second\* blocker/,
  "TICKETS.md states how many reached tickets keep a second blocker",
);
if (second) {
  const released = new Set(
    startableWith(new Set(["O1", "O2"])).filter((t) => !startable.includes(t)),
  );
  assertedHere.add("O1").add("O2");
  chk(
    "TICKETS.md: reached by O1/O2 but not released by them",
    Number(second[1]),
    [...reachOf(["O1", "O2"])].filter((t) => !released.has(t)).length,
  );
}

// The number classes below are [a-z-], not [a-z]: these counts crossed twenty
// when O31-O33 landed, "twenty-one" carries a hyphen, and a class that excludes
// it turns a rewording into "the sentence this reads is gone" — the check going
// blind in exactly the way it exists to prevent. word2num already parses the
// hyphenated form; only the class was narrower than the vocabulary.
const few = grab(
  TICKETS,
  /\*\*([a-z-]+) items reach six tickets or fewer\*\*/,
  "TICKETS.md states how many items reach six or fewer",
);
if (few) {
  chk(
    "TICKETS.md: items reaching six tickets or fewer",
    word2num(few[1]),
    [...reachEvery.values()].filter((n) => n <= 6).length,
  );
}

const lonely = grab(
  TICKETS,
  /\*\*([a-z-]+) reach exactly one ticket\*\*/,
  "TICKETS.md states how many items reach exactly one ticket",
);
if (lonely) {
  chk(
    "TICKETS.md: items reaching exactly one ticket",
    word2num(lonely[1]),
    [...reachEvery.values()].filter((n) => n === 1).length,
  );
}

const named = grab(
  TICKETS,
  /The three that reach exactly six are ([^;]+);\s*`(O\d+)` reaches ([a-z-]+)\./,
  "TICKETS.md names the items reaching exactly six",
);
if (named) {
  chk(
    "TICKETS.md: the items reaching exactly six are the ones named",
    idsIn(named[1]).sort(),
    [...reachEvery].filter(([, n]) => n === 6).map(([o]) => o).sort(),
  );
  for (const o of idsIn(named[1])) assertedHere.add(o);
  assertedHere.add(named[2]);
  chk(`TICKETS.md: reach of ${named[2]}`, word2num(named[3]), reachEvery.get(named[2]));
}

// ---------------------------------------------------------------------------
// The rule CLAUDE.md §9 states, enforced instead of trusted: if a number is
// worth writing in prose, give it a row the check can reach.
//
// Every assertion above reads a row or a sentence it already knows about. None
// of them notices an id being DISCUSSED in this section with no row and no
// sentence-level check — which is precisely how "`O11` reaches none" survived,
// and how the first draft of the `O31` paragraph reintroduced it. So: collect
// every id this section names, subtract the ids something above actually
// pinned to the graph, and require the remainder to be empty.
//
// Adding an id to this section therefore costs a row or a checked sentence.
// That is the intended price. The alternative is prose that reads as verified
// because it sits next to numbers that are.
// ---------------------------------------------------------------------------
const sectionRe = /\n## The register this board is waiting on\n([\s\S]*?)(?=\n## |$)/;
const section = TICKETS.match(sectionRe);
if (!section) {
  fail++;
  console.log(
    "FAIL  the reach section could not be located\n" +
      "        the '## The register this board is waiting on' heading was renamed",
  );
} else {
  const namedInProse = new Set(section[1].match(/\bO\d+\b/g) ?? []);
  chk(
    "every O-id discussed in the reach section is pinned by a row or a checked sentence",
    [...namedInProse].filter((o) => !assertedHere.has(o))
      .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))),
    [],
  );
}

// ---------------------------------------------------------------------------
// EVERY `PRD.md:NNN` CITATION IS RESOLVED AGAINST THE FILE.
//
// This section exists because of a defect found on 2026-08-15, and it is worth
// stating what the defect actually was: not a wrong line number, but an
// argument built on the PRD being SILENT about something it excludes by name.
// §19.2 rows :1846 (scheduled future start times) and :1847 (multiple quantity
// / lots) were cited by nothing on this board, so nothing led a reader there,
// so the board concluded silence and classified the gap as safe to fill. It was
// not silence. It was two named exclusions.
//
// A line number is the most quietly rotting citation there is. Insert one
// paragraph above it and it still parses, still reads, and points a screen
// away from what it claimed. So each one is resolved: the line must exist, and
// where the citing prose quotes the row it points at, the PRD line must still
// contain that quote. The second half is the one that matters — a citation
// that resolves to the wrong live line is worse than one that resolves to
// nothing, because it looks checked.
{
  const PRD = read("PRD.md").split("\n");

  // The sources that argue from the PRD. Not a glob: a document that starts
  // citing line numbers should be added here deliberately, by someone who then
  // has to look at what it cites.
  const CITERS = [
    ["docs/v2/TICKETS.md", TICKETS],
    ["docs/v2/SPEC.md", SPEC],
    ["docs/decisions/README.md", DEC_README],
  ];

  // ── The bare `:NNN` continuation, and the bug it hid until 2026-08-16 ──────
  //
  // These documents write a run of citations into one file as `file.md:12`
  // followed by bare `` `:15` ``, `` `:16` ``. The first draft of this scanner
  // read EVERY bare `` `:NNN` `` in a citing document as a PRD.md line, whatever
  // file the surrounding prose was actually pointing at. It passed for weeks,
  // because a random line number in a 2000-line PRD is usually non-blank — so
  // the check was resolving citations against the WRONG FILE and reporting
  // success. It only became visible when a `` `:509` `` into a SQL migration
  // happened to land on a blank PRD line.
  //
  // That is the exact failure this section's own header warns about — "a
  // citation that resolves to the wrong live line is worse than one that
  // resolves to nothing, because it looks checked" — committed by the checker
  // rather than by the prose. So the fix is not a narrower regex around PRD.md.
  // It is to resolve every citation to the file its prose names, and then check
  // ALL of them, not just the PRD's. A `:NNN` into core_schema.sql rots exactly
  // as quietly as one into the PRD.
  //
  // HOW A BARE `:NNN` IS RESOLVED, AND WHY IT IS NOT "the last file named".
  //
  // That was the second draft, and it was wrong in a way worth keeping written
  // down. These documents argue in long blockquotes that name several files
  // before the bare run starts — TICKETS.md item 8 opens with a `PRD.md` table
  // header and then cites `:798`, `:1218`, `:1223` for sixty lines, mentioning
  // CLAUDE.md and SPEC.md in between. "Last named" attributed `:798` to
  // CLAUDE.md and reported a dangling citation that a human reading the same
  // paragraph could not misread. A checker that invents a defect is worse than
  // one that misses it: the next session spends its budget on the checker.
  //
  // So: an EXPLICIT `file.md:12` is resolved against that file, exactly. A BARE
  // `:12` is resolved against every file named in its block, and is reported
  // only if it fails against ALL of them. That is deliberately weaker per
  // citation and it is the strongest claim the syntax actually supports — a
  // bare continuation is ambiguous, and the honest response to ambiguity is a
  // narrower assertion, not a confident guess. It still catches the thing this
  // is for: a line number that ROTTED is out of range or blank everywhere.
  //
  // A block is a run of lines between truly empty ones. Markdown blockquotes
  // separate their paragraphs with `>` rather than a blank line, so one
  // blockquote is one block — which is exactly the scope a reader carries a
  // bare continuation across.
  const TOKEN = /`([A-Za-z0-9_./-]+\.(?:md|sql|ts|tsx|sh|mjs|yml|json))(?::(\d+))?`|`:(\d+)`/g;
  const cites = [];
  for (const [name, body] of CITERS) {
    for (const block of body.split(/\n[ \t]*\n/)) {
      const named = [...new Set([...block.matchAll(TOKEN)].map((m) => m[1]).filter(Boolean))];
      for (const m of block.matchAll(TOKEN)) {
        if (m[1] && m[2]) cites.push({ doc: name, files: [m[1]], line: Number(m[2]) });
        else if (!m[1] && named.length) cites.push({ doc: name, files: named, line: Number(m[3]) });
      }
    }
  }

  const prdCites = cites.filter((c) => c.files.some((f) => f.endsWith("PRD.md")));
  chk("PRD citations were found at all", prdCites.length > 0, true);

  // Resolve a cited file to a path that exists. The docs cite bare basenames
  // (`PRD.md`) and repo-relative paths alike, and V1 files moved to
  // supabase/archive-v1/ — so a citation naming the old location still resolves.
  // Anything unresolvable is SKIPPED, not failed: this scanner must not become a
  // second, accidental "does this file exist" check with a worse error message.
  const CANDIDATES = (f) => [
    f,
    `docs/${f}`,
    `docs/contracts/${f}`,
    `docs/v2/${f}`,
    `docs/decisions/${f}`,
    `supabase/migrations/${f}`,
    `supabase/archive-v1/${f}`,
    f.replace(/^supabase\/migrations\//, "supabase/archive-v1/"),
  ];
  const linesOf = (f) => {
    for (const p of CANDIDATES(f)) {
      const t = readIfAny(p);
      if (t !== null) return t.split("\n");
    }
    return null;
  };

  const resolves = (file, line) => {
    const lines = linesOf(file);
    // Unresolvable file → treat as satisfied, so this never doubles as a
    // "does the file exist" check with a misleading message.
    if (lines === null) return true;
    return line >= 1 && line <= lines.length && lines[line - 1].trim() !== "";
  };

  const dangling = [];
  for (const c of cites) {
    if (c.files.some((f) => resolves(f, c.line))) continue;
    dangling.push(`${c.doc} → ${c.files.join("|")}:${c.line}`);
  }
  chk("every line the V2 docs cite exists and is not blank", [...new Set(dangling)].sort(), []);

  // Every PRD row one of the ratification blockquote's items rests on. Each is
  // quoted in TICKETS.md beside its line number, so the quote is checked
  // against the line — this is the assertion that would have caught the
  // original §19.2 defect had anyone cited those rows at all.
  //
  // The label deliberately does NOT say how many rows there are. A label built
  // from the figure it checks renames itself the moment the figure moves, the
  // negative suite's probe then matches no line, and the run reports NO-OP
  // instead of the catch it actually made. That is not hypothetical — it is
  // why the wider-reading assertions above are numbered by ordinal. This list
  // went 3 → 12 → 18 → 32 in four commits; the label has not moved once, and
  // the comment above it does not say "six items" any more for the same reason.
  //
  // THREE kinds of row sit in this list, and the distinctions are findings
  // rather than formatting. An **exclusion** (§19, §22) says *we chose not to
  // build this*; an **assumption** (§20) says *we believe nobody wants it*; a
  // **register entry** (§21) is a decision that `:2025` says may not be
  // reopened or reinterpreted at all. Ratifying the first un-marks a row, the
  // second retires a belief, the third amends the register and writes an
  // accepted consequence in §21.2. `A-U9`/`A-B6` are the precedent for the
  // second act and Q7 (`:2037`, `:2056`) for the third — it is the one entry
  // already reversed. The board argues from all three, so all three are pinned.
  const EXCLUSIONS = [
    // item 1 — search
    [1875, "Advanced search / faceted filtering"],
    [2134, "Search and faceted filtering"],
    // item 2 — sessions and lots
    [1846, "Scheduled future start times"],
    [1847, "Multiple quantity / lots"],
    [1949, "nobody needs to schedule a future start"],
    [1945, "An auction sells exactly one item, in one quantity"],
    // Q5, item 2's register entry. It bounds a duration AND fixes when the
    // clock starts; scheduling crosses the second half, so the pin is on that
    // half rather than on "5 minutes to 7 days".
    [2035, "inclusive, measured from creation using server time"],
    // item 3 — the increment
    [1848, "Bid increments of any kind, per-auction or platform-wide"],
    // item 4 — image editing
    [1915, "Multiple images per auction"],
    [1917, "Image editing / cropping"],
    [2104, "Multiple images and video"],
    [1978, "no in-product editing is needed"],
    [1975, "One image per auction is sufficient"],
    // item 5 — the professional seller. :1936 is the one row here recorded as
    // a *negative* result — checked, does not appear to break. It is pinned
    // for exactly that reason: a negative result is only worth anything for as
    // long as the line it was read against still says what was read.
    [1886, "Bulk listing / seller tools"],
    [1930, "Users are individuals, not businesses"],
    [1936, "no separate account types are needed"],
    // item 6 — the deposit
    [1806, "Wallets or stored balances"],
    [1825, "Escrow / settlement"],
    // item 7 — who authors a listing
    [1952, "Sellers will write their own descriptions and provide their own images"],
    // item 8 — a host ending a published lot early. Five lines across three
    // sections, and :798 carries TWO pins because it carries two things.
    //
    // The first is BR-30's rule. The second is its RATIONALE, and it is pinned
    // separately after a probe proved the first pin does not cover it: item 8's
    // argument is not merely that BR-30 exists, it is that BR-30's stated
    // reason — an informal reserve — survives onto the new power unchanged.
    // Delete that clause and the argument goes with it while the rule half
    // still reads perfectly, so a pin on the rule half stays green through the
    // exact edit item 8 warns about. One line, two claims, two pins.
    [798, "Once published it runs to its end time and closes automatically"],
    [798, "would hold an informal reserve, undermining BR-06 and fairness"],
    [1218, "no branches, no cancellation, and no manual intervention"],
    [1223, "requiring no administrator and no human action"],
    [2031, "A published auction runs to its end time and closes"],
    // Q2 forbids the OUTCOME where Q1 forbids the control, which is why item 8
    // leans on it hardest. Pinned on the rule rather than on the "reserve not
    // met" phrase, which carries quotes the probe would have to escape twice.
    [2032, "The highest valid bid wins regardless of amount"],
    [2033, "starting price, end time, and image are immutable once published"],
    // §21's own authority. This is the third kind of row: not a boundary and
    // not a belief, but the sentence that makes every item above binding
    // rather than advisory — and, at :2034/:2055, the register entry item 3
    // turns on.
    [2025, "No decision here may be reopened, reinterpreted, defaulted, or worked around during implementation"],
    [2067, "The resolution is recorded here first, then built"],
    [2034, "Never `+5 / +10 / +50`"],
    [2055, "Implementers must not add one"],
    // Q7 — the one register entry already reversed — and its accepted
    // consequence. The board argues FROM these for what ratifying anything
    // else requires, so they are pinned for the same reason `:145` in the
    // decisions index is: a precedent that quietly stops saying what it is
    // cited for takes the argument with it.
    [2037, "REOPENED AND REVERSED 2026-08-13"],
    [2056, "past the end time shown at creation"],
  ];
  const moved = EXCLUSIONS
    .filter(([n, text]) => !(PRD[n - 1] ?? "").includes(text))
    .map(([n, text]) => `PRD.md:${n} no longer reads "${text}"`);
  chk("every PRD row the ratification items rest on still sits on the line cited", moved, []);

  // …and that the board still cites each one. Dropping a citation is how the
  // finding gets un-found: the rows stay in the PRD, the argument disappears,
  // and nothing goes red.
  const uncited = EXCLUSIONS
    .filter(([n]) => !cites.some((c) => c.doc === "docs/v2/TICKETS.md" && c.line === n))
    .map(([n]) => `PRD.md:${n}`);
  chk("TICKETS.md still cites every PRD row its ratification items rest on", uncited, []);

  // SC-67 is the one line item 6 turns on, and it is a sentence rather than a
  // table row: the deposit question is whether a priced entry gate *implies* a
  // stored balance. If that verb ever softens, item 6 is arguing from a line
  // that no longer says what it quotes.
  chk(
    "PRD.md:1813 still says no screen may imply the excluded payment surface",
    (PRD[1812] ?? "").includes("offers or implies"),
    true,
  );
}

// ---------------------------------------------------------------------------
// The same treatment for the OTHER source of truth. `CLAUDE.md` §2 ranks
// `ARCHITECTURE.md` second, above TICKETS.md — and until the crossings section
// was written this board cited it zero times, in either direction. Everything
// above this line watches the product document; nothing watched the
// architecture one, which is how six crossings sat unnoticed through four
// sweeps of a document one rank lower.
//
// TWO differences from the PRD block, and both are the point rather than
// bookkeeping:
//
//   1. an `ADR` carries its own **reversal condition**. That makes a crossing
//      here a steward's amendment rather than the owner's ratification, so
//      these rows deliberately do NOT feed the blockquote count below.
//   2. one pin is not in a document at all. Crossing 6 rests on a `WITH CHECK`
//      that is live on `main`, and a policy is not reworded the way prose is —
//      it is edited by someone changing behaviour. A pin there fails loudly and
//      for a real reason, which is exactly what is wanted.
{
  const ARCH = read("ARCHITECTURE.md").split("\n");
  const POLICY = read(
    "supabase/archive-v1/20260812120000_bid02_bid_acceptance.sql",
  ).split("\n");

  const archCites = [...TICKETS.matchAll(/`ARCHITECTURE\.md:(\d+)`/g)].map((m) =>
    Number(m[1]),
  );
  chk("ARCHITECTURE.md citations were found in TICKETS.md at all", archCites.length > 0, true);

  const archDangling = [...new Set(archCites)]
    .filter((n) => !(n >= 1 && n <= ARCH.length) || ARCH[n - 1].trim() === "")
    .sort((a, b) => a - b)
    .map((n) => `ARCHITECTURE.md:${n}`);
  chk("every ARCHITECTURE.md line cited by TICKETS.md exists and is not blank", archDangling, []);

  // FIVE kinds of row, and the probe budget in the negative suite is one per
  // kind rather than one per tuple — same rule as EXCLUSIONS above, same
  // reason. A **reversal condition** is a conditional whose trigger has fired;
  // a **prose absolute** is a sentence that simply stops being true; a **table
  // row** is a boundary; a **stale count** is a figure that moved underneath a
  // claim; and the SQL below is a **shipped constraint**, which is the only
  // kind here that can break a deployment rather than an argument.
  const ARCH_LINES = [
    // crossing 1 — ADR-3's reversal condition, and §8.5's long form of it.
    // Pinned on the trigger clause, not on "None exists in the MVP": the
    // finding is that the named trigger FIRED, so if the trigger is reworded
    // the crossing has to be re-argued from whatever replaced it.
    [1384, "an outbound integration appears"],
    [469, "or a third-party API"],
    // crossing 2 — the prose absolute. §6.5's first sentence is the whole
    // claim; the table under it is just instances.
    [328, "means **inside PostgreSQL**, not inside a Vercel function"],
    // crossing 3 — §17.3. TWO pins on the same paragraph for the same reason
    // PRD.md:798 carries two: the section makes a claim AND issues an
    // instruction, and the crossings section argues from both halves. Delete
    // the "should trigger a review" clause and crossing 3 loses its warrant
    // while the sentence it quotes still reads perfectly.
    [1218, "the application never holds an elevated credential"],
    [1218, "is a signal that something has drifted from this architecture"],
    // crossing 4 — the realtime scope table.
    [958, "New bids on that auction; that auction's price and status changes"],
    // crossing 5 — the owner's row, and the sentence that says what it means.
    // :685 is the pin that matters; :681 is the row it is about.
    [681, "immutable (BR-31)"],
    [685, "the structural expression of Q1 and Q3's resolution"],
    // the three not-crossing results. A negative result is worth exactly as
    // long as the line it was read against still says what was read — the
    // same argument that put PRD.md:1936 in the list above.
    [310, "A separate admin service"],
    [1372, "a long-running process or in-memory state"],
    // the deposit's second and third witness.
    [169, "No payment integration, no PCI scope"],
    [174, "any payment, contact, or fulfillment capability"],
    [1532, "Payment, messaging, notification, admin, or fulfillment infrastructure"],
    // the stale count that is deliberately NOT fixed here. Pinned so that the
    // day someone does fix it, the note explaining why it was left goes red
    // instead of quietly describing a figure that has moved.
    [1552, "closes all fifteen"],
  ];
  const archMoved = ARCH_LINES
    .filter(([n, text]) => !(ARCH[n - 1] ?? "").includes(text))
    .map(([n, text]) => `ARCHITECTURE.md:${n} no longer reads "${text}"`);
  chk("every ARCHITECTURE.md line the crossings section rests on still sits on the line cited", archMoved, []);

  const archUncited = [...new Set(ARCH_LINES.map(([n]) => n))]
    .filter((n) => !archCites.includes(n))
    .sort((a, b) => a - b)
    .map((n) => `ARCHITECTURE.md:${n}`);
  chk("TICKETS.md still cites every ARCHITECTURE.md line its crossings section rests on", archUncited, []);

  // Crossing 6. Not a document — the V1 `auctions_owner_insert` WITH CHECK
  // that is in the archive. `V2-A11` says a lot's end_time is computed when
  // the lot opens; V1 refused an insert without one. V2 resolved this crossing
  // with a draft status and a trigger-based guard at publish time (see the
  // updated crossing 6 note in TICKETS.md). Both halves of the V1 policy block
  // are pinned because the crossings section argues from both: the insert-time
  // bound (line 524, index 523) and the no-update/no-delete comment (line 509,
  // index 508).
  //
  // THESE NUMBERS MOVED TWICE IN ONE DAY, AND THE ROUND TRIP IS THE LESSON.
  //
  // Earlier on 2026-08-16 they were changed FROM 524/509 TO 500/485. That was
  // correct at the time and measured, not guessed: this branch forked before
  // main's 24-line pause note was added above both statements, so the archived
  // copy really did hold them 24 lines earlier. Then the merge with main landed
  // — git followed the supabase/migrations/ → supabase/archive-v1/ rename and
  // applied those same 24 lines to the archived copy — and the archive became
  // byte-identical to V1's final state on main (verified with `diff`, not
  // assumed). So the pins moved back.
  //
  // The rule that survives both moves: a pin is re-derived by diffing the two
  // copies and finding the statement, NEVER by sliding the index until the
  // check goes green. Both times the number changed, the sentence at that index
  // was the same sentence. That is the only evidence that distinguishes a
  // corrected pin from a defeated check.
  //
  // THESE TWO ASSERTIONS DEFEND LESS THAN THEY APPEAR TO, AND THAT IS WRITTEN
  // HERE RATHER THAN LEFT TO BE DISCOVERED. supabase/archive-v1/ is frozen —
  // V1 is not developed on this branch — so a pin into it cannot fail because
  // of anything anyone does to the PRODUCT. What they still catch is an edit to
  // the archive itself, which tests/v2/graph-negative.check.sh proves by making
  // one. That is narrow, and it is not nothing: an edit to a frozen directory
  // is precisely the change nobody thinks to look for. They are kept because
  // the crossings section argues from V1's starting position and a reader has
  // to be able to check that argument.
  //
  // The V2 guarantee that replaced this one is defended, by a live check
  // against the live schema: "auction update and delete are confined to drafts
  // by RLS policy", in tests/integration/excluded-features.check.sh §3. That
  // is the one to edit when the rule changes. This one will keep saying yes.
  chk(
    "the archived V1 insert policy demanded a future end_time at insert time",
    (POLICY[523] ?? "").includes("end_time >= now() + interval '5 minutes'"),
    true,
  );
  chk(
    "the archived V1 policy block recorded that no update or delete path existed",
    (POLICY[508] ?? "").includes("There is NO update and NO delete policy on auctions for any user"),
    true,
  );

  // The crossings section states its own count, exactly as the owner's
  // blockquote does below. Six is a number a later sweep will want to raise.
  const archHeading = TICKETS.split("\n").find((l) =>
    l.startsWith("### `ARCHITECTURE.md` and this board do not cite each other"),
  ) ?? "";
  // The `archive-v1/` prefix is optional because row 6's citation gained one in
  // the 2026-08-16 merge — the file it names moved from supabase/migrations/ to
  // supabase/archive-v1/ when V1 was archived, and the row was corrected to say
  // so. Without the optional group this counted 5 rows in a 6-row table and
  // reported the HEADING as wrong, which is the failure mode worth naming: a
  // row-matching pattern that silently stops matching does not report itself
  // missing, it blames the count.
  const archRows = TICKETS.split("\n").filter((l) =>
    /^\| \*\*\d+\*\* \| `(ARCHITECTURE\.md|(?:archive-v1\/)?20260812120000_)/.test(l),
  ).length;
  chk(
    "the crossings section's stated count matches the rows in its table",
    [word2num(archHeading.match(/— (\w+) crossings/)?.[1] ?? ""), archRows],
    [archRows, archRows],
  );
}


// ---------------------------------------------------------------------------
// And the same treatment for ranks THREE and FOUR. `CLAUDE.md` §2 orders the
// sources of truth `PRD.md`, `ARCHITECTURE.md`, `TEAM.md`, `GITHUB_PLAN.md` —
// the two blocks above watch the first two, and nothing watched these. That is
// how a board configured entirely for the MVP, asserting its own finality in
// three places, sat directly underneath a task to create forty V2 issues on it.
//
// THREE differences from both blocks above:
//
//   1. these are PROCESS documents. No ADR, no reversal condition, no owner's
//      ratification — a crossing here is a **team** decision about tracker
//      configuration, so like the architecture rows these do not feed the
//      blockquote count, and unlike them they are not a steward's either.
//   2. two assertions here DERIVE rather than pin. The register-versus-copy
//      row count and the `fifteen` census are computed from the documents on
//      every run, so they go red when EITHER side moves — including when
//      somebody fixes them, which is the point: the prose explaining the gap
//      must not outlive the gap.
//   3. one pin is a line this repository must never edit. `PRD.md:2027` is the
//      register's own heading and it is counted, not pinned, for exactly the
//      reason the PRD is absent from `neg_files`.
{
  const TEAMD = read("TEAM.md").split("\n");
  const PLAN = read("GITHUB_PLAN.md").split("\n");

  for (const [doc, lines] of [["TEAM.md", TEAMD], ["GITHUB_PLAN.md", PLAN]]) {
    const esc = doc.replace(".", "\\.");
    const cites = [...TICKETS.matchAll(new RegExp("`" + esc + ":(\\d+)`", "g"))].map((m) =>
      Number(m[1]),
    );
    chk(`${doc} citations were found in TICKETS.md at all`, cites.length > 0, true);
    const dangling = [...new Set(cites)]
      .filter((n) => !(n >= 1 && n <= lines.length) || lines[n - 1].trim() === "")
      .sort((a, b) => a - b)
      .map((n) => `${doc}:${n}`);
    chk(`every ${doc} line cited by TICKETS.md exists and is not blank`, dangling, []);
  }

  // FOUR kinds, one probe each in the negative suite. A **closed taxonomy** is
  // a total asserted as final; a **prohibition** is an instruction resting on a
  // premise; an **acceptance criterion** is a merged ticket's AC that a later
  // change would falsify; and a **product prohibition** is the one row here
  // that is the owner's rather than the team's.
  const BOARD_LINES = [
    // crossing 1 — the closed taxonomy, milestones half. Pinned on the
    // absolute, not on the milestone names: the finding is that a sixth is
    // foreclosed IN WRITING, so a reword is what has to re-open the argument.
    ["TEAM.md", 0, 0, ""],
    ["GITHUB_PLAN.md", 214, "no extra milestones are created", "closed taxonomy"],
    // crossing 2 — the closed taxonomy, labels half. Two documents assert the
    // same total, and `type:feature`'s definition is what makes every V2
    // ticket mislabel itself, so all three are pinned.
    ["TEAM.md", 1076, "**22 labels exist**", "closed taxonomy"],
    ["GITHUB_PLAN.md", 151, "Total after setup: 22 labels", "closed taxonomy"],
    ["GITHUB_PLAN.md", 144, "MVP functionality", "closed taxonomy"],
    // crossing 3 — the prohibition, all four copies plus the two lines that
    // close the escape hatch. Four documents forbid the label and two more
    // refuse the alternative; drop any one and the section overstates.
    ["TEAM.md", 1091, "**never existed**, and must not be created", "prohibition"],
    ["TEAM.md", 1095, "zero open product questions, so no Issue can be blocked on one", "prohibition"],
    ["GITHUB_PLAN.md", 164, "**Does not exist.** PRD v3.0 has zero open product questions", "prohibition"],
    ["GITHUB_PLAN.md", 145, "**Never a product question**", "prohibition"],
    ["TEAM.md", 1097, "never product questions about what Dalal should do", "prohibition"],
    // the acceptance criteria. These are the reason adding one label is not
    // free: both are ACs of tickets that have already merged.
    ["GITHUB_PLAN.md", 248, "22 labels exist, no existing label deleted · five milestones exist", "acceptance criterion"],
    ["GITHUB_PLAN.md", 271, "`needs-decision` does not exist", "acceptance criterion"],
    // crossing 4 — the convenience copy's own framing. The ROW COUNT is
    // derived below; this pins the sentence that makes a short table a defect
    // rather than a deliberate excerpt.
    ["TEAM.md", 1308, "This table is a convenience copy for daily work", "closed taxonomy"],
    // crossing 5 — the owner's row, and the precedent sitting two lines above
    // it. The precedent is load-bearing: the section argues that whoever
    // ratifies D-01 has a worked example of the edit already in place.
    ["TEAM.md", 1334, "bid increment", "product prohibition"],
    ["TEAM.md", 1331, "was removed from this list on 2026-08-13", "product prohibition"],
    // the two already-governed results, and the stale status row. Recorded for
    // the same reason ARCHITECTURE.md:310 is: a negative result is worth as
    // long as the line it was read against still reads that way.
    ["TEAM.md", 1105, "reassign it rather than doing it yourself", "already governed"],
    ["GITHUB_PLAN.md", 776, "owner of the consumed functionality has reviewed it", "already governed"],
    ["GITHUB_PLAN.md", 11, "No Issues, milestones, or labels created yet", "already governed"],
    // Q7's reopening. `PRD.md` SD-03 says never; §21.1 and this row say once,
    // with a date. Pinned in TEAM.md rather than the PRD because this file may
    // not mutate the PRD, and the convenience copy carries the same note.
    ["TEAM.md", 1318, "reversed 2026-08-13", "product prohibition"],
  ].filter(([, n]) => n > 0);

  const SRC = { "TEAM.md": TEAMD, "GITHUB_PLAN.md": PLAN };
  const boardMoved = BOARD_LINES
    .filter(([doc, n, text]) => !(SRC[doc][n - 1] ?? "").includes(text))
    .map(([doc, n, text]) => `${doc}:${n} no longer reads "${text}"`);
  chk("every board line the crossings section rests on still sits on the line cited", boardMoved, []);

  const boardUncited = BOARD_LINES
    .filter(([doc, n]) => !TICKETS.includes(`\`${doc}:${n}\``))
    .map(([doc, n]) => `${doc}:${n}`);
  chk("TICKETS.md still cites every board line its crossings section rests on", boardUncited, []);

  // DERIVED, not pinned. §21.1 is the register; TEAM.md §26 calls itself a copy
  // of it. Counting both every run means this goes red when the register grows
  // AND when somebody finally adds the missing row — and the second case is the
  // one that matters, because the paragraph explaining the gap must not survive
  // the gap being closed.
  const prdQ = read("PRD.md")
    .split("\n")
    .filter((l) => /^\| \*\*Q\d+\*\* \|/.test(l)).length;
  const t26 = TEAMD.indexOf("## 26. Finalized product decisions — quick reference");
  const t26End = TEAMD.findIndex((l, i) => i > t26 && l.startsWith("### "));
  const teamRows = TEAMD.slice(t26, t26End).filter((l) => /^\| \d+ \| /.test(l)).length;
  chk(
    "TEAM.md §26's convenience copy is still one row short of PRD.md §21.1's register",
    [prdQ, teamRows],
    [16, 15],
  );

  // DERIVED. The census the ARCHITECTURE section under-counted: it read :1552
  // as one stale word in one document. Counting the word across the four
  // documents that make a decision-count claim puts it at thirteen. Seven are
  // in a file no session may edit, which is what moves the fix to the owner.
  const census = Object.fromEntries(
    ["PRD.md", "TEAM.md", "ARCHITECTURE.md", "README.md"].map((f) => [
      f,
      (read(f).match(/fifteen/g) ?? []).length,
    ]),
  );
  chk(
    "the `fifteen` decision-count claim still stands at thirteen across four documents",
    census,
    { "PRD.md": 7, "TEAM.md": 3, "ARCHITECTURE.md": 2, "README.md": 1 },
  );

  // The board section states its own count, like the two above it.
  const boardHeading = TICKETS.split("\n").find((l) =>
    l.startsWith("### The board these issues would be created on has no room for V2"),
  ) ?? "";
  const boardRows = TICKETS.split("\n").filter((l) =>
    /^\| \*\*\d+\*\* \| `(TEAM\.md|GITHUB_PLAN\.md)/.test(l),
  ).length;
  chk(
    "the board section's stated count matches the rows in its table",
    [word2num(boardHeading.match(/— (\w+) crossings/)?.[1] ?? ""), boardRows],
    [boardRows, boardRows],
  );

  // -------------------------------------------------------------------------
  // TRACKER_PROPOSAL.md — the most perishable document in this tree, and the
  // only one that is a QUESTION rather than a record. Everything else here
  // describes something that is already true; this one describes something
  // somebody still has to answer, so it rots in a way the others cannot: the
  // board moves, the guards move, and it goes on asking for the wrong thing
  // in a form that still reads as authoritative. Every assertion below is
  // DERIVED. Nothing pins its prose, deliberately — a decision request should
  // be rewritable without a test telling its author which words to use.
  const PROP = read("docs/v2/TRACKER_PROPOSAL.md");

  // Same dangling check the two process documents get. A proposal whose edit
  // list points at a line that has moved is worse than no edit list, because
  // whoever executes it edits the WRONG line and CI stays green — none of the
  // pins below cover a line the proposal invented.
  for (const [doc, lines] of [["TEAM.md", TEAMD], ["GITHUB_PLAN.md", PLAN]]) {
    const esc = doc.replace(".", "\\.");
    const bad = [...new Set(
      [...PROP.matchAll(new RegExp("`" + esc + ":(\\d+)`", "g"))].map((m) => Number(m[1])),
    )]
      .filter((n) => !(n >= 1 && n <= lines.length) || lines[n - 1].trim() === "")
      .sort((a, b) => a - b)
      .map((n) => `${doc}:${n}`);
    chk(`every ${doc} line TRACKER_PROPOSAL.md's edit list names exists and is not blank`, bad, []);
  }

  // Gate 2 rests on an assignment of every board row to an area. A proposal
  // that covers 40 of 41 ships one ticket with no label at all, and the row it
  // drops is whichever was added last — the newest and least-reviewed on the
  // board. Both halves are checked: the per-row arithmetic, and the coverage.
  const propArea = [...PROP.matchAll(/^\| `area:(\w+)`[^|]*\|\s*(\d+)\s*\|([^|]+)\|/gm)];
  const expand = (cell) =>
    (cell.match(/\bV2-00\b|\b[ABC]\d+\b/g) ?? []).map((t) => (t === "V2-00" ? t : `V2-${t}`));
  chk(
    "TRACKER_PROPOSAL.md's area table states, row by row, a count matching its own ticket list",
    propArea
      .map(([, a, n, cell]) => [`area:${a}`, Number(n), expand(cell).length])
      .filter(([, n, len]) => n !== len),
    [],
  );
  const assigned = propArea.flatMap(([, , , cell]) => expand(cell));
  chk(
    "TRACKER_PROPOSAL.md assigns an area to every board ticket, exactly once",
    {
      unassigned: [...board.keys()].filter((t) => !assigned.includes(t)).sort(),
      twice: assigned.filter((t, i) => assigned.indexOf(t) !== i).sort(),
      invented: assigned.filter((t) => !board.has(t)).sort(),
    },
    { unassigned: [], twice: [], invented: [] },
  );

  // The proposal's closing argument is "accepting this turns CI red, and that
  // is the mechanism working". If a line it names stops being pinned, the
  // argument becomes decoration — and the reader has no way to tell, because
  // an unpinned line reads exactly like a pinned one.
  const pinnedSet = new Set(BOARD_LINES.map(([doc, n]) => `${doc}:${n}`));
  const propPinned = [...PROP.matchAll(/^\| `(TEAM\.md|GITHUB_PLAN\.md):(\d+)`/gm)]
    .map((m) => `${m[1]}:${m[2]}`);
  chk(
    "every line TRACKER_PROPOSAL.md says a guard pins is actually pinned",
    propPinned.filter((r) => !pinnedSet.has(r)).sort(),
    [],
  );
  chk(
    "TRACKER_PROPOSAL.md's pin arithmetic — total, edited, untouched — still adds up",
    [
      word2num(PROP.match(/pins (\w+) board lines/)?.[1] ?? ""),
      word2num(PROP.match(/\*\*(\w+) of them are lines this\s+proposal edits\*\*/)?.[1] ?? ""),
      word2num(PROP.match(/The other (\w+) stay green/)?.[1] ?? ""),
    ],
    [pinnedSet.size, propPinned.length, pinnedSet.size - propPinned.length],
  );

  // Option 3A costs nothing precisely BECAUSE the grouping is the register's
  // own, taken from SPEC.md rather than invented here. Derive both sides: the
  // day a seventh record appears, or an O item is re-homed, the proposal stops
  // describing the register it claims to be a view of.
  const specD = new Map();
  for (const line of SPEC.split("\n")) {
    const m = line.match(/^\|\s*\*\*(O\d+)\*\*\s*\|[^|]*\|([^|]*)\|/);
    if (m) {
      for (const d of m[2].match(/\bD-\d+\b/g) ?? []) {
        specD.set(d, (specD.get(d) ?? new Set()).add(m[1]));
      }
    }
  }
  const propD = [...PROP.matchAll(/^\| `(D-\d+)`[^|]*\|([^|]*)\|\s*(\d+)\s*\|/gm)];
  chk(
    "TRACKER_PROPOSAL.md's tracking issues still group the register exactly as SPEC.md does",
    Object.fromEntries(propD.map((m) => [m[1], Number(m[3])])),
    Object.fromEntries([...specD].sort().map(([d, s]) => [d, s.size])),
  );
  // …and the O items it lists are the ones SPEC.md maps there, not just the
  // right COUNT of them. A row that says 11 and lists eleven wrong ids passes
  // the check above and sends a ticket to the wrong tracking issue.
  chk(
    "TRACKER_PROPOSAL.md lists the register's own O items under each record, not merely the count",
    propD
      .map((m) => [m[1], (m[2].match(/\bO\d+\b/g) ?? []).sort().join(",")])
      .filter(([d, got]) => got !== [...(specD.get(d) ?? [])].sort().join(",")),
    [],
  );
  // The distinct total is the register's size. Stated separately from the
  // per-record grouping because the interesting number is the one the sum
  // OVERSHOOTS: O23 is mapped twice on purpose, and that double-count is the
  // whole of gate 3's argument. If it ever stops overshooting, the argument
  // has lost its example and the prose around it is stale.
  chk(
    "TRACKER_PROPOSAL.md's tracking table still overshoots the register by exactly the shared item",
    [
      propD.reduce((a, m) => a + Number(m[3]), 0),
      new Set(propD.flatMap((m) => m[2].match(/\bO\d+\b/g) ?? [])).size,
    ],
    [register.size + 1, register.size],
  );
}

// ---------------------------------------------------------------------------
// M. The contracts, which rank 5 in CLAUDE.md §2 and WIN against an older
// document. That last property is why these assertions exist at all: a stale
// PRD paragraph is merely wrong, but a stale contract clause is wrong AND
// authoritative, so a session obeying the authority order correctly is led
// into the defect. Three of the four contracts were amended on 2026-08-15 for
// collisions with what V2 builds, and each amendment states a fact about
// another file. Every assertion below recomputes both sides.
// ---------------------------------------------------------------------------
{
  const S011 = read("docs/contracts/S0-11-auction-record.md");
  const S012 = read("docs/contracts/S0-12-money.md");
  const BID02 = read("docs/contracts/BID-02-bid-operation.md");
  const MONEY = read("lib/money.ts");
  const INT08 = read("tests/integration/excluded-features.check.sh");
  const CORE = read("supabase/migrations/20260815100000_core_schema.sql");
  const CLAUDE = read("CLAUDE.md");

  // A contract that states the end_time write-door rule and does not name the
  // pause door is the armed-stale-copy case: rank 5 beats an older document,
  // so it would out-rank the very decision that superseded it.
  //
  // The predicate has to detect the CLAIM, not three tokens in one file. The
  // first draft asked for end_time + place_bid + "only" anywhere in the
  // document and flagged BID-02-verification.md, which says "verified the only
  // way that counts" about LC-03 and never mentions the door rule at all. So:
  // "only" must be followed by place_bid inside one sentence, and end_time must
  // be within 300 characters of that. S0-12 §9.4's "Only `place_bid` inserts
  // bids and writes `current_price`" is correctly NOT caught — it is a claim
  // about the bids write path, which pause does not touch and does not change.
  const DOOR = /(end_time[\s\S]{0,300}?\bonly\b[^.\n]{0,40}place_bid)|(\bonly\b[^.\n]{0,40}place_bid[\s\S]{0,300}?end_time)/i;
  chk(
    "every contract stating the end_time door rule names BOTH doors, not just place_bid",
    Object.entries({
      "S0-11-auction-record.md": S011,
      "S0-12-money.md": S012,
      "BID-02-bid-operation.md": BID02,
      "BID-02-verification.md": read("docs/contracts/BID-02-verification.md"),
    })
      .filter(([, t]) => DOOR.test(t) && !/pause/i.test(t))
      .map(([f]) => f)
      .sort(),
    [],
  );

  // ── This assertion did the job it was written for, and then changed shape ──
  //
  // It used to read "all three artefacts S0-11 §7 says prohibit bid_increment
  // still do", and its own comment predicted its death: "When V2-A3 lands and
  // amends all three, this SHOULD go red — the notice's 'the prohibition
  // stands' becomes false at that moment and the notice is what must change."
  //
  // On 2026-08-15 the column landed. It went red on 2026-08-16, the first time
  // it was run against the shipped tree. So the prediction was right about the
  // event and wrong about the shape: V2-A3 did NOT amend all three. It amended
  // ONE — INT-08, and not even in the same PR — and left the two contract
  // clauses standing. The tree now holds a documented prohibition and a server
  // that enforces the opposite, which is a state neither the old assertion nor
  // the notice had a way to express.
  //
  // WHAT THIS MEASURES NOW IS THE CONTRADICTION ITSELF, AND THAT IS DELIBERATE.
  // Re-aiming it at "the increment is enforced" would have been the easy green
  // and would have quietly ratified a product decision nobody made — exactly
  // what CLAUDE.md §8 says this project keeps doing. So every side is pinned:
  // the two contract clauses that still prohibit, the countersignature that
  // still says the prohibition holds, the code that rejects below v_min, the
  // re-aimed INT-08, and the two places the contradiction is written up as
  // open. Move ANY one of them alone and this goes red.
  //
  // It goes red in both directions on purpose. Resolve it the owner's way (b) —
  // amend the contracts — and this fails until the assertion is rewritten to
  // match, which is the moment someone must state which way it went. Resolve it
  // way (a) — place_bid drops back to `> current_price` — and it fails too. The
  // ONLY green state is the honest one: unresolved, and recorded as unresolved.
  //
  // Keeping the two INT-08 halves separate is inherited from the old assertion
  // and still earns its place — a narrowing lands on one half at a time; see
  // the negative probe that caught exactly that.
  const int08Block = INT08.match(/^chk "no bid increment \/ minimum raise"[\s\S]*?\n(?=chk )/m) ?? [""];
  chk(
    "the bid_increment contradiction is intact on BOTH sides and recorded as open",
    {
      // the prohibition side — unamended, and it must stay unamended until the
      // owner rules, because a contract is not amended by code disagreeing
      "S0-11 §7 row still prohibits": /❌ `bid_increment`/.test(S011),
      "S0-12 §9.5 still prohibits": /\*\*No re-added checks\.\*\* No increment/.test(S012),
      "S0-11 §10 still countersigns it as holding": /No `bid_increment`/.test(S011),
      // the enforcement side — what actually shipped
      "core_schema computes a minimum raise": /v_min := v_a\.current_price \+ v_a\.bid_increment/.test(CORE),
      "core_schema rejects below it": /if v_amount < v_min then/.test(CORE),
      "INT-08 no longer carries the prohibition": int08Block[0] === "",
      "INT-08 pins the increment inside place_bid's lock instead":
        /v_a\.current_price \+ v_a\.bid_increment/.test(INT08),
      // the record — the only reason the two sides above may coexist
      "CLAUDE.md §0 states it as an open contradiction": /is an open\ncontradiction and is written here as one/.test(CLAUDE),
      "CLAUDE.md §0 leaves both ways out unchosen": /Two ways out/.test(CLAUDE),
      "S0-11 §7 records that the predicted day arrived": /The day the notice above predicted arrived/.test(S011),
    },
    {
      "S0-11 §7 row still prohibits": true,
      "S0-12 §9.5 still prohibits": true,
      "S0-11 §10 still countersigns it as holding": true,
      "core_schema computes a minimum raise": true,
      "core_schema rejects below it": true,
      "INT-08 no longer carries the prohibition": true,
      "INT-08 pins the increment inside place_bid's lock instead": true,
      "CLAUDE.md §0 states it as an open contradiction": true,
      "CLAUDE.md §0 leaves both ways out unchosen": true,
      "S0-11 §7 records that the predicted day arrived": true,
    },
  );
  chk(
    "S0-11 §7's notice states the artefact count it actually lists",
    word2num(S011.match(/(\w+) artefacts prohibit that column today/)?.[1] ?? ""),
    3,
  );

  // §8 is the tick list; §8.1 maps each box to its status after 5adaad2. They
  // are two views of one set, so a box added to one and not the other silently
  // drops a box from the signature surface — which is precisely §8.1's own
  // finding ("a signature covers the version it was given on").
  //
  // The class is `[ x]`, not ` `. Counting only UNTICKED boxes would turn this
  // red the moment a reviewer does the one thing the list exists to ask for —
  // a check that punishes compliance is a check that gets deleted.
  const boxes = (S011.match(/^- \[[ x]\] \*\*§/gm) ?? []).length;
  const s81 = S011.slice(S011.indexOf("### 8.1"));
  const rows = (s81.slice(0, s81.indexOf("\n---")).match(/^\| §/gm) ?? []).length - 1;
  chk("S0-11 §8's tick list and §8.1's status table cover the same number of boxes", boxes, rows);

  const table = s81.slice(0, s81.indexOf("\n---"));
  const endorsed = (table.match(/✅/g) ?? []).length + (table.match(/🟡/g) ?? []).length;
  chk(
    "S0-11 §8.1's stated untouched-box count is the one its own table produces",
    word2num(s81.match(/^(\w+) boxes are untouched/m)?.[1] ?? ""),
    rows - endorsed,
  );

  // S0-12 §9.6 argues from an inventory of lib/money.ts. An inventory that is
  // allowed to drift is a recollection, so both the names and the counts are
  // recomputed from the module every run.
  //
  // The third assertion below used to read "no addition primitive has appeared
  // in lib/money.ts while §9.6 still says none exists", and §9.6 promised in
  // its own text that "the day an `addSar` appears, the check goes red and this
  // section is what has to be rewritten". THAT DAY WAS 2026-08-15 and the
  // promise was kept: V2 shipped `addMoney`, this went red on the first run
  // against the shipped tree, and §9.6 was rewritten rather than the check
  // relaxed.
  //
  // It is re-aimed, not deleted, and at a DIFFERENT fact — because the fact it
  // guarded is spent. §9.6 was protecting "there is no sanctioned way to add",
  // which is now false by decision. What replaces it is the property that
  // actually has to survive: the addition exists AND it is integer-cent
  // arithmetic on BigInt, never on a float. Rule 1 forbids float arithmetic on
  // an amount, not the concept of addition — so the check that matters is no
  // longer "does addition exist" but "is the addition still exact". A future
  // session reimplementing addMoney with Number() would satisfy the old
  // assertion perfectly and violate rule 1 completely.
  const declared = [...(S012.match(/Its exported values are exactly, and exhaustively:\n([\s\S]*?)—/) ?? [])[1]
    ?.matchAll(/`(\w+)`/g) ?? []].map((m) => m[1]).sort();
  const actual = [...MONEY.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]).sort();
  chk("S0-12 §9.6's inventory of lib/money.ts is exactly the module's exported values", declared, actual);
  chk(
    "S0-12 §9.6's stated export counts match the module",
    [
      word2num(S012.match(/\*\*(\w+), of which (?:\w+) are\n\s*functions/)?.[1] ?? ""),
      word2num(S012.match(/of which (\w+) are\n\s*functions/)?.[1] ?? ""),
    ],
    [actual.length, (MONEY.match(/^export function /gm) ?? []).length],
  );
  chk(
    "lib/money.ts's arithmetic is BigInt integer cents — never Number, never a float",
    {
      // §9.6 option (b) shipped: the primitive exists and is named in the doc
      "an addition primitive exists": actual.some((n) =>
        /^(add|plus|sum)/i.test(n),
      ),
      "§9.6 records that V2 took option (b)": /V2 built \(b\)/.test(S012),
      // and the reason it is allowed to exist at all
      "it converts through integer cents": /toCents\(a\) \+ toCents\(b\)/.test(MONEY),
      "toCents returns BigInt": /function toCents\([^)]*\): bigint/.test(MONEY),
      "no float constructor anywhere in the module":
        !/\b(?:Number|parseFloat|parseInt)\s*\(/.test(MONEY),
      // the bid button is the call site §9.6 was written about
      "the bid button uses it rather than arithmetic of its own":
        /addMoney\(auction\.current_price, auction\.bid_increment\)/.test(
          read("components/bidding/live-auction.tsx"),
        ),
    },
    {
      "an addition primitive exists": true,
      "§9.6 records that V2 took option (b)": true,
      "it converts through integer cents": true,
      "toCents returns BigInt": true,
      "no float constructor anywhere in the module": true,
      "the bid button uses it rather than arithmetic of its own": true,
    },
  );

  // BID-02's pause note turns on one measurable fact: the flag is shared by the
  // bids-insert gate and the end_time gate. If a future migration splits them,
  // the note's argument evaporates and the note must be rewritten rather than
  // left standing as a reason that no longer holds.
  const mig = read("supabase/archive-v1/20260814000000_bid15_closing_and_extension.sql");
  const bid02mig = read("supabase/archive-v1/20260812120000_bid02_bid_acceptance.sql");
  chk(
    "BID-02's pause note still describes a real overload — one flag, both gates",
    {
      bidsInsertGate: /bids_only_via_place_bid[\s\S]*?dalal\.in_place_bid/.test(bid02mig),
      endTimeGate: /new\.end_time is distinct from old\.end_time[\s\S]*?dalal\.in_place_bid/.test(mig),
      noteExists: /READ THIS BEFORE IMPLEMENTING PAUSE/.test(BID02),
    },
    { bidsInsertGate: true, endTimeGate: true, noteExists: true },
  );
}

// ---------------------------------------------------------------------------
// The blockquote of open questions states its own item count, and the items
// are numbered by hand. Adding a fourth and leaving the word at "Three" is the
// same class of drift as every other count in this file — with the difference
// that the reader who miscounts here is the owner, deciding.
{
  // The capture stops at the first line that is not a blockquote line, not at
  // the next heading. Running to the heading swept in three paragraphs of
  // ordinary prose, which counted correctly today only because nothing in them
  // happens to be a numbered blockquote item.
  //
  // THAT LAST CLAUSE STOPPED BEING TRUE. The crossings section above now puts
  // six MORE `> **n.` items further down this file, and they are numbered 1..6
  // like the owner's are. They are a steward's list, not his, and the whole
  // reason the section sits outside the blockquote is that the two must not be
  // read as one page of work. Widen this capture to the next heading and it
  // silently becomes a fourteen-item blockquote addressed to the wrong person.
  // The separation is asserted below rather than left to the regex.
  const q = grab(
    TICKETS,
    /\*\*(\w+) things here are the owner's to answer[^*]*\*\*([^\n]*(?:\n>[^\n]*)*)/,
    "TICKETS.md states how many questions the ratification blockquote raises",
  );
  if (q) {
    const items = [...q[2].matchAll(/^> \*\*(\d+)\. /gm)].map((m) => Number(m[1]));
    chk("TICKETS.md: how many questions the blockquote raises", word2num(q[1]), items.length);
    chk(
      "TICKETS.md: the blockquote's questions are numbered 1..N with no gap",
      items,
      items.map((_, i) => i + 1),
    );
    chk(
      "the steward crossings have not been swept into the owner's blockquote",
      q[2].includes("ADR-3's reversal condition has already fired"),
      false,
    );
  }
}

// ---------------------------------------------------------------------------
// The suite's own labels, checked for a collision the negative harness cannot
// see. `neg_probe` locates a check with `grep -F -- "$label" | head -1` and
// demands the line start with FAIL. So if label A is a substring of label B and
// B prints first, A's probe reads B's verdict — and B passes, because the
// mutation was aimed at A. The probe reports MISSED against a check that
// worked perfectly.
//
// This is not hypothetical. Adding `TICKETS.md: unblocked before O1/O2,
// restated` disarmed the probe for `TICKETS.md: unblocked before O1/O2`, and
// the same edit disarmed one more. Both were CAUGHT before the commit and
// MISSED after it, with neither check touched. Renaming the new labels fixed
// it; this assertion is what stops the next one.
//
// Exact duplicates count too: two identical labels are the same failure with
// the substring relation at its most degenerate.
{
  const snapshot = [...LABELS];
  const collisions = [];
  for (let i = 0; i < snapshot.length; i++) {
    for (let j = 0; j < snapshot.length; j++) {
      if (i === j) continue;
      // Only the EARLIER label can shadow, because `head -1` takes the first
      // line — so report the ordered pair that actually does harm.
      if (i < j && snapshot[j].includes(snapshot[i])) {
        collisions.push(`${snapshot[i]}  <-- shadowed by  ${snapshot[j]}`);
      }
    }
  }
  chk("no assertion label is findable only by matching a different one", collisions.sort(), []);
}

console.log();
console.log(`${pass} passed, ${fail} failed`);
if (fail === 0) {
  console.log("V2-GRAPH: PASS");
  process.exit(0);
}
console.log("V2-GRAPH: FAIL");
console.log();
console.log("If the board changed and these numbers did not, fix the prose.");
console.log("If a sentence was reworded, fix the regex — in the same PR, and say");
console.log("which number moved. Do not delete an assertion to go green: SPEC.md");
console.log("§4.3 already explains what two silently-drifting copies of this graph");
console.log("cost, and this file is the only thing that reads both of them.");
process.exit(1);
