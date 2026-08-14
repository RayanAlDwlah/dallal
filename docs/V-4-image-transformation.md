# V-4 — Image thumbnail / transformation capability

| Field | Value |
|---|---|
| Spike | **V-4** (`#27`) — `ARCHITECTURE` §22, §16.3 |
| Owner | Mohammed (`@m7ya505`) |
| Constrains | `NFR-PERF-05` (a thumbnail must not download the original) · `NFR-PERF-01` (listing usable in 3 s with 100 auctions) |
| Date | 2026-08-14 |
| Verdict | **Supabase transformation is ruled out. `next/image` is the chosen path; derivative-at-upload is the fallback.** |
| `NFR-PERF-05` today | 🔴 **violated** — every thumbnail downloads the full original |
| `NFR-PERF-01` today | 🔴 **breached above the fold**, measured — see §3 |

---

## 1. Is platform-side transformation available? — **ruled out**

**Documented.** Supabase's own guide states plainly:

> *"Image Resizing is currently enabled for **Pro Plan and above**."*

The transform URL is `…/storage/v1/render/image/public/<bucket>/<key>?width=…`, a different path from `…/object/public/…`.

**Measured, and inconclusive on its own.** Probing `dallal-dev` (`cjrnakdigcwnsrvtyqhy`, the ref documented in `docs/supabase-cli.md`) with a key that does not exist:

| Endpoint | HTTP | Body |
|---|---|---|
| `/object/public/auction-images/__v4probe.jpg` | 400 | `{"statusCode":"404","error":"not_found","message":"Object not found","code":"NoSuchKey"}` |
| `/render/image/public/auction-images/__v4probe.jpg?width=200` | 400 | **identical** |

The render path is routable and reaches object lookup — it did **not** answer with a plan or feature error. **That does not confirm the feature is enabled**: object lookup evidently happens before any plan check, so a project without transformations would answer this probe the same way.

**NOT SHOWN, and stated rather than reasoned past:** whether a transform on a *real* object would succeed. Distinguishing needs either a real object key or the project's plan. There is no `.env.local` in this working tree and the anon key is correctly absent from the repository, so neither is reachable from here. `INT-10`'s deployed-environment check could settle it in one request.

**It is ruled out anyway, and not because the probe was inconclusive:**

1. **It is a paid-plan dependency for a hard requirement.** `NFR-PERF-05` has no environment carve-out. Binding it to a plan tier means the listing behaves differently in dev and prod — and this project has already been bitten once by exactly that shape, when `pg_default_acl` differed between the two and an `INSERT` grant existed in one and not the other (`#99` §2).
2. **It buys nothing the deploy platform does not already give.** See §4.

## 2. `ARCHITECTURE` §16.3 lists two options. There are three.

> **Options, to be decided in implementation:** platform-side image transformation if available, or generating a smaller derivative at upload.

The list omits the one that fits this project best: **`next/image`**. That *is* platform-side transformation — Vercel's rather than Supabase's — and Vercel is already the deployment target (`docs/vercel-deployment.md`), so it is not a new dependency on anything.

`components/ui/image-frame.tsx` records why it was not taken at the time:

> *"Deliberately a plain `<img>`: next/image needs a configured remote host, and the storage host is not decided yet."*

**That blocker is gone.** The bucket exists, is public, and its URL shape is fixed by `lib/auctions/image-url.ts`. The remote host is decidable today.

## 3. The measurement — `NFR-PERF-01` fails *before* it reaches 100

`FR-LIST-09` sets the listing at up to 100 auctions and `NFR-PERF-01` gives it 3 seconds. Two source images were rendered at 4000×3000 and measured with `sharp` (already present as Next's own transitive dependency); transfer time is computed at **25 Mbps**.

| Source | Size | 100 originals | 100 × 400px WebP |
|---|---|---|---|
| low-entropy pattern — **optimistic**, compresses far better than a photograph | 0.56 MB | **56 MB → 18.9 s** | 0.35 MB → 0.12 s |
| grain-heavy, photo-like | 5.66 MB | **566 MB → 190 s** | 0.36 MB → 0.12 s |
| `FR-CREATE-17`'s cap — **not synthetic** | 5.00 MB | **500 MB → 168 s** | — |

**The argument does not depend on guessing what a typical photo weighs.** Even the *most compressible* source measured — a synthetic pattern no camera would produce — is **6× over budget** at 100 entries. Everything realistic is worse.

### 3.1 Lazy loading already bounds this, and it is still not enough

`ImageFrame` sets `loading="lazy"` for anything without `priority`, and `auction-card.tsx` passes no `priority` — so below-fold thumbnails are not fetched on first paint. That is a real mitigation and it changes the arithmetic. It does not rescue it:

| Above the fold | Originals | With 400px WebP |
|---|---|---|
| 375 px, ~2 cards (`grid-cols-1`) | 11 MB → **3.8 s** | 7 KB → 0.002 s |
| desktop, ~8 cards (`lg:grid-cols-3`) | 45 MB → **15.2 s** | 30 KB → 0.010 s |

**Two thumbnails already exceed the three-second budget** on a photo-like image. So `NFR-PERF-01` is breached today by the visible set alone, before lazy loading gets a chance to help.

`NFR-PERF-05` is breached more simply and needs no arithmetic: *"a listing thumbnail must not require downloading the full-resolution original"*, and today every thumbnail does exactly that.

### 3.2 What the derivative costs to make

Same measurement, `sharp` on this machine:

| Derivative | Bytes | Time |
|---|---|---|
| 400 px WebP q78 | 4 KB / 3.7 KB | **18 ms** |
| 400 px JPEG q78 | 7 KB | 11 ms |
| 800 px WebP q78 | 14 KB | 40 ms |

Generation is cheap enough that it is not the deciding factor either way.

## 4. Decision — `next/image`, with derivative-at-upload as the fallback

`ARCHITECTURE` §16.3 states this is *"an implementation choice **within Mohammed's ownership**, constrained by `NFR-PERF-05`"*, so it is decided here rather than raised.

**Chosen: `next/image` with `images.remotePatterns` for the storage host.**

| | `next/image` | derivative at upload | Supabase transform |
|---|---|---|---|
| Plan dependency | Vercel, already the target | none | **Pro tier** |
| Works in dev / local | yes | yes | **only if dev is Pro too** |
| Extra stored object | no | **yes — doubles the orphan surface of #142** | no |
| New direct dependency | no | **`sharp`** (transitive today, would become direct) | no |
| Creation-path cost | none | +18–40 ms and a second upload | none |
| Responsive `srcset` | automatic | hand-built per breakpoint | manual per URL |

The second column's third row is the one that decides it. `#142` is open precisely because a failed creation already leaves one orphaned object with no cleanup path; writing a second object per auction doubles that residue while `SEC-I6` is still unreconciled.

**Fallback, unchanged from `ARCHITECTURE` §22's own entry** (*"Generate a smaller derivative at upload time"*): if `next/image` is rejected — for Vercel optimization limits, or because someone wants the derivative to exist independently of the host — `sharp` at upload produces a 400 px WebP in 18 ms, and §3.2 is the measurement that supports it.

## 5. What this spike does **not** do

`V-4`'s acceptance criteria are *confirm or rule out · plan the fallback · a rough measurement · findings recorded*. All four are above. **Implementation is not part of it**, and is filed separately — the same shape `V-2` took (`docs/V-2-scheduling-verification.md`).

Not shown here, and named rather than left to be found:

1. **Whether transformation is enabled on `dallal-dev` or `dallal-prod`.** Ruled out on grounds that do not depend on the answer (§1), but the answer itself was not obtained.
2. **A real end-to-end page timing.** Every number in §3 is transfer arithmetic over measured byte sizes at a stated bandwidth — not a browser loading the deployed listing. That is `INT-10`, and it is the only thing that can confirm the 3-second target end to end.
3. **Real photographs.** Both sources are synthetic. The conclusion is built as a *lower bound* on the most compressible one for that reason.

---

*Measured 2026-08-14. Byte sizes, timings and the two HTTP probes were executed; transfer times are arithmetic over them; the above-fold card counts are read from `active-listing.tsx`'s grid classes.*
