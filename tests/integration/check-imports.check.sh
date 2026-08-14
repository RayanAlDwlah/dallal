#!/usr/bin/env bash
# ============================================================================
# Every *.check.mjs must be able to LOAD (#147).
#
#   ./tests/integration/check-imports.check.sh
#
# Needs nothing: no node version floor, no browser, no Docker, no network.
#
# WHAT WENT WRONG, AND WHY A STATIC RULE
#
# tests/auction/image-type.check.mjs imports lib/auctions/validation.ts, which
# imported `@/lib/money`. Node does not read `paths` from tsconfig.json — not
# with --experimental-strip-types, not without — and there is no `imports` field
# in package.json and no `@` link in node_modules. So the file could not be
# loaded at all: ERR_MODULE_NOT_FOUND, no assertion ever ran, and
# tests/auction/run.sh was red on main from #136 until #147 found it.
#
# Note the exact rule, because a coarser one would be wrong. Type-stripping
# ERASES `import type`, so a TYPE-ONLY alias import is invisible to node and
# harmless — lib/realtime/ux-rules.ts has one today and its check runs fine. It
# is the VALUE import that node must resolve and cannot.
#
# The obvious alternative — actually load each check and see — cannot be the
# guard here: it needs node >= 22 for type-stripping, so on an older node it
# would either skip (a vacuous pass, the thing this repo has fixed three times)
# or fail for a reason unrelated to what it is testing. This rule is decidable
# on any node, which is the point.
#
# Keep EXPECTED in step with the chk() calls.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

EXPECTED=3
pass=0
fail=0

chk() {
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1)); printf 'PASS  %-58s (%s)\n' "$1" "$2"
  else
    fail=$((fail + 1)); printf 'FAIL  %-58s got=%s want=%s\n' "$1" "$2" "$3"
  fi
}

# Every lib/ file a check imports directly. One level: none of them re-exports
# another lib module today, and the day one does this list has to grow with it.
reachable() {
  grep -rh 'from "\.\./\.\./lib/' tests/*/*.check.mjs 2>/dev/null \
    | sed 's/.*from "\.\.\/\.\.\///; s/".*//' | sort -u
}

echo "==> check harness — every *.check.mjs can load (#147)"

n=$(reachable | wc -l)
chk "the harness reaches at least one lib module" "$([ "$n" -gt 0 ] && echo yes || echo no)" yes

# THE RULE. A value import through `@/` in any of these files stops its check
# from loading. `import type` is exempt because type-stripping removes it.
# One grep over the whole set. `-P` alone: the negative lookahead needs PCRE,
# and passing -E alongside it silently disables the pattern — which is how the
# first draft of this file reported PASS while matching nothing at all.
FILES=$(reachable | while read -r f; do [ -f "$f" ] && printf '%s ' "$f"; done)
VALUE_RE='^\s*import\s+(?!type\s)[^;]*from\s+"@/'

# shellcheck disable=SC2086
offenders=$(grep -hP "$VALUE_RE" $FILES 2>/dev/null | wc -l)
if [ "$offenders" -gt 0 ]; then
  # shellcheck disable=SC2086
  grep -nP "$VALUE_RE" $FILES 2>/dev/null | sed 's/^/      !! /'
fi
chk "no VALUE import through @/ in a check-reachable lib file" "$offenders" 0

# THE CONTROL for the rule above, and it has to be a real count.
#
# The exemption for `import type` is only trustworthy if some reachable file
# actually HAS one and the rule still passes — otherwise "value imports are
# banned, type imports are fine" is an untested claim, and a later tightening
# that banned both would look green here.
#
# lib/realtime/ux-rules.ts carries one today. If this ever reads 0, the
# exemption has stopped being exercised and the sentence above stops being
# evidence.
# Counted the same way, in one grep. `grep -c` per file was the other bug in
# the first draft: it exits 1 when the count is zero, so `... || echo 0`
# appended a SECOND line and the arithmetic that consumed it silently produced
# nothing.
# shellcheck disable=SC2086
typeonly=$(grep -hE '^\s*import\s+type\s+[^;]*from\s+"@/' $FILES 2>/dev/null | wc -l)
chk "a type-only @/ import exists, so the exemption is exercised" \
    "$([ "$typeonly" -ge 1 ] && echo yes || echo none)" yes

ran=$((pass + fail))
echo
echo "$pass passed, $fail failed, $ran of $EXPECTED checks reached"
if [ "$ran" -ne "$EXPECTED" ]; then
  echo "!! expected $EXPECTED checks, only $ran reached. Treating as failure."
  fail=$((fail + 1))
fi
[ "$fail" -eq 0 ] && echo "check-imports: PASS" || echo "check-imports: FAIL — $fail check(s)"
exit $([ "$fail" -eq 0 ] && echo 0 || echo 1)
