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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const TICKETS = read("docs/v2/TICKETS.md");
const SPEC = read("docs/v2/SPEC.md");
const DEC_README = read("docs/decisions/README.md");

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

// ---------------------------------------------------------------------------
// Parse the two tables
// ---------------------------------------------------------------------------
const board = new Map(); // V2-xx -> {deps, blocked}
for (const line of TICKETS.split("\n")) {
  const m = line.match(
    /^\|\s*\*\*(V2-[^*]+)\*\*\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/,
  );
  if (m) board.set(m[1].trim(), { deps: idsIn(m[4]), blocked: idsIn(m[5]) });
}

const register = new Map(); // O-n -> tickets the register says it blocks
for (const line of SPEC.split("\n")) {
  const m = line.match(/^\|\s*\*\*(O\d+)\*\*\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/);
  if (m) register.set(m[1], idsIn(m[4]));
}

if (board.size === 0 || register.size === 0) {
  console.log(
    `FAIL  parsed ${board.size} tickets and ${register.size} register rows — ` +
      `a table shape changed and every assertion below would pass vacuously`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// The closure. `answered` lets a caller ask "what opens up if these are decided?"
// ---------------------------------------------------------------------------
const startableWith = (answered = new Set()) => {
  const memo = new Map();
  const walk = (id, seen) => {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return false; // a cycle is never startable
    seen.add(id);
    const n = board.get(id);
    if (!n) return false;
    const ok = n.blocked.every((o) => answered.has(o)) &&
      n.deps.every((d) => walk(d, new Set(seen)));
    memo.set(id, ok);
    return ok;
  };
  return [...board.keys()].filter((id) => id !== "V2-00" && walk(id, new Set()));
};

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
const waves = () => {
  const unblocked = new Set(startableWith());
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
  chk("TICKETS.md: unblocked after O1/O2", Number(opens[2]), after.length);
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
  chk("TICKETS.md: unblocked after O1/O2", Number(plus20[1]), startableWith(new Set(["O1", "O2"])).length);
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
    chk(`reach of ${o}`, Number(n), reachOf([o]).size);
  }
  chk(`reach denominator on the ${from}${to ? `–${to}` : ""} row`, Number(denom), tickets);
}
chk("every row of the reach table was parsed", reachRows, reachTable.length);

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
