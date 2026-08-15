# F0 — the taxonomy evidence record

| Field | Value |
|---|---|
| Ticket | `F0` — sourced canonical 13/110 taxonomy dataset and field metadata |
| Status | **DATA COMPLETE TO THE LIMIT OF THE EVIDENCE. COUNT UNMET.** 13 of 13 categories, **61 of 110** subcategories |
| Base | `origin/main@b885a6598c2d2a5a6064dad17f25b76db6e8af1f` |
| Contract | `dallal-v2-approved-architecture.md`, SHA-256 `e9cd38c750b4502e02bfb41041d12249a64083df2e94f385460dea32d219e17e` |
| Read on | 2026-08-15 |
| Machine-readable | [`catalog.json`](catalog.json), [`sources.json`](sources.json) |
| Validator | [`tests/v2/taxonomy.check.mjs`](../../../tests/v2/taxonomy.check.mjs) — 35 assertions, **exits 2** |
| Probes | [`tests/v2/taxonomy-negative.check.sh`](../../../tests/v2/taxonomy-negative.check.sh) — 27 probes, all `CAUGHT` |
| Blocked on | **`O-F0-1`** — a product decision, not a research gap |

---

## 1. The one-paragraph version

The thirteen main categories are settled and sourced. The subcategories are not,
and the reason is not that nobody looked hard enough. **The approved prototype's
own grid accounts for 72 subcategories — 60 named chips plus 12 anonymous `+N`
placeholders — while its headline, `D-02` §1 and the architecture contract all
say 110.** Thirty-eight rows are named by no artifact in this repository and by
no marketplace page read for this ticket. That is a gap in the product decision,
and `CLAUDE.md` §8 and `TEAM.md` rule 16 are explicit that a session does not
close one by picking something reasonable. So this record publishes the 61 rows
evidence supports, the exact shape of the remainder, and stops.

---

## 2. What was read, and what refused

Eight external surfaces plus two in-repo artifacts. The distinction between
*read* and *summarised* is enforced mechanically: `taxonomy.check.mjs` fails if
any row cites a source whose recorded access begins with `FAILED`.

| Source | Access | What it yielded |
|---|---|---|
| **حراج** `haraj.com.sa/all-sections/` | **READ-DIRECT** (browser) | 19 main sections. Branches in only **6** of them; the other 13 are leaf-only |
| **المزاد الحر** `almazad-alhar.com` | **READ-DIRECT** (browser) | Full two-level tree: 19 categories, ~160 subcategories |
| **Emirates Auction** | **READ-DIRECT** (fetch) | 12 top-level categories; deep only on plates, split by emirate |
| **Soum** `soum.sa` | **READ-DIRECT** (fetch) | ~18 subcategories, almost all electronics |
| **إنفاذ** `infath.gov.sa` | **READ-DIRECT** (fetch) | One asset type on the public surface: `عقارات` |
| **Mazadak** | **READ-DIRECT** (fetch), English only | Vehicles, Heavy Machinery, Scrap, Furniture, Liquids |
| **مزاد عُمان** `mazad.om` | **FAILED** — TLS, certificate unverifiable | nothing |
| **السوق المفتوح** `opensooq.com` | **FAILED** — HTTP 403 | nothing |
| `design-system/previews/categories.html` | in-repo | 13 categories, 60 chips, 12 `+N`, 1 picker-only row, 13-row field table |
| `docs/decisions/D-02-categories.md` | in-repo | the 13 categories and slugs, **DECIDED** by the owner |

### 2.1 One correction to `D-02` §1.1

`D-02` groups **المزاد الحر** with the platforms that "returned 403 / SSL errors,
so only what appeared in search results was used". Re-tested on 2026-08-15: it
refuses a plain fetch with 403 but **serves a real browser in full**. Its entire
two-level tree was read directly and is now the second-densest source in this
record, behind حراج only.

That single recovery is the difference between having one deep Saudi source and
two. It also means `D-02`'s provenance understated what was available — worth
knowing before anyone treats the remaining two failures as permanent. **مزاد
عُمان and السوق المفتوح were re-tested too and both still refuse**, by the same
mechanisms `D-02` recorded.

### 2.2 What was deliberately not imported

Reaching 110 by accident was available at several points and was refused each
time. Every exclusion is machine-readable in `catalog.json → not_imported`:

- **~50 car makes** interleaved into حراج's vehicle branches (تويوتا، هونداي،
  لكزس …). A make is a value of the `الماركة` field per `D-02` §2, not a
  taxonomy level. **Importing these alone would have produced a 110-row
  catalog** — which is exactly how a fabricated dataset would have looked
  correct.
- **7 Emirates Auction plate emirates.** A UAE jurisdiction split with no Saudi
  equivalent.
- **حراج's seven real-estate rent branches.** A rental has nothing to knock down
  to a highest bidder — the same logic `D-02` §1.1 uses to exclude classified
  ads.
- **المزاد الحر's service and classified categories** (التعليم والتدريب،
  الصحة والجمال، إعلانات الوظائف، السفر والرحلات، طعام وغذاء، شركات، لوازم
  الأطفال). The classes `D-02` already excludes, on a different platform.
- **حراج's third-level game-account tags.** Third level; the taxonomy is two.
- **Mazadak's "Liquids".** English-only source. A label invented from an English
  word is a manufactured label.

---

## 3. Reconciliation — every alias and normalisation

Recorded in `catalog.json → aliases`, with the canonical form and the decision.

| Canonical | Variant | Where the variant appears | Decision |
|---|---|---|---|
| `plates-numbers` «لوحات وأرقام مميزة» | «لوحات وأرقام» | prototype filter rail and picker | One category, two renderings; the rail drops «مميزة» for width |
| `jewelry-diamonds-gems` «ألماس وأحجار كريمة» | «ألماس وأحجار» | prototype grid chip | Picker form canonical; the grid abbreviates |
| `luxury-pens-accessories` «أقلام وإكسسوارات فاخرة» | «أقلام فاخرة» | prototype grid chip | Picker form canonical; the grid abbreviates |
| `vehicles-classic` «كلاسيكية» | «سيارات تراثية» | حراج | Same class, different register |
| `vehicles-motorcycles` «دراجات نارية» | «دبابات» | حراج | حراج colloquialism for motorcycles |
| `livestock-camels` «إبل» | «أبل» | حراج | Orthographic only — initial hamza |

### 3.1 Three Arabic labels that must not be merged

The F0 rule against silently merging Arabic labels with distinct auction
meanings has three live instances here, and all three are one careless
de-duplication away from a real defect:

1. **«لوحات»** is both a *painting* (`art-paintings`) and a *licence plate*
   (`plates-vehicle`, «لوحات سيارات»). Both are canonical rows under different
   parents. Search and any AI category classifier must disambiguate by parent,
   never by label.
2. **«دبابات» / «دباب»**. حراج's «دبابات» means motorcycles and maps to
   `vehicles-motorcycles`. The prototype's «دباب ومركبات ترفيهية»
   (`outdoors-atv`) is a recreational quad. Near-identical words, different
   goods; citing حراج under `outdoors-atv` would be wrong.
3. **«سجاد»** appears as `furniture-rugs-curtains` («سجاد وستائر», machine floor
   covering) and as `art-handmade-rugs` («سجاد يدوي», an art object). المزاد
   الحر's «سجاد - موكيت» corroborates the first and **not** the second.

### 3.2 One merge the prototype makes that its sources do not

Both حراج and المزاد الحر keep **غنم** and **ماعز** as two separate branches. The
prototype merges them into one chip, `livestock-sheep-goats` «أغنام وماعز».
Following the prototype costs one row; un-merging would gain one. It is listed
as a candidate under `O-F0-1` and **not applied** — a session does not get to
change the approved grid to make a count work.

---

## 4. The blocker, stated exactly

This is the part that matters, so here is the arithmetic with nothing hidden:

```
prototype grid, named chips ....................  60
picker adds «فضة» (hidden behind a +N) .........   1
                                                 ---
canonical rows in catalog.json .................  61

anonymous +N placeholders remaining ............  11
                                                 ---
what the prototype's own grid accounts for .....  72

what the headline, D-02 §1 and the contract say  110
                                                 ---
rows named by NO artifact anywhere .............  38
```

Two separate deficits, and they are **not** the same problem:

**The 11 placeholders are a research/authoring gap with a known shape.** Each is
a real named row that exists somewhere the prototype does not print. We know this
because `فضة` was one of them: hidden behind watches-jewelry's `+1` in the grid,
visible only in the picker. `catalog.json → unresolved` lists all 11 by parent,
with the candidates each source actually offers. Somebody with access to the
design source can resolve these.

**The 38 are not.** No placeholder stands for them. No source read names them.
They exist only as the difference between two numbers in an approved document.

> **`O-F0-1`** — Which is the contract: **72**, **110**, or is the fixed count
> dropped? If 110, who authors the 38 rows nothing names, and against what
> source?

Until that is answered, `tests/v2/taxonomy.check.mjs` exits 2 and says so. It is
allowlisted out of CI **with an expiry condition** rather than softened, per
`CLAUDE.md` §9: the guard does not stop the change, it stops the *silent* change.

### 4.1 Two categories with no external corroboration at all

`art` and `collectibles` — 8 rows between them — rest on prototype authority
alone. حراج's `مكتبة وفنون` is leaf-only; المزاد الحر has no art or antiques
category; Emirates Auction stops at `بضائع متنوعة`. Widening past the seven
platforms `D-02` names is a new evidence gate, **`O-F0-2`**.

---

## 5. Category fields — evidence separated from proposal

`catalog.json → category_fields` carries two things per category and keeps them
apart on purpose:

- **`labels`** — what `categories.html` actually prints. Observed, quotable.
- **`proposed`** — a **reversible draft** of types, units and constraints that
  **nobody has approved**. T1 must treat it as a starting point requiring owner
  sign-off, not as a decision.

Two constraints carried through from `D-02` §2.1 and `CLAUDE.md` §4:

- **None of these fields is money.** `المساحة`، `الممشى`، `عدد الخانات`،
  `الوزن التقريبي` are quantities. The validator fails if any proposed type
  mentions `sar_amount`, `SAR` or `money`.
- **Every field is optional and never blocks publishing** (`D-06` §2).

### 5.1 `D-02` §2's field table is incomplete

It omits `outdoors` and `misc` entirely and leaves `fashion` as "(per the
prototype's table)". `categories.html` supplies all three:

| category | fields `D-02` does not give |
|---|---|
| `fashion` | الماركة · المقاس · الحالة · الأصلية والملحقات |
| `outdoors` | النوع · الماركة · الحالة |
| `misc` | none — «ما فيه حقول إضافية — الوصف يكفي» |

The empty set for `misc` is a decision, not a gap.

---

## 6. Open questions

Every one carries an id, per `docs/decisions/README.md` rule 5, because a gap
without an id appears in no board copy and is counted as startable.

| id | blocks | question |
|---|---|---|
| **`O-F0-1`** | `T1`, `V2-C1`, `V2-A1`, #180, #181 | The count: 72, 110, or no fixed count? If 110, who authors the 38 unnamed rows and against what source? |
| `O-F0-2` | `T1` | `art` and `collectibles` have no subcategory corroboration on any of the seven platforms. Accept on prototype authority, or widen the source set? |
| `O-F0-3` | `T1`, `D1` | `أجهزة منزلية` sits under `furniture` in the prototype and under electronics on حراج، المزاد الحر and سوم. Which parent? Affects browse and the AI classifier, not just the picker |
| `O-F0-4` | — | `D-02` §1.2 says إنفاذ carries a `منقولات متنوعة` equivalent; the read of `infath.gov.sa` showed only `عقارات`. Stale claim, or a surface not publicly listed? Does not block — `misc` stands on three other sources |

---

## 7. What the prototype's numbers are not

`categories.html` prints a per-category auction count (`1,284 مزاد` …). These are
**display examples**. They are preserved in
`catalog.json → display_examples_not_facts` for exactly one reason: so that a
future reader who finds them recognises them as prototype decoration rather than
measured data and does not seed them. No count in this record is production data.

---

## 8. Verification

| Command | Result |
|---|---|
| `node tests/v2/taxonomy.check.mjs` | **exit 2** — 34 ok, 0 structural failures, 1 count gap |
| `./tests/v2/taxonomy-negative.check.sh` | **exit 0** — 27 probes, 27 `CAUGHT`, 0 `MISSED`, 0 `NO-OP` |
| `./tests/guards/run.sh` | PASS — 21/21 |
| `./tests/guards/ci-coverage.sh` | PASS — 28 suites, 0 unwired |

The negative suite found **two real defects in the validator** before it was
committed, which is the argument for writing it at all:

1. Every `FAIL` message printed different text from its `ok` message, so 13
   probes came back `BROKEN` — they had been asserting nothing.
2. `category slugs are unique` is a substring of `subcategory slugs are unique`,
   so a probe for the first matched the second's `ok` line and reported `MISSED`
   against a check that had correctly failed.

A third was found by the validator against its own data: the money-type check
flagged `المساحة (م²)` and `الوزن التقريبي`, whose annotations read
`"NOT money"` — **the two fields most carefully marked as non-money were the
only reported money violations.** The de-negation that fixes it is itself
probed, so it cannot decay into a blanket skip.

---

## 9. Handoff to T1

**T1 may start on everything that does not depend on the row count**, and that
is most of it:

- `categories` / `subcategories` / `category_fields` schema, RLS, grants —
  `catalog.json` fixes the column shape (slug, Arabic label, icon key, sort
  order, active flag, parent).
- The seed generator, reading `catalog.json` rather than re-deriving it. It must
  refuse to seed a row whose `evidence` is `C`.
- Attribute validation against `category_fields` — unknown key rejected
  server-side, per `ARCHITECTURE` §5.1.
- The picker and browse filter against whatever rows exist.

**T1 must not:**

- author subcategory rows to reach 110;
- promote a class `C` row to canonical;
- absorb the shortfall into `misc` — `ARCHITECTURE` §5.1 caps it at one general
  row, and the validator enforces that;
- treat `category_fields.proposed` as approved.

**Wire `tests/v2/taxonomy.check.mjs` into `.github/workflows/ci.yml` and delete
its `ci-coverage.sh` allowlist line on the day `O-F0-1` is answered.** Its
negative suite already runs in CI, so the wiring is known to work.
