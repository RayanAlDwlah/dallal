# AI waves — running a batch of issues with agents that check each other

### موجات الوكلاء — كيف نُنجز دفعة issues دون أن نصدّق أنفسنا

| Field | Value |
|---|---|
| What this is | **Reference material, not wired-in tooling.** A workflow script plus the reasoning behind it. Copy it if you want it; nothing in the build depends on it |
| The script | [`docs/workflows/dalal-wave.js`](workflows/dalal-wave.js) |
| Author | Rayan (`@RayanAlDwlah`) — first run 2026-08-14, wave 5 |
| Status | Used once, on seven of my own issues. Read §6 before trusting it on yours |

---

## 1. Why this exists

All three of us build this with Claude, in sessions that cannot see each other. That gives
us throughput and one specific, recurring defect, recorded in `CLAUDE.md` §8:

> a confident session filling a gap with something reasonable

A reserve price. A bid increment. A `numeric(12,2)`. An English string. A `COALESCE` that
hides a null. Every one type-checks, passes review at a glance, and silently violates a
decision someone made on purpose. Running **more** sessions in parallel multiplies that
failure as fast as it multiplies the work.

So the wave is not "more agents". It is **more agents plus something adversarial behind
each of them**, and a human who does every irreversible action himself.

## 2. The shape

```
Scout   → read the open issues, split "buildable now" from "blocked on a teammate"
Build   → one agent per issue, in parallel
Refute  → an independent skeptic per issue, whose job is to DISPROVE the builder
Audit   → the wide checks, run last, against the state the wave produced
Critic  → what did we bound, sample, or skip WITHOUT SAYING SO
Human   → every git command, every PR, every issue closure
```

`Build` and `Refute` are a pipeline, not a barrier: issue A's skeptic starts the moment A's
builder finishes, while B is still building. `Audit` waits, because an audit of the wave
must see the whole wave.

## 3. The five things that make it work

Any of these removed, and it becomes an expensive way to generate plausible text.

**1 · The verifier's job is to refute, not to confirm.** It is told to default to *refuted*
when uncertain, and it is given the builder's output as JSON to attack. A verifier asked to
"check the work" agrees with it; a verifier asked to "break this claim" opens the file.

**2 · Every claim is labelled `measured` or `reasoned`, and the label is a schema field.**
Not a convention — a required enum the model must fill. This is aimed at the defect
recorded in `docs/contracts/` more than once: the sentence asserting something was verified,
where the verification does not exist. `#130` is the canonical case — `SC-17` was believed
covered and was asserted **nowhere**.

**3 · `openQuestions` is mandatory, and the verifier audits it.** When the PRD is silent,
the builder must list the question rather than answer it (`TEAM.md` rule 16). The verifier
is then told: *a question silently answered is worse than one left open*. This is the
mechanism that made `BID-10` (`#71`) surface two undecided realtime behaviours instead of
inventing them.

**4 · No agent may write to git or GitHub.** No commit, no push, no merge, no `gh pr
create`, no `gh issue close`. They return drafts and evidence; a human reads and acts. The
reason is not distrust of the code — it is that closing an issue on an overclaimed comment
writes a **permanent false record** that the next session will cite as fact.

**5 · The preamble carries every rule that has actually been broken here.** Not a summary
of `CLAUDE.md` — the specific clauses with the specific traps: the `::text` cast per money
column, the cap being a `CHECK` and not an `if`, `clock_timestamp()` over the `status` flag,
`bids.id` over `created_at`, the `SAR` indicator outside the `<bdi>`. Plus the environment
facts that have each cost a session an hour: zsh eats `:P` in a git ref, `timeout` does not
exist on this machine, `information_schema.role_table_grants` lies by omission, the Docker
container name collides.

## 4. Running it

```bash
cp docs/workflows/dalal-wave.js .claude/workflows/       # or symlink it
```

`.claude/` is gitignored (`.gitignore:44`) on purpose — it holds local state. That is why
this lives in `docs/` and is copied, rather than being wired in.

Then, from a Claude session in this repo:

- **no arguments** — the Scout reads your open issues, keeps what one agent can finish
  without a teammate, and caps the wave at six. It reports which issues it **dropped** and
  why; a silent cap reads as full coverage.
- `{issues: [82, 28, 71], audits: [85, 91]}` — skip the Scout, run exactly these.
- `{issues: [...], extra: "..."}` — an extra instruction appended to every agent.

**Two things to know before the first run.** Only one agent per wave may run Docker, because
`dalal-bidding-tests` collides and two concurrent runs corrupt each other — the script
assigns that permission to the first issue and forbids it to the rest. And every builder is
told to check `git status` before writing: if a file it did not create is already modified,
another track owns it, and it must say so rather than write over it.

## 5. Adapting it to your half

The preamble is written from Rayan's seat ("you act on behalf of..."). If you run it,
change that line and the ownership paragraph, and add the traps **your** area has actually
hit — Mohammed's RTL and presentation traps, Abdulrahman's session and authorization traps.
The value of the preamble is that every line in it was earned by something going wrong. Do
not pad it with rules nobody has broken; a long preamble that is mostly generic gets skimmed
by the model exactly the way a long document gets skimmed by us.

## 6. What it does not do, stated plainly

- **It has one run behind it.** Everything above is a design argument plus a single
  execution. Treat the numbers you get from it the way we treat any other claim here.
- **It does not replace review.** Two agents agreeing is not two people agreeing; they share
  a model, a preamble, and therefore a blind spot. A wave's output still goes through a PR
  with a human approval, per `CLAUDE.md` §7.
- **It cannot verify what needs two real browsers**, or anything else no tool on this
  machine can produce. It is instructed to report those as *not shown* rather than reason
  them into a pass — but that instruction is only as good as the model following it, which
  is precisely why the Critic phase exists and why a human reads the output.
- **It does not know about work in flight in another session.** If two of us run waves on
  the same files at the same time, we get a conflict — the ordinary kind, resolved the
  ordinary way (`CLAUDE.md` §7: on your own branch, by the person with the context).
