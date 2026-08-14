#!/usr/bin/env bash
# ============================================================================
# INT-08 (#90) — the excluded-features audit, as a re-runnable check.
#
#   ./tests/integration/excluded-features.check.sh
#
# Needs nothing: no Docker, no node, no network, no credentials.
#
# WHY THIS IS NOT A WORD SEARCH
#
# PRD §19.0 and SD-05 exclude a list of features, and SC-67 asks that none was
# built. The obvious implementation — grep the tree for "reserve price" — is
# worse than useless HERE, because this repository documents its absences
# obsessively and on purpose. A plain search returns:
#
#   lib/auctions/detail.ts   "There is no Cancelled and no Draft (BR-30)"
#   design/DESIGN_SYSTEM.md  "no reserve-price field · no bid-increment stepper"
#   supabase/…auc18….sql     "NO 'cancelled' status — the CHECK admits exactly…"
#
# Every one of those is the guarantee working, quoted back as if it were a
# violation. A check that cannot tell "we did not build this" from "we built
# this" reports the healthiest files as the worst offenders, and the first
# person to run it adds an ignore list until it goes quiet.
#
# So this looks at IMPLEMENTATION SURFACES only, with comments stripped:
#
#   * routes            — a directory under app/ holding page.tsx or route.ts
#   * dependencies      — package.json
#   * identifiers       — .ts/.tsx/.sql with comments removed before matching
#   * user-facing text  — the one string ban (BR-33) is on rendered copy
#   * platform config   — supabase/config.toml for the auth flow
#
# KNOWN LIMIT, stated rather than discovered: comment stripping is textual.
# Block comments and whole-line comments go; a `--` inside a SQL string literal
# truncates that line early, so an identifier hidden after one would be missed.
# No such literal exists here, and the alternative is a SQL parser.
#
# Keep EXPECTED in step with the chk() calls.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

EXPECTED=17
pass=0
fail=0

chk() { # label  got  want
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1))
    printf 'PASS  %-62s (%s)\n' "$1" "$2"
  else
    fail=$((fail + 1))
    printf 'FAIL  %-62s got=%s want=%s\n' "$1" "$2" "$3"
  fi
}

# --- comment-stripped views of the code ------------------------------------
# Block comments always; whole-line // only, so that a URL inside a string
# cannot silently swallow the rest of its line and hide a violation with it.
code_ts() {
  find app components lib -name '*.ts' -o -name '*.tsx' 2>/dev/null | while read -r f; do
    perl -0777 -pe 's{/\*.*?\*/}{}gs; s{^\s*//[^\n]*$}{}gm' "$f"
  done
}
code_sql() {
  find supabase/migrations -name '*.sql' 2>/dev/null | while read -r f; do
    perl -0777 -pe 's{/\*.*?\*/}{}gs; s{--[^\n]*}{}g' "$f"
  done
}
count_ts() { code_ts | grep -ciE "$1" || true; }
count_sql() { code_sql | grep -ciE "$1" || true; }

echo "==> INT-08 — excluded features (PRD §19.0, SD-05, SC-67)"

# --- 1. Money movement -----------------------------------------------------
# The product is a demonstration: no money changes hands (CLAUDE.md §1). This
# is the largest excluded block and the one whose accidental arrival would be
# most obvious, so it is checked on three surfaces at once.
chk "no payment/checkout/cart/shipping route exists" \
    "$(find app -type d 2>/dev/null | grep -icE '/(pay|payment|checkout|cart|wallet|billing|ship|shipping|refund)$' || true)" 0
chk "no payment SDK is a dependency" \
    "$(node -p "Object.keys({...require('./package.json').dependencies,...(require('./package.json').devDependencies||{})}).filter(d=>/stripe|paypal|braintree|checkout|payment|moyasar|tap-?pay|hyperpay/i.test(d)).length")" 0
chk "no payment identifier in code" \
    "$(count_ts '\b(processPayment|createCheckout|chargeCard|cardNumber|payNow|refund[A-Z]|shippingAddress)\b')" 0

# --- 2. Messaging / contact exchange ---------------------------------------
# FR-DETAIL-21a and SC-67: the ended auction presents NO next step — no
# payment, no contact, no shipping. Contact exchange is also how an email
# would reach another user, which BR-26 forbids outright.
chk "no messaging or contact route exists" \
    "$(find app -type d 2>/dev/null | grep -icE '/(messages?|chat|inbox|contact|conversations?)$' || true)" 0
chk "no contact-the-seller identifier in code" \
    "$(count_ts '\b(sendMessage|contactSeller|messageWinner|openChat|revealEmail|sellerEmail)\b')" 0

# --- 3. Cancel, edit, draft ------------------------------------------------
# BR-30, BR-31, FR-CREATE-27. status has exactly two persisted values, and the
# CHECK is what makes that structural rather than conventional.
chk "no 'cancelled' or 'draft' status value in SQL" \
    "$(count_sql \"'(cancelled|canceled|draft)'\")" 0
chk "the status CHECK still admits exactly two values" \
    "$(code_sql | grep -c "status in ('active', 'ended')" || true)" 1
chk "no edit or cancel route exists" \
    "$(find app -type d 2>/dev/null | grep -icE '/(edit|cancel|delete)$' || true)" 0
chk "no auction update/delete call in code" \
    "$(count_ts '\.from\(("|.)auctions("|.)\)\s*\.(update|delete)\(')" 0

# --- 4. The three bidding checks that must not exist -----------------------
# CLAUDE.md §5 / ARCHITECTURE §13.2a. Their ABSENCE is the requirement, and
# re-adding one is classified as a bug rather than an improvement.
chk "no reserve price anywhere" \
    "$(( $(count_ts '\b(reserve_?price|reservePrice)\b') + $(count_sql '\breserve_?price\b') ))" 0
chk "no bid increment / minimum raise" \
    "$(( $(count_ts '\b(bid_?increment|bidIncrement|min_?raise|minRaise|increment_?step)\b') + $(count_sql '\b(bid_?increment|min_?raise)\b') ))" 0
chk "no price ceiling or max-bid identifier" \
    "$(( $(count_ts '\b(max_?price|maxPrice|MAX_BID|price_?cap|bid_?ceiling)\b') + $(count_sql '\b(max_?price|price_?cap|bid_?ceiling)\b') ))" 0
# The typmod ban is money's, and it is the most plausible-looking violation on
# the codebase (CLAUDE.md §4 rule 2), so it is asserted where the audit already
# has the comment-stripped SQL in hand.
chk "no numeric(P,S) typmod on any column" \
    "$(count_sql 'numeric\s*\(')" 0

# --- 5. Identity surfaces --------------------------------------------------
chk "email confirmation is off (no verification step)" \
    "$(grep -c '^enable_confirmations = false' supabase/config.toml || true)" 2
chk "no admin role or admin surface" \
    "$(( $(count_ts '\b(isAdmin|is_admin|requireAdmin|adminOnly)\b') + $(count_sql '\b(is_admin|admin_only)\b') + $(find app -type d 2>/dev/null | grep -icE '/admin$' || true) ))" 0

# --- 6. Currency copy ------------------------------------------------------
# BR-33 / PRD §19.0. The ban is on the RENDERED term, so design and docs may
# name it in order to prohibit it — this looks at code only.
chk "the term \"Demo Points\" appears in no rendered string" \
    "$(count_ts 'demo ?points|نقاط تجريبية')" 0

# --- 7. Native mobile ------------------------------------------------------
# PRD §1.1: this is responsive web. INT-06 validates 375 px in a BROWSER; a
# native artifact would mean someone read that as a mobile-app requirement.
chk "no native mobile artifact or toolchain" \
    "$(( $(ls -d android ios capacitor.config.* metro.config.* app.json 2>/dev/null | wc -l) + $(node -p "Object.keys({...require('./package.json').dependencies,...(require('./package.json').devDependencies||{})}).filter(d=>/react-native|capacitor|cordova|expo|ionic/i.test(d)).length") ))" 0

# ---------------------------------------------------------------------------
ran=$((pass + fail))
echo
echo "$pass passed, $fail failed, $ran of $EXPECTED checks reached"
if [ "$ran" -ne "$EXPECTED" ]; then
  echo "!! expected $EXPECTED checks, only $ran reached. Treating as failure."
  fail=$((fail + 1))
fi
[ "$fail" -eq 0 ] && echo "INT-08: PASS" || echo "INT-08: FAIL — $fail check(s)"
exit $([ "$fail" -eq 0 ] && echo 0 || echo 1)
