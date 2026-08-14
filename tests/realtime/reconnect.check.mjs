// ============================================================================
// BID-11 — connection loss is surfaced within 10 seconds, and reconnecting
// resynchronizes. Measured against a real Supabase project.
//
// Run:  node --experimental-strip-types --no-warnings tests/realtime/reconnect.check.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from
// .env.local. Nothing else. It WRITES NOTHING: it joins a broadcast topic and
// reads one row. Takes about 35 seconds, most of it spent deliberately waiting.
//
// ---------------------------------------------------------------------------
// WHY A SIMULATED LINK DEATH AND NOT A CLOSED SOCKET
//
// `FR-RT-11` is about the case that does not announce itself. A socket that is
// CLOSED already surfaces instantly — `onConnClose` calls `triggerChanError`
// and our subscribe callback hears about it in the same tick. The failure worth
// testing is the one where the link dies with the socket still `OPEN`: Wi-Fi
// gone, laptop lid closed, a proxy that stops forwarding. Nothing errors,
// nothing closes, and no data arrives. The only thing that can notice is the
// heartbeat.
//
// So the harness kills the link the way the network does: it replaces the
// websocket's `send` with a no-op. Frames stop leaving, the socket stays OPEN,
// and the client is in exactly the state a viewer on dead Wi-Fi is in. Nothing
// is stubbed out on our side — the library detects this or it does not.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES NOT EXECUTE, SAID PLAINLY
//
// It does not import `lib/realtime/auction-channel.ts`. That module is browser
// code: it reaches `@supabase/ssr`'s browser client, which wants `document`.
// What it DOES import is `lib/realtime/connection-timing.ts` — the real file,
// not a copy of its numbers — so an edit that raises the heartbeat fails check
// 2 here rather than passing quietly.
//
// The two library facts the channel module depends on are asserted below rather
// than assumed, because they are the whole mechanism:
//
//   * a heartbeat timeout reaches a CHANNEL as `CHANNEL_ERROR`
//     (`heartbeatTimeout()` -> `triggerChanError` in @supabase/phoenix), which
//     is what our `subscribe` callback turns into `"unavailable"`;
//   * a rejoin re-fires `SUBSCRIBED`, which is what makes the re-read on join
//     a resynchronization (FR-RT-12, RT-R3, SC-24) rather than a one-off at
//     mount.
//
// The subscribe shape below is a copy of the module's, deliberately minimal.
// If it ever drifts from the real one, check 9 is the one that stops meaning
// anything — so it asserts the cue count, not merely the state.
// ============================================================================
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import {
  CONNECT_DEADLINE_MS,
  LOSS_SURFACED_WITHIN_MS,
  REALTIME_HEARTBEAT_MS,
  WORST_CASE_LOSS_DETECTION_MS,
} from "../../lib/realtime/connection-timing.ts";

/** The library's own default, quoted from CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL. */
const LIBRARY_DEFAULT_HEARTBEAT_MS = 25_000;

/** Must match the trigger and lib/realtime/auction-channel.ts, byte for byte. */
const CHANGE_EVENT = "auction_changed";

/**
 * Any auction id joins: the RLS policy on realtime.messages authorizes by topic
 * PREFIX (`topic() like 'auction:%'`), not by row. Using a fixed id that belongs
 * to nothing keeps the run from depending on the state of either database.
 */
const TOPIC = "auction:00000000-0000-0000-0000-0000000000bb";

const EXPECTED = 9;
let pass = 0;
let fail = 0;

function chk(label, got, want) {
  if (got === want) {
    pass += 1;
    console.log(`PASS  ${label.padEnd(60)}  (${got})`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label.padEnd(60)}  got=${got}  want=${want}`);
  }
}

/* Same hand-rolled .env.local read as tests/auth — no dotenv for four lines. */
function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* absent is normal; the check below reports what is missing */
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("!! NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set.");
  console.log("   They live in .env.local — see docs/supabase-cli.md.");
  process.exit(1);
}

console.log(`project: ${url}`);
console.log(
  `heartbeat: ${REALTIME_HEARTBEAT_MS} ms shipped vs ${LIBRARY_DEFAULT_HEARTBEAT_MS} ms default\n`,
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Join the topic and record every status the channel reports, with the instant
 * it arrived. `cues` counts successful joins — the re-read signal.
 */
async function watch(heartbeatIntervalMs) {
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { heartbeatIntervalMs },
  });
  const events = [];
  const state = { cues: 0 };
  await supabase.realtime.setAuth();
  supabase
    .channel(TOPIC, { config: { private: true } })
    .on("broadcast", { event: CHANGE_EVENT }, () => {})
    .subscribe((status) => {
      const live = status === "SUBSCRIBED";
      events.push({ at: Date.now(), status, surfaced: live ? "live" : "unavailable" });
      if (live) state.cues += 1;
    });
  return { supabase, events, state };
}

/**
 * Cut the link without closing the socket. Returns false if the library's
 * internals moved, which must FAIL loudly rather than silently measure nothing.
 */
function killLink(supabase) {
  const conn = supabase.realtime?.socketAdapter?.socket?.conn;
  if (!conn || typeof conn.send !== "function") return false;
  conn.send = () => {};
  return true;
}

const waitUntil = async (predicate, budgetMs, stepMs = 50) => {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(stepMs);
  }
  return predicate();
};

const surfacedAfter = (events, since) =>
  events.find((e) => e.at >= since && e.surfaced === "unavailable");

// --------------------------------------------------------------------------
// 1-3. The arithmetic. Cheap, and it is what a future edit will break first.
// --------------------------------------------------------------------------
chk("worst case is two heartbeat intervals", WORST_CASE_LOSS_DETECTION_MS, 2 * REALTIME_HEARTBEAT_MS);
chk(
  `worst case ${WORST_CASE_LOSS_DETECTION_MS}ms fits FR-RT-11's ${LOSS_SURFACED_WITHIN_MS}ms`,
  WORST_CASE_LOSS_DETECTION_MS <= LOSS_SURFACED_WITHIN_MS,
  true,
);
chk(
  `connect deadline ${CONNECT_DEADLINE_MS}ms fits it too`,
  CONNECT_DEADLINE_MS < LOSS_SURFACED_WITHIN_MS,
  true,
);

// --------------------------------------------------------------------------
// 4-5. THE CONTROL. The library's default configuration must FAIL the
// requirement — otherwise checks 6-7 pass for a reason that has nothing to do
// with our constant, and the change is decorative.
// --------------------------------------------------------------------------
console.log(`\n-- control: library default ${LIBRARY_DEFAULT_HEARTBEAT_MS} ms --`);
const control = await watch(LIBRARY_DEFAULT_HEARTBEAT_MS);
const controlJoined = await waitUntil(() => control.state.cues > 0, 15_000);
chk("control joined the topic", controlJoined, true);

const controlKilledAt = Date.now();
const controlGrip = killLink(control.supabase);
if (!controlGrip) console.log("!! could not reach the socket — the library's shape moved");
await waitUntil(() => surfacedAfter(control.events, controlKilledAt), LOSS_SURFACED_WITHIN_MS);
chk(
  `default heartbeat does NOT surface loss within ${LOSS_SURFACED_WITHIN_MS}ms`,
  controlGrip && surfacedAfter(control.events, controlKilledAt) === undefined,
  true,
);
void control.supabase.realtime.disconnect();

// --------------------------------------------------------------------------
// 6-9. The shipped configuration, on the same simulated failure.
// --------------------------------------------------------------------------
console.log(`\n-- shipped: ${REALTIME_HEARTBEAT_MS} ms --`);
const live = await watch(REALTIME_HEARTBEAT_MS);
const joined = await waitUntil(() => live.state.cues > 0, 15_000);
chk("joined the topic", joined, true);

const cuesBeforeLoss = live.state.cues;
const killedAt = Date.now();
const grip = killLink(live.supabase);
if (!grip) console.log("!! could not reach the socket — the library's shape moved");

await waitUntil(() => surfacedAfter(live.events, killedAt), LOSS_SURFACED_WITHIN_MS);
const loss = surfacedAfter(live.events, killedAt);
const elapsed = loss ? loss.at - killedAt : Infinity;
chk(
  `loss surfaced within ${LOSS_SURFACED_WITHIN_MS}ms (FR-RT-11, RT-R2)`,
  grip && elapsed <= LOSS_SURFACED_WITHIN_MS,
  true,
);
console.log(`      surfaced after ${elapsed} ms, as ${loss?.status ?? "nothing"}`);

// RT-R7: the two paths are independent. The websocket is down; the data path
// that carries a bid is not, and asking it is the only way to know.
const { error: readError } = await live.supabase.from("auctions").select("id").limit(1);
chk("the data path still answers while realtime is down (RT-R7)", readError === null, true);

// FR-RT-12 / RT-R3 / SC-24: a rejoin must re-fire SUBSCRIBED, because that is
// the cue the channel module turns into a re-read of authoritative state. A
// reconnect that only restores the word "live" leaves the viewer on a stale
// price wearing a fresh badge.
const resynced = await waitUntil(() => live.state.cues > cuesBeforeLoss, 20_000);
chk("reconnect re-fires the join cue — a resync, not just a badge", resynced, true);
console.log(`      join cues: ${cuesBeforeLoss} before the drop, ${live.state.cues} after`);

void live.supabase.realtime.disconnect();

// A suite that exits 0 having asserted nothing is the failure this project
// keeps meeting — every other harness here carries the same guard.
console.log("");
const reached = pass + fail;
if (reached !== EXPECTED) {
  fail += 1;
  console.log(`FAIL  only ${reached} of ${EXPECTED} checks ran — the harness stopped early`);
}
console.log(`\n${fail === 0 ? "BID-11: PASS" : `BID-11: FAIL — ${fail} check(s)`}  (${pass}/${reached})`);
process.exit(fail === 0 ? 0 : 1);
