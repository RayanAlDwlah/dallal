# Applying database changes

**Do not paste SQL into the Supabase dashboard's SQL editor.** Everything below
exists so that nobody has to.

This is not a style preference. The dev project's schema was applied by hand,
and the consequence was measurable: `supabase_migrations` does not exist on it,
`list_migrations` is empty, and there is no record of what was applied, by whom,
in what order, or whether it matches the repository. A hand-applied change is
invisible to review, cannot be replayed onto `dallal-prod`, and cannot be rolled
back. It was also the only route open to anyone, because none of the tooling
below was in the repository. That is what this file fixes.

---

## One-time setup

```bash
brew install supabase/tap/supabase     # macOS. Others: https://supabase.com/docs/guides/cli
supabase login                          # opens a browser, once per machine
supabase link --project-ref cjrnakdigcwnsrvtyqhy      # dallal-dev
```

`supabase login` **must be run in your own terminal.** It needs an interactive
session; an AI session cannot complete it, and you must never paste an access
token into a chat to work around that — it is a credential with full account
access.

`link` writes `supabase/.temp/`, which is git-ignored. `config.toml` is shared
and committed; nothing secret goes in it.

## Making a change

1. Create the file. The name must sort after every existing one:

   ```bash
   supabase migration new short_description_here
   ```

   This creates `supabase/migrations/<timestamp>_short_description_here.sql`.
   Write your SQL there. **Never edit a migration that has already been
   applied** — write a new one that alters what the old one created.

2. Check what it would do before it does it:

   ```bash
   supabase db diff --linked        # what the remote has that the repo does not
   ```

3. Open a PR. `main` is protected and this is a schema change — it gets an
   approval like everything else.

4. After merge, apply it:

   ```bash
   supabase db push
   ```

## Two rules that are not obvious

**RLS is the second gate, not the first.** PostgreSQL checks the table `GRANT`
before it evaluates any policy. A `using (true)` policy on a table the role
holds no `SELECT` on denies every read with `42501`, and the policy never runs.
This project's default for new public tables is `anon=Dxtm` — TRUNCATE,
REFERENCES, TRIGGER, MAINTAIN and **no DML at all** — so a new publicly-readable
table needs an explicit `grant select ... to anon, authenticated` alongside its
policy. The older Supabase default that granted this automatically is gone. This
cost us a live defect; see PR #5.

**`config.toml`'s `[auth]` block configures the *local* stack only.** It does not
touch the hosted project until someone runs `supabase config push`. Two values in
it are pinned to recorded product decisions and are annotated in the file:
`minimum_password_length = 8` (`FR-AUTH-04`) and `enable_confirmations = false`
(`FR-AUTH-07` — email verification is deliberately not required).

## Local credentials

`.env.example` lists every variable by name. Copy it and fill in real values:

```bash
cp .env.example .env.local
```

Get the values from the Vercel project (`Settings → Environment Variables`) or
from Supabase (`Project Settings → API`). `.env.local` is git-ignored and must
never be committed, pasted into an issue, or sent to an AI session.
`SUPABASE_SERVICE_ROLE_KEY` is not used by this project at all — if you find
yourself wanting one, raise it with the team first (`ARCHITECTURE.md` §17.3).

## State of the two projects, measured 2026-08-13

| | project ref | schema | migration history |
|---|---|---|---|
| `dallal-dev` (Vercel **Preview**) | `cjrnakdigcwnsrvtyqhy` | rebuilt from `supabase/migrations/` | `20260812120000` recorded |
| `dallal-prod` (Vercel **Production**) | `yfszokbunbqesigdfuwk` | **empty — zero tables** | none |

`dallal-dev` was rebuilt on 2026-08-13. It had been applied by hand, had no
migration history at all, and was missing the `GRANT SELECT` public reads depend
on. It held **zero rows and zero users** — verified immediately before, and
guarded by an abort inside the same statement batch — so nothing was lost. The
Supabase-managed `ensure_rls` event trigger and its `public.rls_auto_enable`
function were deliberately left alone: they ship with the project, not with us,
and `dallal-prod` has them too despite never having been touched.

That one function is now the **only** thing `supabase db diff --linked` reports,
and it will keep reporting it forever. It is not our drift. Ignore that entry
and read the rest — if anything else appears, that is real.

Production has no schema. The wiring is correct but the first production deploy
would fail against an empty database. Do not fix it by pasting into the SQL
editor — it gets the same `supabase db push`, from `main`, that dev just got.
