/**
 * BID-11 — the numbers behind "surfaced within 10 seconds".
 *
 * `FR-RT-11` and `RT-R2` require loss of the live connection to be surfaced
 * **calmly within 10 seconds**. That is a product decision, already recorded;
 * nothing here invents one. What is here is the arithmetic that makes the code
 * actually meet it, in one file, because it is spread across two otherwise
 * unrelated modules — the Supabase client factory and the channel — and a
 * future session editing one of them would have no way to see the other.
 *
 * ## Why the default configuration does not meet FR-RT-11
 *
 * A websocket that dies without closing — Wi-Fi gone, laptop asleep, a captive
 * portal, a proxy that stops forwarding — leaves `readyState === OPEN` on the
 * client. Nothing is delivered and nothing errors. The only thing that notices
 * is the heartbeat, and in the installed `@supabase/phoenix` the heartbeat
 * notices in two steps of `heartbeatIntervalMs` each (`phoenix.js`,
 * `sendHeartbeat` / `heartbeatTimeout`):
 *
 *   1. up to one interval passes before the next heartbeat is even sent;
 *   2. that heartbeat's reply deadline is another whole interval —
 *      `heartbeatTimeoutTimer = setTimeout(heartbeatTimeout, heartbeatIntervalMs)`.
 *
 * Only then does `heartbeatTimeout()` run `triggerChanError`, which is what
 * reaches our `subscribe` callback as `CHANNEL_ERROR` and becomes
 * `"unavailable"`. So **worst case detection is two intervals**, and the
 * library's default interval is 25 s — a 50-second worst case against a
 * 10-second requirement. The wiring was already correct; only the clock was.
 *
 * Measured both ways in `tests/realtime/reconnect.check.mjs`, which fails the
 * default and passes this one, so the constant below is load-bearing rather
 * than decorative.
 *
 * ## What it costs
 *
 * One ~40-byte frame per viewer every {@link REALTIME_HEARTBEAT_MS} ms instead
 * of every 25 s. At `NFR-RT-02`'s twenty concurrent viewers that is ~5 frames a
 * second across the whole platform. Disclosed rather than buried: it is a real
 * increase, it is small, and the requirement it buys is a Must.
 */

/** `FR-RT-11` / `RT-R2`. The requirement itself, not a tuning knob. */
export const LOSS_SURFACED_WITHIN_MS = 10_000;

/**
 * Passed to `createBrowserClient` as `realtime.heartbeatIntervalMs`.
 *
 * Chosen so that {@link WORST_CASE_LOSS_DETECTION_MS} lands comfortably inside
 * {@link LOSS_SURFACED_WITHIN_MS} rather than exactly on it — the remaining 2 s
 * is for the React render that turns the state into a sentence on screen.
 * Raising this above 5 s breaks `FR-RT-11`; the harness asserts that.
 */
export const REALTIME_HEARTBEAT_MS = 4_000;

/** Two intervals — see the derivation above. Not an estimate; a bound. */
export const WORST_CASE_LOSS_DETECTION_MS = 2 * REALTIME_HEARTBEAT_MS;

/**
 * How long a watch may sit on `"connecting"` before it is called what it is.
 *
 * A connection that never establishes — a websocket blocked by a corporate
 * proxy, a browser extension, an offline first paint — is loss too, and it is
 * the one shape the heartbeat cannot detect, because there is no socket to send
 * a heartbeat on. Without this the viewer sits on `"connecting"` forever and is
 * told nothing at all, which is precisely what `FR-RT-11` forbids.
 *
 * Deliberately shorter than the library's own 10 s join timeout
 * (`DEFAULT_TIMEOUT` in `@supabase/realtime-js`), which would land exactly on
 * the requirement's boundary with no room for the render.
 */
export const CONNECT_DEADLINE_MS = 8_000;
