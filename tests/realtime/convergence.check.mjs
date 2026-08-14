// ============================================================================
// BID-10 / #71 — RT-X5 (the price never appears to move DOWNWARD) and
// RT-X4 (a duplicate delivery has no visible effect).
//
// Run:  node --no-warnings tests/realtime/convergence.check.mjs
//
// Needs nothing: no database, no network, no .env.local.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//
// #71's five acceptance criteria were, until this file, covered four different
// ways and one way not at all:
//
//   * SC-22 (no cleared entry, no stolen focus, no scroll) — MEASURED on a
//     running deployment in #84 (CP-2), recorded in docs/BID-21-traceability.md
//   * "indicated without altering their entry" — tests/realtime/ux-rules.check.mjs
//   * RT-X5 and RT-X4 — `grep -rn 'RT-X4\|RT-X5' tests/` returned NOTHING.
//
// The guard that implements both is six lines in lib/bidding/live-snapshot.ts
// and it is correct. It has simply never been asserted, which on this project
// is its own defect class (#130, and the SC-15 correction in the BID-21 table):
// the behaviour being right is not the same as the behaviour being held.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE IS, SAID PLAINLY — it is a MODEL plus a SOURCE AUDIT
//
// `live-snapshot.ts` cannot be imported here. It reaches `auction-channel.ts`,
// which builds `@supabase/ssr`'s browser client and wants a `document`; bare
// Node has neither. (`ux-rules.check.mjs` CAN import its module because that
// module takes only a TYPE from the channel, and a type import erases.)
//
// So this file does two separable things and claims exactly them:
//
//   1. It re-implements the store's read/publish logic as a model, with the
//      read injectable so response order is controllable, and asserts that
//      the RULE produces convergence: whatever order responses land in, the
//      published sequence never steps down and settles on the latest issued
//      read. The model is a transcription, not the product.
//
//   2. It asserts the real file still carries that rule, line for line.
//
// Neither half alone is worth much — a model can drift from the source, and a
// regex can match a rule that does not work. Together they say: this rule
// converges, and this rule is still in the file. What they do NOT say is that
// a VIEWER sees no downward step: that is a browser fact, it is INT-02 (#91)
// and #84's territory, and claiming it here would be the overclaim this
// project keeps making.
//
// Checks 18-20 are the point of the file. Each re-runs an assertion above with
// the guard deleted and requires it to FAIL. An assertion that has never been
// seen to fail is not yet an assertion.
// ============================================================================
import { readFileSync } from "node:fs";

const SOURCE = "lib/bidding/live-snapshot.ts";

const EXPECTED = 20;
let pass = 0;
let fail = 0;

function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    pass += 1;
    console.log(`PASS  ${label.padEnd(64)}  (${JSON.stringify(got)})`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label.padEnd(64)}  got=${JSON.stringify(got)}  want=${JSON.stringify(want)}`);
  }
}

// ---------------------------------------------------------------------------
// Comparing two SAR amounts WITHOUT touching a float (CLAUDE.md §4 rule 1).
// No Number(), no parseFloat, no arithmetic on the amount: split on the point,
// compare the integer parts by digit count then lexicographically, then the
// fractions zero-padded to equal width. Digit strings of equal length compare
// correctly under `<`. Fixtures here are unsigned decimal strings and the
// shape is enforced, so a malformed fixture throws rather than mis-sorting.
// ---------------------------------------------------------------------------
function cmpSar(a, b) {
  for (const v of [a, b]) {
    if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`not a plain SAR amount: ${v}`);
  }
  const [ai, af = ""] = a.split(".");
  const [bi, bf = ""] = b.split(".");
  if (ai.length !== bi.length) return ai.length < bi.length ? -1 : 1;
  if (ai !== bi) return ai < bi ? -1 : 1;
  const w = Math.max(af.length, bf.length);
  const ap = af.padEnd(w, "0");
  const bp = bf.padEnd(w, "0");
  if (ap === bp) return 0;
  return ap < bp ? -1 : 1;
}

/** true iff the sequence never steps DOWN — RT-X5 stated as a property. */
function neverDescends(prices) {
  for (let i = 1; i < prices.length; i += 1) {
    if (cmpSar(prices[i], prices[i - 1]) < 0) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// THE MODEL — a transcription of live-snapshot.ts's store, minus the channel.
//
// `guard: false` deletes the one line under test (`if (seq !== store.seq)
// return;`) and nothing else, which is what makes checks 19-20 a control and
// not a second opinion.
// ---------------------------------------------------------------------------
function makeModel({ guard = true } = {}) {
  const stores = new Map();
  const published = []; // every published price, in publish order
  let notifications = 0; // every listener call — one render each

  function publish(store, view) {
    store.view = view;
    published.push(view.snapshot.currentPrice);
    for (const listener of Array.from(store.listeners)) {
      if (store.listeners.has(listener)) listener();
    }
  }

  // The real issueRead calls readLiveSnapshot(auctionId); here the read is
  // passed in so the test owns when — and in what order — it resolves.
  function issueRead(auctionId, store, read) {
    const seq = ++store.seq;
    void read().then((snapshot) => {
      if (guard && seq !== store.seq) return; // a newer read owns the screen
      if (!snapshot) return; // keep the previous consistent snapshot
      if (stores.get(auctionId) !== store) return; // torn down while in flight
      publish(store, { ...store.view, snapshot });
    });
  }

  function open(auctionId) {
    const store = { view: { snapshot: null, connection: "connecting" }, listeners: new Set(), seq: 0 };
    stores.set(auctionId, store);
    const listener = () => {
      notifications += 1;
    };
    store.listeners.add(listener);
    return {
      cue: (read) => issueRead(auctionId, store, read),
      view: () => store.view,
      release: () => {
        store.listeners.delete(listener);
        if (store.listeners.size === 0) stores.delete(auctionId);
      },
    };
  }

  return { open, published, notified: () => notifications };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const snap = (currentPrice) => ({ currentPrice });
const flush = () => new Promise((r) => setImmediate(r));

// ---------------------------------------------------------------------------
// 1-2. RT-X5, the minimal case: two cues (the BR-36 endgame guarantees a
// pair), the NEWER response lands first and the older one lands second. The
// stale read must be dropped, not published.
// ---------------------------------------------------------------------------
console.log("\n-- RT-X5: an out-of-order pair converges on the newer read --");
{
  const m = makeModel();
  const live = m.open("a1");
  const older = deferred();
  const newer = deferred();
  live.cue(() => older.promise);
  live.cue(() => newer.promise);
  newer.resolve(snap("150.00"));
  await flush();
  older.resolve(snap("100.00")); // the stale response, landing last
  await flush();
  chk("the late stale response publishes nothing", m.published, ["150.00"]);
  chk("the screen holds the newer price", live.view().snapshot.currentPrice, "150.00");
}

// ---------------------------------------------------------------------------
// 3-4. Three reads all issued before any resolves, resolving in reverse. Only
// the last issued read may commit — convergence is unconditional, it does not
// depend on comparing values.
// ---------------------------------------------------------------------------
{
  const m = makeModel();
  const live = m.open("a2");
  const d = [deferred(), deferred(), deferred()];
  const price = ["100.00", "150.00", "200.00"];
  for (const one of d) live.cue(() => one.promise);
  for (let i = d.length - 1; i >= 0; i -= 1) {
    d[i].resolve(snap(price[i]));
    await flush();
  }
  chk("three racing reads publish exactly once", m.published.length, 1);
  chk("and it is the LAST issued read's value", m.published[0], "200.00");
}

// ---------------------------------------------------------------------------
// 5-7. The real endgame shape: a bid lands and paints, then two cues arrive
// close together and their responses cross. This is the scenario that would
// paint 200.00 and then repaint 150.00 — the visible downward step RT-X5
// forbids. Check 7 guards the comparator itself: a property checker that
// cannot report false proves nothing.
// ---------------------------------------------------------------------------
{
  const m = makeModel();
  const live = m.open("a3");
  const first = deferred();
  live.cue(() => first.promise);
  first.resolve(snap("100.00"));
  await flush();

  const b = deferred();
  const c = deferred();
  live.cue(() => b.promise);
  live.cue(() => c.promise);
  c.resolve(snap("200.00"));
  await flush();
  b.resolve(snap("150.00")); // B's response, late
  await flush();

  chk("the crossed endgame publishes 100.00 then 200.00", m.published, ["100.00", "200.00"]);
  chk("RT-X5: the published sequence never steps down", neverDescends(m.published), true);
  chk("the descent checker can report false", neverDescends(["100.00", "200.00", "150.00"]), false);
}

// ---------------------------------------------------------------------------
// 8-9. RT-X4: the SAME bid delivered twice. Two cues, two reads, one identical
// snapshot. "No visible effect" in data terms is two things — the value never
// changes, and the duplicate does not cost a second render.
// ---------------------------------------------------------------------------
console.log("\n-- RT-X4: a duplicate delivery has no visible effect --");
{
  const m = makeModel();
  const live = m.open("a4");
  const one = deferred();
  const two = deferred();
  live.cue(() => one.promise);
  live.cue(() => two.promise);
  one.resolve(snap("150.00"));
  await flush();
  two.resolve(snap("150.00")); // the duplicate: byte-identical state
  await flush();
  chk("a duplicated cue publishes once, not twice", m.published, ["150.00"]);
  chk("and notifies listeners once — no second render", m.notified(), 1);
}

// ---------------------------------------------------------------------------
// 10-11. The other two lines of the same guard, asserted so a later edit
// cannot quietly drop one of them.
// ---------------------------------------------------------------------------
{
  const m = makeModel();
  const live = m.open("a5");
  const ok = deferred();
  live.cue(() => ok.promise);
  ok.resolve(snap("100.00"));
  await flush();
  const bad = deferred();
  live.cue(() => bad.promise);
  bad.resolve(null); // a failed read
  await flush();
  chk("a failed read keeps the previous snapshot", live.view().snapshot.currentPrice, "100.00");
}
{
  const m = makeModel();
  const live = m.open("a6");
  const inflight = deferred();
  live.cue(() => inflight.promise);
  live.release(); // last viewer leaves while the read is in flight
  inflight.resolve(snap("100.00"));
  await flush();
  chk("a read that lands after teardown publishes nothing", m.published, []);
}

// ---------------------------------------------------------------------------
// 12-16. THE SOURCE AUDIT. The model above is only worth something if the
// product still implements the rule it models.
// ---------------------------------------------------------------------------
console.log(`\n-- ${SOURCE} still carries the rule --`);

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    console.log(`!! cannot read ${path} — the file moved, which is itself the failure`);
    process.exit(1);
  }
}

/** The doc comment above `seq` discusses every rule below by name. Strip it. */
function code(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function auditSource(text) {
  const src = code(text);
  return {
    issuesSeq: /const\s+seq\s*=\s*\+\+\s*store\.seq\s*;/.test(src),
    dropsStale: /if\s*\(\s*seq\s*!==\s*store\.seq\s*\)\s*return\s*;/.test(src),
    keepsPrevious: /if\s*\(\s*!\s*snapshot\s*\)\s*return\s*;/.test(src),
    dropsTornDown: /if\s*\(\s*stores\.get\(\s*auctionId\s*\)\s*!==\s*store\s*\)\s*return\s*;/.test(src),
    sortsHistoryBySeq: /\.sort\(\s*\(\s*a\s*,\s*b\s*\)\s*=>\s*b\.seq\s*-\s*a\.seq\s*\)/.test(src),
  };
}

const sourceText = read(SOURCE);
const source = auditSource(sourceText);
chk("every read takes a sequence number", source.issuesSeq, true);
chk("only the latest issued read may commit", source.dropsStale, true);
chk("a null read keeps the previous snapshot", source.keepsPrevious, true);
chk("a torn-down store never publishes", source.dropsTornDown, true);
chk("history is ordered by seq descending, never created_at", source.sortsHistoryBySeq, true);

// ---------------------------------------------------------------------------
// 17-20. THE CONTROLS. Delete the guard — from the source for 17-18, from the
// model for 19-20 — and require each assertion above to notice.
// ---------------------------------------------------------------------------
console.log("\n-- controls: remove the guard, require the failure --");
const regressed = sourceText.replace(/\n\s*if \(seq !== store\.seq\) return;.*(?=\n)/, "");
chk("the mutation actually removed the guard line", regressed !== sourceText, true);
chk("source without the guard FAILS the audit", auditSource(regressed).dropsStale, false);

{
  const m = makeModel({ guard: false });
  const live = m.open("c1");
  const first = deferred();
  live.cue(() => first.promise);
  first.resolve(snap("100.00"));
  await flush();
  const b = deferred();
  const c = deferred();
  live.cue(() => b.promise);
  live.cue(() => c.promise);
  c.resolve(snap("200.00"));
  await flush();
  b.resolve(snap("150.00"));
  await flush();
  chk("without the guard the price DOES step down (RT-X5 control)", neverDescends(m.published), false);
}
{
  const m = makeModel({ guard: false });
  const live = m.open("c2");
  const one = deferred();
  const two = deferred();
  live.cue(() => one.promise);
  live.cue(() => two.promise);
  one.resolve(snap("150.00"));
  await flush();
  two.resolve(snap("150.00"));
  await flush();
  chk("without the guard a duplicate re-renders (RT-X4 control)", m.notified(), 2);
}

// ---------------------------------------------------------------------------
// A run that exits 0 having asserted nothing is the failure this project keeps
// meeting — every harness here carries this guard.
// ---------------------------------------------------------------------------
console.log("");
const reached = pass + fail;
if (reached !== EXPECTED) {
  fail += 1;
  console.log(`FAIL  only ${reached} of ${EXPECTED} checks ran — the harness stopped early`);
}
console.log(`\n${fail === 0 ? "BID-10 convergence: PASS" : `BID-10 convergence: FAIL — ${fail} check(s)`}  (${pass}/${reached})`);
process.exit(fail === 0 ? 0 : 1);
