#!/usr/bin/env bash
# ============================================================================
# G0A — the committed V2 contract is the document the owner approved.
#
#   ./tests/v2/contract.check.sh
#
# Needs nothing: no browser, no Docker, no node, no network.
#
# WHY THIS EXISTS
#
# docs/v2/ARCHITECTURE-V2.md carries a provenance header claiming that
# everything below a stated line is the owner's approved text, byte for byte,
# and it prints a SHA-256 and the exact command a reader can run to check.
#
# That is a number maintained by hand in a file nobody re-reads, which is the
# specific failure CLAUDE.md §9 was written about — twice, in two commits, by
# the session that had just finished writing the lesson down. A header that
# says "verify me" and is never verified is worse than one that says nothing:
# it reads as checked.
#
# So the digest is pinned HERE, in code, not read out of the document. If it
# were extracted from the header, a body edit plus a header edit would pass —
# which is the "rename the identifier to slip past the pattern" move that §9
# names as a worse outcome than the red build.
#
# Amending the contract is allowed. It costs a reviewed pull request that says
# what decision moved, and it moves EXPECTED_DIGEST below in the same commit.
# The guard does not stop the change; it stops the silent change.
#
# Keep EXPECTED in step with the chk() calls.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

CONTRACT="docs/v2/ARCHITECTURE-V2.md"

# The digest of the approved body, as the owner approved it on 2026-08-15.
EXPECTED_DIGEST="e9cd38c750b4502e02bfb41041d12249a64083df2e94f385460dea32d219e17e"

# The heading the approved document opens with. The body begins at this line;
# everything above it is the provenance header this repository added.
BODY_HEADING="# Dallal V2 — Approved Architecture and Execution Contract"

EXPECTED=5
pass=0
fail=0

# Trimmed before comparing: BSD `wc -l` pads and GNU `wc -l` does not, so an
# untrimmed comparison is green on one developer's machine and red on another's.
chk() { # label want got
  local want got
  want="$(printf '%s' "$2" | tr -d '[:space:]')"
  got="$(printf '%s' "$3" | tr -d '[:space:]')"
  if [ "$want" = "$got" ]; then
    pass=$((pass + 1))
    printf 'ok    %s\n' "$1"
  else
    fail=$((fail + 1))
    printf 'FAIL  %s\n        want: %s\n        got:  %s\n' "$1" "$want" "$got"
  fi
}

# A digest tool that is absent must not read as a passing check. `shasum` ships
# with macOS and with the CI image; `sha256sum` covers the rest.
if command -v shasum >/dev/null 2>&1; then
  digest() { shasum -a 256 | cut -d' ' -f1; }
elif command -v sha256sum >/dev/null 2>&1; then
  digest() { sha256sum | cut -d' ' -f1; }
else
  printf 'BROKEN  neither shasum nor sha256sum is available — this check cannot run\n'
  exit 1
fi

echo "==> G0A — the committed V2 contract matches the approved document"

# 1. The file is there at all. Without this the four checks below fail with
#    four confusing messages instead of one clear one.
if [ ! -f "$CONTRACT" ]; then
  printf 'FAIL  %s does not exist — the canonical V2 contract is missing\n' "$CONTRACT"
  exit 1
fi
chk "the canonical contract exists" "1" "1"

# 2. The approved body starts exactly where the header says it does. Found by
#    searching, not by trusting the number, so the two can disagree.
#
#    NOTE THE SHAPE, and do not "simplify" it back. The first draft branched on
#    a missing heading and printed its own bespoke FAIL line instead of the
#    labelled assertion. That is green-adjacent in the worst way: the suite
#    fails, so it looks fine, but the label never prints — and the negative
#    probe correctly reported BROKEN, meaning the assertion below had never
#    been shown to be reachable at all. Every chk() here now runs on every
#    path; a missing heading degrades to a sentinel VALUE, never to a
#    different code path.
start="$(grep -n -F -x -- "$BODY_HEADING" "$CONTRACT" | head -1 | cut -d: -f1)"

chk "the approved body heading is present exactly once, unmodified" \
  "1" "$(grep -c -F -x -- "$BODY_HEADING" "$CONTRACT")"

# 3. THE PIN. The body from that line hashes to what the owner approved.
if [ -n "$start" ]; then
  body_digest="$(tail -n +"$start" "$CONTRACT" | digest)"
else
  body_digest="body-heading-not-found"
fi
chk "the approved body is byte-identical to the document the owner signed off" \
  "$EXPECTED_DIGEST" "$body_digest"

# 4. The header quotes the same digest the pin uses. A header printing a
#    different hash from the one CI enforces sends a reader chasing a ghost.
chk "the header quotes the digest this check enforces" \
  "1" "$(grep -c -F -- "$EXPECTED_DIGEST" "$CONTRACT")"

# 5. The `tail -n +N` in the header's verify command is the real N. This is the
#    one a reader actually runs, and it is the one most likely to rot: the body
#    moves down by one line and every other assertion here still passes.
#
#    Match the offset ONLY, not the whole command: the first draft grepped the
#    full `tail -n +39 docs/v2/ARCHITECTURE-V2.md` and then pulled every digit
#    run out of it, which yielded "39" + "2" + "2" = 3922. The check caught it,
#    which is the argument for running a check before believing it.
hdr_n="$(grep -o -E 'tail -n \+[0-9]+' "$CONTRACT" | head -1 | tr -cd '0-9')"
chk "the header's copy-paste verify command names the real body offset" \
  "${start:-body-heading-not-found}" "${hdr_n:-missing}"

echo
echo "$pass passed · $fail failed · $EXPECTED expected"

if [ "$((pass + fail))" -ne "$EXPECTED" ]; then
  printf 'BROKEN  ran %s checks, expected %s — update EXPECTED\n' "$((pass + fail))" "$EXPECTED"
  exit 1
fi
[ "$fail" -eq 0 ] || exit 1
