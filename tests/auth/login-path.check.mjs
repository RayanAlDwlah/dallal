// ============================================================================
// loginPath() / safeLoginReason() — the login screen's URL contract.
//
// Run:  node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON tests/auth/login-path.check.mjs
//
// Needs nothing but node (>= 22, for native TypeScript type-stripping).
//
// The first group is the reason this file exists. AUTH-06 rebuilt loginPath()
// from string concatenation onto URLSearchParams to carry a second parameter,
// and the open-redirect guard rides on that function. A refactor that quietly
// stopped filtering `next` would look completely fine in review.
// ============================================================================
import { loginPath, safeLoginReason, safeNextPath } from "../../lib/auth/validation.ts";

let pass = 0;
let fail = 0;

function chk(label, got, want) {
  if (got === want) {
    pass += 1;
    console.log(`PASS  ${label.padEnd(50)}  (${got})`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label.padEnd(50)}  got=${got}  want=${want}`);
  }
}

// --------------------------------------------------------------------------
// The open redirect stays closed. An attacker-supplied `next` must never
// survive into the URL, with or without a reason alongside it.
// --------------------------------------------------------------------------
chk("absolute URL dropped", loginPath("https://evil.example"), "/login");
chk("protocol-relative dropped", loginPath("//evil.example"), "/login");
chk("scheme-less host dropped", loginPath("evil.example"), "/login");
chk(
  "absolute URL dropped, reason survives",
  loginPath("https://evil.example", "expired"),
  "/login?reason=expired",
);
chk("safeNextPath still rejects //host", safeNextPath("//evil.example"), null);
chk("safeNextPath still accepts a path", safeNextPath("/auctions/abc"), "/auctions/abc");

// --------------------------------------------------------------------------
// Ordinary shapes.
// --------------------------------------------------------------------------
chk("no arguments", loginPath(), "/login");
chk("null next", loginPath(null), "/login");
chk("path only", loginPath("/profile"), "/login?next=%2Fprofile");
chk("reason only", loginPath(null, "expired"), "/login?reason=expired");
chk(
  "path and reason together",
  loginPath("/auctions/new", "required"),
  "/login?next=%2Fauctions%2Fnew&reason=required",
);

/*
 * A `next` carrying its own query string must be encoded, not spliced. Without
 * encoding the `&` would start a new parameter on the login URL and the tail of
 * the path would be silently lost.
 */
chk(
  "next with a query string is encoded whole",
  loginPath("/auctions/abc?tab=history&x=1", "expired"),
  "/login?next=%2Fauctions%2Fabc%3Ftab%3Dhistory%26x%3D1&reason=expired",
);

// --------------------------------------------------------------------------
// The reason comes off the URL, so it is untrusted input like any other.
// --------------------------------------------------------------------------
chk("known reason accepted", safeLoginReason("expired"), "expired");
chk("the other known reason accepted", safeLoginReason("required"), "required");
chk("unknown reason rejected", safeLoginReason("gotcha"), null);
chk("empty rejected", safeLoginReason(""), null);
chk("null rejected", safeLoginReason(null), null);

const EXPECTED = 17;
const ran = pass + fail;
console.log(`---- ${pass} passed, ${fail} failed, ${ran} of ${EXPECTED} assertions reached`);
if (ran !== EXPECTED) {
  console.log(`!! expected ${EXPECTED} assertions, only ${ran} reached. Treating as failure.`);
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
