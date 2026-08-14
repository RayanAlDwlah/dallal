# Realtime tests — `BID-11`

```bash
node --experimental-strip-types --no-warnings tests/realtime/reconnect.check.mjs
```

Needs `.env.local` (the two `NEXT_PUBLIC_` variables) and about 35 seconds, most
of it spent deliberately waiting for a timeout that is the thing under test.
**Writes nothing** — it joins a broadcast topic and reads one row.

## What it measures

`FR-RT-11` requires loss of the live connection to be surfaced **within 10
seconds**. The wiring for that already existed after `BID-08`: a channel error
becomes `"unavailable"`, and the bid panel says so. What did not exist was the
clock.

A websocket that dies without closing leaves `readyState === OPEN`. Nothing
errors, nothing closes, nothing arrives. Only the heartbeat notices, and in the
installed `@supabase/phoenix` it notices in **two** steps of
`heartbeatIntervalMs` — one until the next heartbeat is sent, one more for its
reply deadline. At the library's default 25 s that is a **50-second** worst case
against a 10-second Must.

So the harness kills the link the way a network does — it replaces the socket's
`send` with a no-op, leaving the socket OPEN — and measures:

| # | Check |
|---|---|
| 1–3 | the arithmetic: `2 × heartbeat ≤ 10 s`, connect deadline `< 10 s` |
| 4–5 | **the control**: at the library default, loss is **not** surfaced in 10 s |
| 6–7 | at the shipped interval it is — measured at **7,079 ms**, as `CHANNEL_ERROR` |
| 8 | `RT-R7`: the data path answers while the websocket is down |
| 9 | `FR-RT-12` / `RT-R3` / `SC-24`: the rejoin **re-fires the join cue** (1 → 2) |

Check 5 is the point of the file. Without it, 7 would pass for reasons that have
nothing to do with our constant and the change would be decorative. It is the
same discipline as `#130`: falsify the assertion before trusting it.

It imports `lib/realtime/connection-timing.ts` itself — the real file, not a
copy of its numbers — so raising the heartbeat back up fails check 2 here.

## What it does not cover, said plainly

- **It does not execute `lib/realtime/auction-channel.ts`.** That module reaches
  `@supabase/ssr`'s browser client, which wants `document`. The harness mirrors
  its `subscribe` shape and asserts the two library facts the module depends on
  (a heartbeat timeout reaches a channel as `CHANNEL_ERROR`; a rejoin re-fires
  `SUBSCRIBED`) rather than assuming them.
- **`CONNECT_DEADLINE_MS` is reasoned, not measured.** The case it covers — a
  join that never answers, so there is no socket for a heartbeat to die on —
  needs a blocked websocket in a real browser, which nothing here can produce.
  The timer itself is eight lines in `auction-channel.ts`; the claim that it
  fires is the untested part, and it is untested.
- Nothing here proves what a *viewer* sees. That sentence is Mohammed's
  (`CLAUDE.md` §1) and it already exists in the bid panel.
