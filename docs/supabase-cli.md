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

   > **`db diff --linked` is failing right now — 2026-08-13, CLI 2.114.0.** It builds
   > the shadow database and applies both migrations correctly, then dies inside
   > Supabase's own diffing service:
   >
   > ```
   > Diffing schemas...
   > error diffing schema: Error: timeout exceeded when trying to connect
   >   at .../@supabase/pg-delta/1.0.0-alpha.33/dist/core/catalog.model.js
   > PGDELTA_SCRIPT_ERROR
   > ```
   >
   > Reproduced twice, minutes apart. It is **server-side and not ours** — note the
   > `alpha` version of `pg-delta`. It worked earlier the same day, so it may well come
   > back on its own; try it before assuming it is still broken.
   >
   > **Until it does, do not read the failure as "no drift".** Ask the catalog directly
   > — it names what is actually there instead of what changed, which is the better
   > question anyway:
   >
   > ```sql
   > select
   >   (select string_agg(tablename, ', ' order by tablename)
   >      from pg_tables where schemaname = 'public')                            as tables,
   >   (select string_agg(p.proname, ', ' order by p.proname)
   >      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   >     where n.nspname = 'public')                                             as functions,
   >   (select string_agg(t.typname, ', ' order by t.typname)
   >      from pg_type t join pg_namespace n on n.oid = t.typnamespace
   >     where n.nspname = 'public' and t.typtype = 'd')                         as domains,
   >   (select string_agg(c.relname, ', ' order by c.relname)
   >      from pg_class c join pg_namespace n on n.oid = c.relnamespace
   >     where n.nspname = 'public' and c.relkind = 'v')                         as views;
   > ```
   >
   > On both projects that must return exactly:
   >
   > | | |
   > |---|---|
   > | tables | `auctions, bids, profiles` |
   > | functions | `auctions_guard_update, bid_reject, bids_are_append_only, bids_only_via_place_bid, format_sar, handle_new_user, place_bid, rls_auto_enable, sar_text` |
   > | domains | `sar_amount` |
   > | views | `bid_history` |
   >
   > `rls_auto_enable` is Supabase's, not ours — same function the diff has always
   > reported. Everything else is the two committed migrations. Anything extra is real.

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
| `dallal-dev` (Vercel **Preview**) | `cjrnakdigcwnsrvtyqhy` | rebuilt from `supabase/migrations/` | `20260812120000`, `20260813190000` |
| `dallal-prod` (Vercel **Production**) | `yfszokbunbqesigdfuwk` | applied from `supabase/migrations/` | `20260812120000`, `20260813190000` |

**Both projects now carry the same two migrations, applied the same way.**
`dallal-prod` was empty until 2026-08-13 — zero tables, zero users, verified
immediately before the push — and received its entire schema through
`supabase db push` from `main`. Nothing was pasted, and its migration history
matches the repository, so the next change reaches it the same way this one did.

Measured on `dallal-prod` after the push, and identical to `dallal-dev`:

| | `anon` / `authenticated` |
|---|---|
| `auctions`, `bids`, `profiles`, `bid_history` | `SELECT` only — no `INSERT`, `UPDATE` or `DELETE` |
| RLS | enabled on all three base tables |
| `POST /rest/v1/bids` | `401` / `42501` — a bid cannot bypass `place_bid` |
| `POST /rest/v1/rpc/place_bid` | `200` `{"accepted": false, "reason": "not_authenticated"}` |
| `sar_amount` | `VALUE > 0 AND VALUE < 'Infinity' AND VALUE = round(VALUE,2)` |

That `VALUE < 'Infinity'` is on the production domain and must stay there
(`CLAUDE.md` §4.4). The two `bid_history` amount columns are `text`, by design —
amounts travel as strings and are compared in SQL, never as a JS `Number`.

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

**When it reports anything at all**, that is: the command started failing
server-side later the same day. See the note under "Making a change" step 2 for
the error and for the catalog query to use instead. Both projects were
re-checked that way afterwards and match the table above.

## Advisors — what is expected, so a new WARN stands out

`get_advisors` reports **no errors** on either project. It reports nine
warnings, and every one of them is either intentional or not ours:

- `place_bid` executable by `anon` — **intentional.** It is the bid endpoint.
  Identity comes from `auth.uid()` inside the function, never from the payload,
  and the anonymous call is answered `not_authenticated` rather than refused at
  the API layer (`BR-01`, measured above).
- `rls_auto_enable` on both counts — Supabase's own function, not ours.
- `function_search_path_mutable` on `bid_reject`, `format_sar`, `sar_text`,
  `bids_are_append_only`, `bids_only_via_place_bid`, `auctions_guard_update` —
  **six real warnings against `BID-02`, to be fixed in `BID-15`.**

`handle_new_user` appears in none of these lists, because `AUTH-01` sets
`search_path = ''` and revokes `EXECUTE`. That is the pattern the six above
should follow.

**Anything outside that list is new and worth reading.**
