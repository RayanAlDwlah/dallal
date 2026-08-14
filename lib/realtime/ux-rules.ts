import type { AuctionChannelStatus } from "@/lib/realtime/auction-channel";

/**
 * BID-10 (#71) — the realtime UX rules as ONE set, derived rather than scattered.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RAYAN'S FILE — `@RayanAlDwlah`. Behaviour only. Every function here returns
 * a decision, never a class name, a colour, a string or a node: what the
 * viewer is TOLD and how it looks is Mohammed's half (CLAUDE.md §1,
 * ARCHITECTURE §14.6). If you find yourself adding a `className` to this file,
 * the rule you are writing belongs in his.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ## Why this file exists at all
 *
 * BID-08 built the channel, BID-09 the authoritative re-read, BID-11 the
 * ten-second loss deadline. Each is correct in isolation and each carries its
 * own slice of the realtime rules in its own prose. What was missing — the
 * actual content of #71 — is the SET: the rules stated together, each one
 * traced to the requirement that decided it, so that a session touching one of
 * them can see the other five it is about to contradict.
 *
 * The rules below are not new product decisions. Every one cites the
 * requirement it comes from; where the specification is silent the gap is
 * recorded as a question for the team and NOT filled here (CLAUDE.md §8,
 * TEAM.md rule 16). Two such questions are named at the bottom of this file.
 *
 * ## The six situations, and the rule for each
 *
 * | Situation | Rule | Requirement |
 * |---|---|---|
 * | Connection lost | Say so calmly within 10 s; loaded data stays readable; the bid control is MARKED stale, never disabled | FR-RT-11, FR-RT-13, RT-R2, RT-R4 |
 * | Reconnect | Re-read authoritative price/history/status; never resume from the last seen event | FR-RT-12, RT-R3 |
 * | Stale snapshot | Readable and clearly marked; bidding still permitted, because the server is the validator | RT-R4, RT-R7, FR-RT-14 |
 * | Submit in flight while the connection drops | The verdict is UNKNOWN, never a false failure; the user is pointed at the authoritative state | EC-03, FR-BID-16 |
 * | Outbid arriving while typing | Signal it; never write to the input, move focus, or scroll | FR-RT-06, FR-RT-07, RT-X2, RT-X3, SC-22 |
 * | Auction ends while connected | Status changes, control leaves, outcome appears, in one paint | FR-RT-08, RT-X7, SC-23 |
 *
 * The three ordering/idempotence rules (RT-X4, RT-X5, RT-R5) are not in this
 * table because they are settled STRUCTURALLY upstream and no UI decision can
 * reopen them: the broadcast payload is empty so there is no order to get
 * wrong, the store's `seq` guard drops a superseded read, and history sorts on
 * a monotonic per-auction rank. See auction-channel.ts and live-snapshot.ts.
 * A rule enforced by construction is stronger than one enforced by a function,
 * and duplicating them here as checks would weaken them into opinions.
 */

/**
 * Is the viewer's copy possibly behind the database?
 *
 * `"connecting"` counts, and that is the whole reason this is a function
 * rather than `=== "unavailable"` written at each call site. Before the first
 * join lands, no cue can arrive; a bid committed in that window is not on
 * screen and nothing has said so. BID-11 bounds the window
 * (`CONNECT_DEADLINE_MS` turns a hung join into `"unavailable"` at 8 s), which
 * makes `"connecting"` short — never zero.
 *
 * The honest reading of the three states is binary: `"live"` means cues are
 * arriving, everything else means they are not. FR-RT-11's requirement is that
 * staleness is never silent, and `"connecting"` is silent staleness for up to
 * eight seconds if it is treated as healthy.
 */
export function isPossiblyStale(connection: AuctionChannelStatus): boolean {
  return connection !== "live";
}

/**
 * Whether the viewer should be told, in words, that live updating is not
 * working right now.
 *
 * Deliberately NARROWER than {@link isPossiblyStale}: only `"unavailable"`
 * earns a sentence. `"connecting"` is stale but not yet news — announcing a
 * connection that is one second old would be the alarming treatment RT-R2
 * explicitly rules out ("clearly and calmly"), and it would fire on every
 * single page load. BID-11's deadline is what guarantees the difference is
 * bounded: a join that never answers becomes `"unavailable"` and does get the
 * sentence, inside FR-RT-11's ten seconds.
 *
 * So the two functions are not redundant. One governs how much the interface
 * TRUSTS its own copy (stale from the first paint), the other governs when it
 * SPEAKS (only once staleness is established). Collapsing them into one is the
 * likely future "simplification" and it breaks one requirement whichever way
 * it collapses.
 */
export function shouldAnnounceConnectionLoss(connection: AuctionChannelStatus): boolean {
  return connection === "unavailable";
}

/**
 * RT-X3 / FR-RT-07 — has the live price overtaken what the user has typed?
 *
 * The caller passes the already-computed comparison rather than the amounts,
 * because comparing two amounts is `lib/money`'s job and there must be exactly
 * one implementation of it (CLAUDE.md §4 rule 6; arithmetic on amounts in JS
 * is forbidden outright by rule 1). This function only decides whether the
 * situation warrants telling the user, which is the part that is a rule.
 *
 * Requires a parsed amount: an empty or malformed field is not "insufficient",
 * it is unanswered, and saying "your amount is too low" about an empty box is
 * a false statement about a bid nobody made.
 */
export function isTypedAmountSuperseded(args: {
  /** Whether the field currently holds a well-formed amount. */
  hasTypedAmount: boolean;
  /** Whether that amount fails the current minimum, per lib/money. */
  belowMinimum: boolean;
}): boolean {
  return args.hasTypedAmount && args.belowMinimum;
}

/**
 * ## Three rules that are deliberately NOT functions here
 *
 * The first draft of this file exported one for each. All three were deleted
 * before it shipped, because each was dead on arrival — cited in
 * `bid-panel.tsx`'s comments, called from nowhere — and a name that appears in
 * a comment reads exactly like a constraint while enforcing nothing. That is
 * worse than the prose it replaced: prose does not claim to be executable.
 *
 * It is also the header's own argument (see the note under the table): **a
 * rule enforced by construction is stronger than one enforced by a function,
 * and duplicating one here as a check weakens it into an opinion.** The three
 * below are already enforced by construction.
 *
 * 1. **Bidding stays available while stale** (RT-R7, FR-RT-14, RT-R1;
 *    FR-RT-13 and RT-R4 allow "disabled **or** clearly marked", and this
 *    codebase takes the second branch). A `canSubmitWhileStale(): true` cannot
 *    enforce this, because the rule is the ABSENCE of a branch: what makes it
 *    hold is that `disabled` in `bid-panel.tsx` does not mention the
 *    connection, and no function call can make a line that is not there stay
 *    not there. The choice is load-bearing rather than stylistic — disabling
 *    would let a transport fault remove a user's ability to bid in the last
 *    seconds of an auction they are winning, which is realtime deciding a
 *    bidding outcome, the exact thing RT-R1 forbids. The marking is
 *    {@link isPossiblyStale}; the wording and the look are Mohammed's.
 *
 * 2. **A live update never touches the typed amount** (SC-22, FR-RT-06,
 *    RT-X2, RT-X3 — "the user always decides what to bid"). Same shape: the
 *    guarantee is that no snapshot handler writes to the input. It is enforced
 *    by the input being uncontrolled by the snapshot, not by a
 *    `typedAmountEffect()` returning a single-inhabitant string that nobody
 *    calls. The price moving above what the user typed changes what they are
 *    TOLD ({@link isTypedAmountSuperseded}), never what the field contains.
 *
 * 3. **EC-03 — a submission whose verdict never arrived is UNKNOWN, never a
 *    failure.** Enforced by the outcome union having a `no_verdict` variant at
 *    all: `bid-panel.tsx` must handle it to type-check, and TypeScript narrows
 *    on `outcome.kind === "no_verdict"` directly. A `verdictIsUnknown(kind)`
 *    helper returning `boolean` would actively make this WORSE — narrowing
 *    does not survive a boolean-returning call, so the `switch` on
 *    `outcome.reason` beneath it would stop type-checking.
 *
 *    Why the rule matters, since only the prose now carries it: EC-03's two
 *    sub-cases produce an identical client observation — no response — with
 *    opposite truths: (a) nothing committed, (b) the bid committed and the
 *    response was lost. The client cannot tell them apart, so it must claim
 *    neither. "Failed" is false in case (b), and that is the one that costs
 *    the user money: they re-bid against a price their own accepted bid
 *    already set. The resolution is not a retry and not a guess — it is the
 *    authoritative state the page is already re-reading (RT-R6, FR-RT-12).
 */

/**
 * ## Open questions — NOT decided here (CLAUDE.md §8, TEAM.md rule 16)
 *
 * Both surfaced while enumerating the set. Neither has a requirement behind
 * it, so neither is implemented; the current behaviour is named so that the
 * team is choosing between stated options rather than discovering one later.
 *
 * 1. **Does a rejection message clear when the price moves?** Raised by
 *    @Dem4t in review of #114 and still unanswered. A rejection names the
 *    price at the moment of rejection; the live region beside it keeps moving,
 *    so the message ages. Option (1) clear it on the next snapshot; option (2)
 *    keep it in the past tense, which is what ships today. FR-RT-06 ("must
 *    never disrupt what the user is doing") leans against yanking a sentence
 *    out from under someone mid-read, which is why (2) was not changed here —
 *    but a lean is not a decision and the PRD is silent.
 *
 * 2. **Should the connection sentence disappear the instant the channel
 *    recovers?** RT-R2 requires loss to be surfaced; nothing states how
 *    recovery is surfaced, or whether a flapping connection should be damped
 *    so the sentence does not blink on and off. Today it follows the status
 *    exactly, with no hysteresis. A minimum display duration would be a
 *    product decision about tone and is not one to take in code.
 *
 * A third item is a coordination question rather than an open one: the
 * non-colour channel for RT-X3's "no longer sufficient" signal, and layout
 * shift when history grows, are pure presentation and belong to @m7ya505.
 *
 * ## Scope note — SC-22 has THREE clauses and only one is a decision
 *
 * `GITHUB_PLAN.md` §430 assigns me "that an update never clears a typed
 * amount, **steals focus or scrolls** (SC-22)". The second and third are not
 * represented above, and their absence from the list is not an oversight —
 * it is the same shape as the three rules that are not functions.
 *
 * Neither is a decision anything can compute. They hold because
 * `bid-panel.tsx` contains no `focus()`, no `scrollIntoView`, no `autoFocus`,
 * no `useRef` and no `useEffect` — there is no code on the snapshot path that
 * could move focus or the viewport, so nothing has to decide not to. Verified
 * by reading the file, and that is the only verification available here.
 *
 * **Proving them needs a browser with a partially typed field while a bid
 * lands, which is INT-02 (#84), not this module.** Recorded so that BID-10 is
 * not read as having covered all of SC-22: one third of it is asserted in
 * `tests/realtime/ux-rules.check.mjs`, and the other two thirds are an
 * argument from absence awaiting an integration test.
 */
