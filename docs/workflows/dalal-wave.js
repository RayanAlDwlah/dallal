export const meta = {
  name: 'dalal-wave',
  description: 'Run a wave of owned Dalal issues: build in parallel, refute each adversarially, audit, criticise for completeness',
  whenToUse:
    'When you have a batch of issues you own and want them built AND independently disproved before you touch git. Call with no args to let it discover your open issues; or pass {issues:[82,28,71], audits:[85,91]}; or a bare array of issue numbers. Never merges, commits, or closes anything — every git and GitHub write stays with the human.',
  phases: [
    { title: 'Scout', detail: 'find and classify the open issues this wave can actually finish' },
    { title: 'Build', detail: 'one agent per issue, in parallel' },
    { title: 'Refute', detail: 'an independent skeptic behind each, defaulting to refuted' },
    { title: 'Audit', detail: 'the wide checks, run against the state the wave produced' },
    { title: 'Critic', detail: 'what did we bound, sample, or skip without saying so' },
  ],
}

// ---------------------------------------------------------------------------
// The preamble. This is the part worth keeping: every rule that has actually
// been violated on this repository, plus every environment fact that has cost
// a session an hour. Edit it when a NEW failure mode is found, not otherwise.
// ---------------------------------------------------------------------------

const REPO = '/Users/ry7vv/Documents/Coding_Project/dllal'

const COMMON = `You are working in the repository at ${REPO} (git repo, GitHub RayanAlDwlah/dallal).
You act on behalf of Rayan (@RayanAlDwlah), owner of BIDDING and REALTIME BEHAVIOUR and owner of the project.

BEFORE ANYTHING: read ${REPO}/CLAUDE.md in full. It is binding and overrides your defaults. The parts that actually get violated:
- §4 MONEY: no floating point on an amount, ever. No Number()/parseFloat/arithmetic on amounts. No numeric(P,2) typmod - "tightening" numeric is a VIOLATION, not hygiene. No ceiling of any kind, including a length cap on the amount input and a to_char format picture. Every money column is the sar_amount domain. Never remove VALUE < 'Infinity' from the domain. More than two decimals is REJECTED, never rounded. ONE formatter, canonical "1,250.00 SAR". Every direct read of a sar_amount column casts ::text per column, every time - PostgREST serialises bare numeric as a JSON number and JSON.parse corrupts it before any of our code runs.
- §5 THREE CHECKS THAT MUST NOT EXIST: no bid increment or minimum raise, no maximum or reserve price, no leading-bidder rejection. Also absent by design: no auction cancel, no edit, no draft state - status has exactly two values. ANTI-SNIPING DOES EXIST since the BR-36 reversal of 2026-08-13: an ACCEPTED bid in the final 15 seconds extends end_time by exactly 30 seconds, repeating, hard cap 20, and THE CAP IS A CHECK CONSTRAINT, NOT AN IF. A rejected bid never extends. At the cap a late bid is still accepted. If a document says the end time is fixed, that document is STALE - say so, do not revert code to match it. Eligibility is decided by clock_timestamp() against end_time, NEVER by the stored status flag (LC-03). Bid history is ordered by bids.id, NEVER by created_at.
- §1 OWNERSHIP, by responsibility not by file: Mohammed (@m7ya505) owns ALL presentation - every screen, layout, component, visual state, and the copy. Abdulrahman (@Dem4t) owns auth and identity behaviour and data. Rayan owns bidding and realtime behaviour. Do NOT write code you do not own. You may implement behaviour inside a component someone else presents, but you may not redesign that presentation.
- §6 SECURITY: never commit a secret; the repo is PUBLIC. SUPABASE_SERVICE_ROLE_KEY never reaches the browser. Email is never visible to anyone but its owner - not in bid history, not in seller names, not in results, not in realtime payloads. Display name is the only public identity. Identity comes from the verified server session, never from a client-supplied user id, especially inside SECURITY DEFINER functions.
- §8 and TEAM.md rule 16: NEVER invent a product decision. If the PRD does not cover it, say so and leave the ambiguity VISIBLE. A confident session filling a gap with something reasonable - a reserve price, an increment, a numeric(12,2), an English string, a COALESCE that hides a null - is this project's characteristic failure. "The documents were ambiguous" is not a defence; the documents contradicting each other is a known condition. If two documents disagree, SURFACE IT, do not silently pick a side.
- §3 ARABIC RTL: lang="ar" dir="rtl" set once at the root. Logical CSS properties only - never physical left/right for layout that mirrors. Digits stay WESTERN (0-9). Numbers and prices wrapped in <bdi>, with the currency indicator OUTSIDE the isolate. One language, not two - no i18n scaffolding, no language switcher.

HARD RULES FOR THIS RUN, no exceptions:
1. DO NOT run git commit, git push, git merge, git checkout of another branch, gh pr create, gh pr merge, gh pr review, or gh issue close. The human does every git and GitHub write himself, at the end, after reading you. You may READ freely: git log, git show, git diff, gh issue view, gh pr view.
2. DO NOT write to the PRODUCTION Supabase project (yfszokbunbqesigdfuwk). Dev is cjrnakdigcwnsrvtyqhy and is where probing happens. Reads on prod are fine. Any destructive probe must be unable to commit in EITHER branch: put the DELETE inside a PL/pgSQL exception block AND raise unconditionally at the end, so a probe that finds a guard MISSING still destroys nothing.
3. Environment facts that will bite you: the shell is zsh, so \${PIPESTATUS[0]} reads empty and ':P' in a git ref is eaten as a parameter modifier (brace the ref). The command 'timeout' DOES NOT EXIST on this machine. Bash cwd persists between your tool calls. .env.local must be sourced with an absolute path. psql -f prefixes its errors, so grep '^ERROR:' is dead. information_schema.role_table_grants lies by omission - use has_table_privilege. The Docker test container is named dalal-bidding-tests and COLLIDES, so only one agent per wave may run it.
4. NEVER emit CJK, Japanese, or Korean characters in any file or report. This is a known recurring slip on this project.
5. Distinguish MEASURED from REASONED in every single claim. A claim you did not execute is REASONED and must say so. The unbacked "already verified" sentence is this repository's most common defect, ahead of bad code.
6. Falsify before you trust. Ship the control that must FAIL beside the assertion that must pass - an assertion that would hold even if the feature were absent proves nothing. Precedent: SC-17 was believed covered and asserted nowhere, passing for free because same-amount rounds leave a one-row history and one row is strictly increasing.
7. If you are blocked, say what blocked you. Do not substitute a plausible-looking result.

Useful, and dev-only - re-enable each immediately after use: alter table public.auctions disable trigger auctions_immutable_terms (to move end_time), auctions_no_delete, bids_insert_gate. Dev runs a pg_cron sweep every 15 seconds; select cron.alter_job(1, active := false); holds a closing window open and MUST be turned back on.
Vercel: production is dallal-rust.vercel.app - note that dallal.vercel.app is a STRANGER'S site that answers 200 in Arabic. A Vercel preview points at the DEV database, so a crafted dev row plus a fetch is a real end-to-end measurement.
`

// ---------------------------------------------------------------------------

const BUILD_SCHEMA = {
  type: 'object',
  required: ['issue', 'status', 'summary', 'claims', 'filesChanged', 'blockers', 'closingComment'],
  properties: {
    issue: { type: 'string' },
    status: { type: 'string', enum: ['done', 'partial', 'blocked'] },
    summary: { type: 'string', description: 'What you actually did, in English, 3-8 sentences.' },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'evidence', 'kind'],
        properties: {
          claim: { type: 'string' },
          evidence: { type: 'string', description: 'file:line, command output, or SQL result. Be specific.' },
          kind: { type: 'string', enum: ['measured', 'reasoned'] },
        },
      },
    },
    filesChanged: { type: 'array', items: { type: 'string' } },
    notCovered: { type: 'array', items: { type: 'string' }, description: 'Criteria you could NOT satisfy or verify, stated plainly.' },
    openQuestions: { type: 'array', items: { type: 'string' }, description: 'Places where the PRD is silent. NEVER answer these yourself - list them.' },
    blockers: { type: 'array', items: { type: 'string' } },
    closingComment: { type: 'string', description: 'DRAFT closing comment in ARABIC, criterion by criterion, measured vs reasoned. The human posts it. Empty string if the issue must not be closed.' },
  },
}

const REFUTE_SCHEMA = {
  type: 'object',
  required: ['issue', 'verdict', 'refuted', 'confirmed', 'missed'],
  properties: {
    issue: { type: 'string' },
    verdict: { type: 'string', enum: ['sound', 'needs-work', 'unsound'] },
    refuted: { type: 'array', items: { type: 'object', required: ['claim', 'why'], properties: { claim: { type: 'string' }, why: { type: 'string' } } } },
    confirmed: { type: 'array', items: { type: 'string' }, description: 'Claims you independently RE-MEASURED. Say how.' },
    missed: { type: 'array', items: { type: 'string' } },
    claudeMdViolations: { type: 'array', items: { type: 'string' }, description: 'Quote the offending line.' },
    inventedDecisions: { type: 'array', items: { type: 'string' }, description: 'Any rule, threshold, default or copy string with no PRD/BR/FR/SC/EC identifier behind it. Highest severity possible on this repo.' },
  },
}

// --- args: undefined | [82, 28] | {issues:[...], audits:[...], extra:'...'} ---

const raw = args
const asList = (v) => (Array.isArray(v) ? v.map((x) => String(x).replace('#', '')) : [])
let issues = Array.isArray(raw) ? asList(raw) : asList(raw?.issues)
let auditIssues = asList(raw?.audits)
const extra = (raw && !Array.isArray(raw) && raw.extra) || ''

phase('Scout')

if (issues.length === 0) {
  log('No issues passed. Scouting for open work that this wave can actually finish.')
  const scouted = await agent(
    `${COMMON}

You are the SCOUT. Nothing is built this phase. Decide what the wave should attempt.

1. Run: gh issue list --state open --limit 60 --json number,title,assignees,labels
2. Keep only issues assigned to RayanAlDwlah, or unassigned issues that are plainly bidding/realtime behaviour.
3. For each, run gh issue view <n> --comments and decide honestly:
   - buildable NOW by one agent with no teammate action, or
   - BLOCKED on @m7ya505 or @Dem4t doing something first.
   Being "mostly done" is not blocked. Needing another human's decision, code, signature, or review IS blocked. Say which human and what.
4. Classify each buildable issue as 'build' (it produces code or a run) or 'audit' (it is a wide check OF other issues, so it must run after them).
5. Write a one-paragraph brief per buildable issue: what specifically to do, which files to read first, and which acceptance criteria to extract. The builder agent will see ONLY your brief and the preamble, not this conversation.
6. Cap the wave at 6 build issues. If more qualify, drop the ones with the least evidence that they are finishable tonight and SAY which you dropped and why - a silent cap reads as full coverage.

Do not modify files. Do not use git or gh write commands.${extra ? `\n\nAdditional instruction from the human: ${extra}` : ''}`,
    {
      label: 'scout:open-issues',
      phase: 'Scout',
      schema: {
        type: 'object',
        required: ['build', 'audit', 'blocked', 'dropped'],
        properties: {
          build: { type: 'array', items: { type: 'object', required: ['issue', 'title', 'brief'], properties: { issue: { type: 'string' }, title: { type: 'string' }, brief: { type: 'string' } } } },
          audit: { type: 'array', items: { type: 'object', required: ['issue', 'title', 'brief'], properties: { issue: { type: 'string' }, title: { type: 'string' }, brief: { type: 'string' } } } },
          blocked: { type: 'array', items: { type: 'object', required: ['issue', 'whom', 'what'], properties: { issue: { type: 'string' }, whom: { type: 'string' }, what: { type: 'string' } } } },
          dropped: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  )
  if (!scouted) return { error: 'scout failed; nothing attempted' }
  issues = scouted.build.map((b) => ({ issue: b.issue, brief: `${b.title}\n\n${b.brief}` }))
  auditIssues = scouted.audit.map((b) => ({ issue: b.issue, brief: `${b.title}\n\n${b.brief}` }))
  log(`Scout: ${issues.length} buildable, ${auditIssues.length} audits, ${scouted.blocked.length} blocked on a teammate.`)
  if (scouted.dropped.length) log(`Dropped from this wave: ${scouted.dropped.join(' | ')}`)
  var blocked = scouted.blocked
} else {
  issues = issues.map((i) => (typeof i === 'string' ? { issue: i, brief: '' } : i))
  auditIssues = auditIssues.map((i) => (typeof i === 'string' ? { issue: i, brief: '' } : i))
  log(`${issues.length} issues passed in, ${auditIssues.length} audits.`)
  var blocked = []
}

// Only one agent per wave may run Docker.
const dockerOwner = issues.length ? issues[0].issue : null

phase('Build')

const built = await pipeline(
  issues,
  (t, _item, idx) =>
    agent(
      `${COMMON}

TRACK - GitHub issue #${t.issue}. Start by reading it: gh issue view ${t.issue} --comments. Extract EVERY acceptance criterion as a discrete checkable item before you do anything else.

${t.brief || 'No brief was supplied; derive the work from the issue itself and from PRD.md / ARCHITECTURE.md.'}

Rules specific to running alongside other agents right now:
- Other agents are working in this same repository on OTHER issues at this moment. Touch only the files your issue needs. Before writing a file, check git status; if a file you did not create is already modified, assume another track owns it and say so rather than editing it.
- ${dockerOwner === t.issue ? 'You are the ONLY agent permitted to run Docker this wave (tests/bidding/run.sh). Use it if your issue needs it.' : 'You may NOT run Docker this wave - the container name collides and a concurrent run corrupts both. Cite the test files by path and line instead of executing them, and mark such claims REASONED.'}
- If your work compiles, prove it: cd ${REPO} && npx tsc --noEmit. Paste the real output.
- Where the PRD is silent on a behaviour, put it in openQuestions. Do NOT answer it. That is the single rule most worth obeying here.${extra ? `\n\nAdditional instruction from the human: ${extra}` : ''}`,
      { label: `build:#${t.issue}`, phase: 'Build', schema: BUILD_SCHEMA },
    ),
  (result, t) => {
    if (!result) return null
    return agent(
      `${COMMON}

You are an ADVERSARIAL VERIFIER for GitHub issue #${t.issue}. Your job is to REFUTE, not to confirm. Default to refuted when uncertain. You are not here to be agreeable; a track that looks right and is wrong is exactly what this role exists to catch.

What the track reported, as JSON:

${JSON.stringify(result, null, 2)}

Do this:
1. Independently RE-MEASURE. Never take a file:line citation on trust - open the file and read the line; cited line numbers drift, and a correct-sounding citation pointing at the wrong line is the commonest way a false claim survives review.
2. Hunt the vacuous pass: an assertion that would hold even if the feature were absent, a test cited but never run, a control that cannot distinguish "blocked" from "my probe was malformed".
3. If code was written, read EVERY file in filesChanged against CLAUDE.md: §4 (any Number()/parseFloat on an amount, any sar_amount read without ::text, any numeric(P,2), any second formatter, any cap on the amount input), §5 (any increment, reserve, leading-bidder rejection; any status-gated eligibility instead of clock_timestamp(); any bid history ordered by created_at; any weakening of the extension CHECK), §1 (presentation that belongs to Mohammed, auth that belongs to Abdulrahman), §6 (a secret, an email in a public read or realtime payload), §3 (physical left/right, non-Western digits, an English user-facing string, the SAR indicator inside the <bdi>).
4. Read the ARABIC closing comment for a claim the evidence does not carry, and for anything marked measured that was not executed. The human will POST it and CLOSE the issue on its strength, so an overclaim becomes a permanent false record.
5. INVENTED PRODUCT DECISIONS are the highest-severity finding. Any rule, threshold, default, or user-facing string needs a PRD/BR/FR/SC/EC identifier behind it. Check that the openQuestions list is honest - a question silently answered is worse than one left open.
6. Report what was SILENTLY SKIPPED, not only what is wrong.

Read-only. No Docker. No git or gh write commands.`,
      { label: `refute:#${t.issue}`, phase: 'Refute', schema: REFUTE_SCHEMA },
    ).then((v) => ({ issue: t.issue, build: result, refutation: v }))
  },
)

const tracks = built.filter(Boolean)
log(`Build+refute complete: ${tracks.length}/${issues.length}.`)

const digest = tracks
  .map(
    (t) =>
      `### #${t.issue} — ${t.build.status}\n${t.build.summary}\nfiles: ${(t.build.filesChanged || []).join(', ') || 'none'}\nnotCovered: ${(t.build.notCovered || []).join(' | ') || 'none'}\nopenQuestions: ${(t.build.openQuestions || []).join(' | ') || 'none'}\nverifier: ${t.refutation?.verdict || 'MISSING'}; refuted: ${(t.refutation?.refuted || []).map((r) => r.claim).join(' | ') || 'none'}; missed: ${(t.refutation?.missed || []).join(' | ') || 'none'}; invented: ${(t.refutation?.inventedDecisions || []).join(' | ') || 'none'}`,
  )
  .join('\n\n')

phase('Audit')

const audits = auditIssues.length
  ? (
      await parallel(
        auditIssues.map((a) => () =>
          agent(
            `${COMMON}

AUDIT — GitHub issue #${a.issue}. Read it first: gh issue view ${a.issue} --comments, and extract its acceptance criteria verbatim.

${a.brief || ''}

This runs AFTER the wave's build tracks, so it audits the state they produced. Their digest, so you neither re-measure what was measured nor trust what was refuted:

${digest}

Measure what can be measured against the DEV project (cjrnakdigcwnsrvtyqhy) and the deployed app. A criterion that needs two real browser sessions and that you cannot produce must be reported as NOT SHOWN - not reasoned into a pass. Where a document contradicts another, surface the contradiction.

No Docker. No writes to production. No git or gh write commands.`,
            { label: `audit:#${a.issue}`, phase: 'Audit', schema: BUILD_SCHEMA },
          ),
        ),
      )
    ).filter(Boolean)
  : []

phase('Critic')

const critic = await agent(
  `${COMMON}

You are the COMPLETENESS CRITIC. Verifiers already asked "is this right". Your question is different: WHAT DID WE BOUND, SAMPLE, OR SKIP WITHOUT SAYING SO?

Build tracks:

${digest}

Audits:

${audits.map((a) => `### #${a.issue} — ${a.status}\n${a.summary}\nnotCovered: ${(a.notCovered || []).join(' | ') || 'none'}\nblockers: ${(a.blockers || []).join(' | ') || 'none'}`).join('\n\n') || 'none ran'}

1. Find coverage that was bounded silently: a criterion sampled rather than enumerated, a test cited rather than run, a control reasoned rather than measured, a file skimmed rather than read. Silent truncation reads as full coverage.
2. Re-check each issue's draft closing comment against its real acceptance criteria and flag any that claims more than the evidence carries.
3. Flag anything that needs @m7ya505 or @Dem4t at the table rather than a merge - including any presentation or auth surface the wave touched.
4. Name any CLAUDE.md rule that NO track checked at all.
5. Collect every openQuestion across the wave into one list. These need a recorded product decision from the owner and a line in PRD.md; none may be answered in code.

Short and specific. Every item actionable by the human in one step. Read-only.`,
  {
    label: 'critic:completeness',
    phase: 'Critic',
    schema: {
      type: 'object',
      required: ['missed', 'overclaims', 'needsAnotherOwner', 'uncheckedRules', 'openQuestions'],
      properties: {
        missed: { type: 'array', items: { type: 'string' } },
        overclaims: { type: 'array', items: { type: 'object', required: ['issue', 'what'], properties: { issue: { type: 'string' }, what: { type: 'string' } } } },
        needsAnotherOwner: { type: 'array', items: { type: 'string' } },
        uncheckedRules: { type: 'array', items: { type: 'string' } },
        openQuestions: { type: 'array', items: { type: 'string' } },
      },
    },
  },
)

return { tracks, audits, critic, blockedOnTeammates: blocked }
