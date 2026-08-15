#!/usr/bin/env bash
# ============================================================================
# INT-06 (#88) — the statically decidable half of 375 px.
#
#   ./tests/integration/responsive-375.check.sh
#
# Needs nothing: no browser, no Docker, no node, no network.
#
# ⚠️ THIS DOES NOT VALIDATE INT-06, AND MUST NOT BE READ AS DOING SO.
#
# INT-06 asks that every surface be "fully usable in a MOBILE WEB BROWSER at
# 375 px", with "no horizontal scrolling, no inaccessible controls". That is a
# rendered-layout question and only a browser can answer it. No browser is
# available in this environment (chromium-browser and firefox are both snap
# stubs that fail to launch under WSL), so the visual half is NOT SHOWN and is
# recorded that way in docs/INT-06-responsive-375.md.
#
# What this file does is narrower and still worth having: it pins the causes of
# 375 px overflow that ARE decidable from source, because three of them were
# live in the tree when it was written (see §2 of that document). A human with
# a browser still has to walk the surfaces; this shortens the list of things
# they have to find by eye.
#
# Keep EXPECTED in step with the chk() calls.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

EXPECTED=7
pass=0
fail=0

# `got` is trimmed before comparing. BSD `wc -l` (macOS) pads its output with
# spaces and GNU `wc -l` (Linux, WSL) does not, so `[ "       3" = "3" ]` fails
# on one developer's machine and passes on another's — @RayanAlDwlah hit exactly
# that on #153. A shared check that is green for the author and red for everyone
# else is worse than no check. Trimming here kills the whole class, including
# any future use; the call sites also prefer `grep -c .`, which pads on neither.
chk() { # label  got  want
  set -- "$1" "$(printf '%s' "$2" | tr -d '[:space:]')" "$3"
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1))
    printf 'PASS  %-62s (%s)\n' "$1" "$2"
  else
    fail=$((fail + 1))
    printf 'FAIL  %-62s got=%s want=%s\n' "$1" "$2" "$3"
  fi
}

# Comment-stripped view: this repository explains its own rules in prose, so a
# raw grep matches the explanation as often as a violation (same lesson as
# INT-08's audit).
code() { # [file to omit]
  find app components -name '*.tsx' -o -name '*.ts' 2>/dev/null | grep -v -F -e "${1:-__none__}" | while read -r f; do
    perl -0777 -pe 's{/\*.*?\*/}{}gs; s{^\s*//[^\n]*$}{}gm' "$f"
  done
}

echo "==> INT-06 — the statically decidable half (NFR-USA-06, SC-49)"

# --- 1. Every rendered amount goes through <Money> --------------------------
#
# THE ONE THAT MATTERS. Money is the only element that carries
# `max-w-full min-w-0 overflow-x-auto` on the isolate, which is what lets a
# width-unbounded amount (BR-21 — no ceiling, and creation.sql asserts a
# 40-digit price is accepted) scroll INSIDE ITSELF instead of widening the page.
#
# Three hand-rolled amount islands were live when this was written — in
# bid-panel, bid-history and price-block — each carrying none of it, and two of
# them guaranteed a horizontal scroll rather than risking one. #120 fixed this
# same defect on the detail page and the siblings survived, which is why it is
# now a check and not a review note.
#
# `placeholder=` and `sr-only`/`aria-` uses are exempt: a string in an attribute
# or an off-screen announcement occupies no layout and cannot overflow anything.
#
# money.tsx is omitted from the scan because it IS the implementation of the
# rule — it is the one place formatSar may be called to produce a rendered
# node, and flagging it would make the check unsatisfiable.
# `formatSar[A-Za-z]*(` — the FAMILY, not one name. The first version matched
# `formatSar(` alone, and `formatSarWithSuffix(` does not contain that string,
# so three hand-rolled islands sat in front of it unseen: the create form's
# price preview, its review paragraph, and StartingPrice's sentence. Two of
# them had no containment at all, and the preview is the likeliest wide amount
# in the product — it is the field the seller types the price into.
#
# A one-character blind spot in the check that exists to catch this class is
# the fourth wave of the same defect. The pattern is now the family.
chk "every rendered amount goes through <Money>" \
    "$(code components/ui/money.tsx | grep -vE 'placeholder=|sr-only|aria-' | grep -cE 'formatSar[A-Za-z]*\(' || true)" 0

# --- 1b. Every rendered image goes through next/image ----------------------
#
# Same shape as the rule above, and the same reasoning. `next/image` is what
# produces a derivative instead of shipping the stored original, which is the
# whole of NFR-PERF-05 — "a listing thumbnail must not require downloading the
# full-resolution original". V-4 measured what a bare <img> costs: 56 MB for
# 100 thumbnails at the MOST compressible source tested, 566 MB at a photo-like
# one, against NFR-PERF-01's three seconds. Two thumbnails alone exceeded it.
#
# NARROWED, 2026-08-16. V1 routed everything through components/ui/image-frame.tsx
# and exempted that one file. V2 has no image-frame; it imports next/image
# directly in the three card surfaces, and next.config.ts allows exactly the
# Supabase public-object route.
#
# The narrowing is not a concession — it is the rule stated correctly. A raw
# <img> is only a skipped optimiser when there was an optimiser to skip, and
# five of this tree's <img> elements render an object URL for a File the user
# has not uploaded yet (`imageSrc(img)`, `coverPreview`, `lot.preview`,
# `preview`). next/image cannot optimise a blob: URL — it would have to fetch it
# server-side, and it does not exist server-side. Demanding <Image> there asks
# for something impossible, and a check that does that gets an exemption list
# bolted on within a week.
#
# So: any <img> whose src is a REMOTE storage URL is the violation, because
# that one had a choice. Measured 2026-08-16: 4 of them, all fixed in the same
# commit as this narrowing — profile/page.tsx and three in sessions/hall.tsx.
chk "every remotely-sourced image goes through next/image" \
    "$(grep -rn -A3 '<img' app components --include='*.tsx' \
        | grep -cE 'src=\{(auctionImageUrl|avatarUrl)' || true)" 0

# --- 2. No physical direction properties ------------------------------------
# CLAUDE.md §3. These break the RTL mirror, and a layout that mirrors wrongly is
# the fastest way to push content off the inline-start edge at a narrow width.
chk "no physical left/right spacing or alignment" \
    "$(code | grep -cE '\b(ml|mr|pl|pr)-[0-9]|\b(left|right)-[0-9]|\btext-(left|right)\b|\bborder-(l|r)-|\brounded-(l|r)-' || true)" 0

# --- 3. Nothing is pinned wider than the viewport ---------------------------
# 375 px is the base layer (DESIGN_SYSTEM §10), not a breakpoint, so a fixed
# width at or above it cannot fit — and `w-screen` / a `vw` width ignore the
# scrollbar and overflow by its width on desktop.
#
# It matches WIDTH DECLARATIONS only, not every occurrence of `vw`. A bare
# `100vw` is legitimate and common inside a next/image `sizes` string, where it
# describes how wide the image will RENDER so the optimiser can pick a
# candidate — it sets no element's width. The first version of this check
# flagged image-frame.tsx's own `sizes` defaults, which is a false positive on
# the file implementing the rule in check 1b.
#
# THE NARROWING THAT FIXED THAT FALSE POSITIVE ALSO OPENED A HOLE (#169 review).
# The inline-style arm read `width:[[:space:]]*[0-9]+vw`, which requires a digit
# IMMEDIATELY after the colon. In JSX the value is quoted, so it never matched:
#
#     style={{ width: "100vw" }}      passed
#     style={{ minWidth: "100vw" }}   passed — `minWidth` does not contain `width`
#     style={{width:"100vw"}}         passed
#
# The arm is now `[Ww]idth["']?:[[:space:]]*["']?[0-9]+vw` — the capital covers
# `minWidth`/`maxWidth`, and the optional quotes cover both the JSX form and a
# quoted key. Measured on all six shapes plus both `sizes` defaults:
#
#     the three above + w-[420px] + w-screen + w-[100vw]   -> all caught
#     "(min-width: 1024px) 33vw, … 100vw"                  -> not caught
#     "(min-width: 1024px) 60vw, 100vw"                    -> not caught
#     the whole tree with the new pattern                  -> 0 matches
#
# `min-width: 1024px` survives because the digits after the colon are followed
# by `px`, not `vw` — the arm still requires the unit, which is what keeps the
# `sizes` strings out.
#
# LATENT, NOT LIVE: `grep -rn "style={{" app components` returns 0 today. This
# restores a guard that had quietly weakened, it does not fix a live defect.
# NARROWED, 2026-08-16 — the `\b` was the bug. In `max-w-[1200px]` the hyphen
# before `w` is a non-word character, so `\b(w|min-w)-\[` matches INSIDE it, and
# the check counted every max-width in the tree as a fixed width. It also had no
# notion of breakpoint prefixes, so `sm:w-[390px]` — a width that only applies
# at 640 px and above, on a check whose entire subject is 375 px — counted too.
#
# Measured on this tree: 19 hits, and every single one was one of those two
# shapes. 18 `max-w-*`, which is the CORRECT idiom this check should want to
# see, plus one `sm:w-[390px]` toast that renders `inset-x-4` at the base. Zero
# real findings, 19 accusations — the loud-and-wrong failure mode, which gets a
# check deleted by the third person who has to re-derive that it is lying.
#
# A class token starts after whitespace or a quote. Requiring that boundary
# excludes `max-w-` (preceded by `-`) and every `sm:`/`md:`/`lg:` prefix
# (preceded by `:`), which is exactly the set that is not a base-layer width.
chk "no fixed width at or above 375 px, no viewport-width units" \
    "$(code | grep -cE '(^|[[:space:]"'"'"'`])(w|min-w)-\[(3[7-9][0-9]|[4-9][0-9]{2}|[0-9]{4,})px\]|(^|[[:space:]"'"'"'`])w-screen\b|(^|[[:space:]"'"'"'`])(w|min-w)-\[[0-9]+vw\]|[Ww]idth["'"'"']?:[[:space:]]*["'"'"']?[0-9]+vw' || true)" 0

# --- 4. Every button is deliberately sized ---------------------------------
# RE-AIMED, 2026-08-16. The V1 shape this named — components/ui/{button,input,
# amount-input}.tsx each setting `min-h-tap` — does not exist in V2 and neither
# does the utility. V2 renders buttons from two CSS classes in globals.css
# (`.btn-gold`, `.btn-ghost`), and NEITHER sets a min-height: the height comes
# from a per-call-site `h-*`.
#
# So the primitive-level guarantee is genuinely gone, and this check cannot
# honestly claim otherwise. What it asserts instead is the property V2 does
# hold — that no button is left unsized, which is the shape that would collapse
# under its own line-height. Measured: 27 call sites, 27 with an explicit
# height, 0 without.
#
# WHAT THIS DOES NOT ASSERT, SAID PLAINLY: that the height is >= 44 px.
# NFR-USA-08 wants 44; three call sites are below it (`h-9` twice, `h-8` once,
# `h-[38px]` once). Making that structural means putting `min-height: 44px` on
# the two classes, which CHANGES THE APPROVED DESIGN at those call sites — a
# product decision, and CLAUDE.md §2 rule 16 says a session does not make one
# in code. Raised with the owner rather than pinned here as an allowlist of
# three known-bad sites, which is the ignore §9 forbids.
chk "no btn-gold/btn-ghost call site is left unsized" \
    "$(grep -rnE 'btn-(gold|ghost)' app components --include='*.tsx' \
        | grep -vcE 'h-[0-9]+|h-\[[0-9]+px\]|min-h-' || true)" 0

# --- 5. The listing grid starts at one column -------------------------------
# FR-LIST at 375 px: a two-column grid of cards carrying an image, a name, a
# price and a countdown does not fit.
#
# RE-AIMED, 2026-08-16. V1 wrote `grid-cols-1` and widened upward at
# breakpoints. V2 states the same intent intrinsically — `auto-fill` with a
# `minmax(268px, 1fr)` track — which yields exactly one column at 375 px
# without naming a breakpoint at all, and keeps doing so if the card's minimum
# ever changes. Same requirement, stronger expression; the check follows it
# rather than demanding the older spelling of it.
chk "the listing grid collapses to one column at 375 px" \
    "$(grep -c 'grid-cols-\[repeat(auto-fill,minmax(268px,1fr))\]' app/page.tsx || true)" 1

# --- 6. Long user strings can break --------------------------------------
# A product name is up to 100 characters (FR-CREATE-04) and a display name is
# user-supplied; neither is guaranteed to contain a space. In a flex or grid
# child an unbreakable run cannot shrink below its own width unless something
# says it may, which is what `min-w-0`, `break-words` and `truncate` do.
#
# RE-AIMED, 2026-08-16: app/auctions/new/create-auction-form.tsx is a V1 path;
# V2's review step lives in the create wizard. The wizard renders the seller's
# own title back to them at step «مراجعة», so it is still the cell where an
# unbroken 100-character run would push the panel wider than the viewport.
# Asserted as "at least one", collapsed to 0/1. A raw line count would pin the
# check to today's number and go red on an unrelated edit that adds a second
# truncating cell — which trains the reader to bump the constant instead of
# reading the rule.
chk "the wizard's user-content cells can break a long word" \
    "$([ "$(grep -cE 'min-w-0|break-words|truncate' components/auction/create-wizard.tsx || true)" -ge 1 ] && echo 1 || echo 0)" 1

# ---------------------------------------------------------------------------
ran=$((pass + fail))
echo
echo "$pass passed, $fail failed, $ran of $EXPECTED checks reached"
if [ "$ran" -ne "$EXPECTED" ]; then
  echo "!! expected $EXPECTED checks, only $ran reached. Treating as failure."
  fail=$((fail + 1))
fi
echo
echo "NOT SHOWN: rendered layout at 375 px in a real browser. See"
echo "           docs/INT-06-responsive-375.md §3. #88 stays open on it."
[ "$fail" -eq 0 ] && echo "INT-06 (static half): PASS" || echo "INT-06 (static half): FAIL — $fail check(s)"
exit $([ "$fail" -eq 0 ] && echo 0 || echo 1)
