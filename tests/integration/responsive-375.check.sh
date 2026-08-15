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
chk "every rendered amount goes through <Money>" \
    "$(code components/ui/money.tsx | grep -vE 'placeholder=|sr-only|aria-' | grep -c 'formatSar(' || true)" 0

# --- 1b. Every rendered image goes through next/image ----------------------
#
# Same shape as the rule above, and the same reasoning. `next/image` is what
# produces a derivative instead of shipping the stored original, which is the
# whole of NFR-PERF-05 — "a listing thumbnail must not require downloading the
# full-resolution original". V-4 measured what a bare <img> costs: 56 MB for
# 100 thumbnails at the MOST compressible source tested, 566 MB at a photo-like
# one, against NFR-PERF-01's three seconds. Two thumbnails alone exceeded it.
#
# image-frame.tsx is the one component allowed to name the element, exactly as
# money.tsx is the one allowed to call formatSar. Anywhere else a bare <img>
# means an image that skipped the optimiser.
chk "every rendered image goes through next/image" \
    "$(code components/ui/image-frame.tsx | grep -cE '<img[[:space:]>]' || true)" 0

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
chk "no fixed width at or above 375 px, no viewport-width units" \
    "$(code | grep -cE '\b(w|min-w)-\[(3[7-9][0-9]|[4-9][0-9]{2}|[0-9]{4,})px\]|\bw-screen\b|\b(w|min-w)-\[[0-9]+vw\]|width:[[:space:]]*[0-9]+vw' || true)" 0

# --- 4. Interactive primitives carry the 44 px target -----------------------
# NFR-USA-08. Checked on the primitives rather than on every call site: these
# four are what every screen builds from, so a target regression here is a
# target regression everywhere.
chk "Button, Input, Textarea and AmountInput all set min-h-tap" \
    "$(grep -l 'min-h-tap' components/ui/button.tsx components/ui/input.tsx components/ui/amount-input.tsx 2>/dev/null | grep -c .)" 3

# --- 5. The listing grid starts at one column -------------------------------
# FR-LIST at 375 px: a two-column grid of cards carrying an image, a name, a
# price and a countdown does not fit. `grid-cols-1` first, widening upward, is
# what makes mobile the base layer rather than a special case.
chk "the listing grid is single-column before its first breakpoint" \
    "$(grep -c 'grid-cols-1' components/auction/active-listing.tsx || true)" 1

# --- 6. Long user strings can break --------------------------------------
# A product name is up to 100 characters (FR-CREATE-04) and a display name is
# user-supplied; neither is guaranteed to contain a space. In a flex or grid
# child an unbreakable run cannot shrink below its own width unless something
# says it may, which is what `min-w-0`, `break-words` and `truncate` do.
chk "the review panel's user-content cell can break a long word" \
    "$(grep -c 'min-w-0 break-words' app/auctions/new/create-auction-form.tsx || true)" 1

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
