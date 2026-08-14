// ============================================================================
// AUTH-11 — lib/auth/validation.ts, the server-side registration gate.
//
// Run:  node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON tests/auth/validation.check.mjs
//
// Needs nothing but node (>= 22, for native TypeScript type-stripping). No
// Docker, no network, no credentials.
//
// FR-AUTH-05 makes these functions the gate: "Registration must be validated
// server-side. Client-side validation is a convenience only and must never be
// the sole gate." They were the only part of lib/auth/ with no coverage at all,
// which is the wrong file to leave untested — validateDisplayName is what keeps
// an email address out of public bid history (FR-AUTH-21).
//
// Boundaries are asserted from BOTH sides throughout. A rule tested only where
// it rejects passes just as well when it rejects everything.
// ============================================================================
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
  normalizeDisplayName,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from "../../lib/auth/validation.ts";

let pass = 0;
let fail = 0;

/** Asserts only whether a value was rejected — never the wording. */
function chk(label, got, want) {
  if (got === want) {
    pass += 1;
    console.log(`PASS  ${label.padEnd(54)}  (${got})`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label.padEnd(54)}  got=${got}  want=${want}`);
  }
}
const rejected = (msg) => (msg === undefined ? "accepted" : "rejected");

// --------------------------------------------------------------------------
// The constants the form displays and the database enforces. If these drift,
// the hint on the form stops matching the rule, and the DB CHECK stops matching
// both — FR-AUTH-04 requires the rule be stated before submission.
// --------------------------------------------------------------------------
chk("FR-AUTH-04 minimum password length is 8", String(PASSWORD_MIN_LENGTH), "8");
chk("FR-PROF-03 display name minimum is 2", String(DISPLAY_NAME_MIN_LENGTH), "2");
chk("FR-PROF-03 display name maximum is 50", String(DISPLAY_NAME_MAX_LENGTH), "50");

// --------------------------------------------------------------------------
// FR-AUTH-03 — email format.
// --------------------------------------------------------------------------
chk("FR-AUTH-03 ordinary address accepted", rejected(validateEmail("a@b.co")), "accepted");
chk("FR-AUTH-03 plus-addressing accepted", rejected(validateEmail("a+tag@b.co")), "accepted");
chk("FR-AUTH-03 subdomain accepted", rejected(validateEmail("a@mail.b.co")), "accepted");
chk("FR-AUTH-03 empty rejected", rejected(validateEmail("")), "rejected");
chk("FR-AUTH-03 no @ rejected", rejected(validateEmail("ab.co")), "rejected");
chk("FR-AUTH-03 no dot in domain rejected", rejected(validateEmail("a@b")), "rejected");
chk("FR-AUTH-03 internal space rejected", rejected(validateEmail("a b@c.co")), "rejected");
chk("FR-AUTH-03 surrounding space tolerated", rejected(validateEmail("  a@b.co  ")), "accepted");

// --------------------------------------------------------------------------
// FR-AUTH-04 — at least 8 characters. Length only: the PRD specifies no
// composition rule, and adding one would be an unrecorded product decision
// (TEAM.md rule 16). The two assertions below are what stop somebody
// "hardening" it later without changing the PRD in the same breath.
// --------------------------------------------------------------------------
chk("FR-AUTH-04 7 characters rejected", rejected(validatePassword("1234567")), "rejected");
chk("FR-AUTH-04 exactly 8 accepted", rejected(validatePassword("12345678")), "accepted");
chk("FR-AUTH-04 empty rejected", rejected(validatePassword("")), "rejected");
chk("FR-AUTH-04 all-digits 8 accepted", rejected(validatePassword("00000000")), "accepted");
chk("FR-AUTH-04 all-lowercase 8 accepted", rejected(validatePassword("abcdefgh")), "accepted");
chk("FR-AUTH-04 no symbol requirement", rejected(validatePassword("abcdefghij")), "accepted");

// --------------------------------------------------------------------------
// FR-PROF-03 — 2 to 50 characters, both boundaries inclusive.
// --------------------------------------------------------------------------
chk("FR-PROF-03 1 character rejected", rejected(validateDisplayName("x")), "rejected");
chk("FR-PROF-03 exactly 2 accepted", rejected(validateDisplayName("xy")), "accepted");
chk("FR-PROF-03 exactly 50 accepted", rejected(validateDisplayName("x".repeat(50))), "accepted");
chk("FR-PROF-03 51 rejected", rejected(validateDisplayName("x".repeat(51))), "rejected");
chk("FR-PROF-03 empty rejected", rejected(validateDisplayName("")), "rejected");

/*
 * BR-41 — the interface is Arabic, so a character is two or more bytes. Written
 * against a byte length instead of a character count this rule would pass every
 * Latin assertion above and silently cut the real limit to ~25 Arabic
 * characters. The same trap is asserted in acceptance.sql against the database
 * CHECK; this asserts it in the layer that rejects first.
 */
chk("BR-41 2 Arabic characters accepted", rejected(validateDisplayName("عب")), "accepted");
chk("BR-41 50 Arabic characters accepted", rejected(validateDisplayName("ع".repeat(50))), "accepted");
chk("BR-41 51 Arabic characters rejected", rejected(validateDisplayName("ع".repeat(51))), "rejected");

/*
 * FR-AUTH-21 — the display name is the ONLY public identity (BR-26) and appears
 * in bid history for every visitor. An address used as one publishes contact
 * details to the internet, so any address is refused, not merely the account's
 * own — the user cannot be trusted to be publishing only their own.
 */
chk("FR-AUTH-21 email as display name rejected", rejected(validateDisplayName("a@b.co")), "rejected");
chk("FR-AUTH-21 someone else's address rejected", rejected(validateDisplayName("ceo@bank.example")), "rejected");
chk("FR-AUTH-21 a name merely containing @ is fine", rejected(validateDisplayName("@dallal")), "accepted");

// --------------------------------------------------------------------------
// Trimming. The value stored is the trimmed one, so the DB CHECK sees what
// this function measured — otherwise "  x  " passes a 5-character test here and
// violates the 2-character minimum on insert.
// --------------------------------------------------------------------------
chk("whitespace-only rejected", rejected(validateDisplayName("   ")), "rejected");
chk("padded 1-character rejected", rejected(validateDisplayName("  x  ")), "rejected");
chk("normalize trims to what is stored", normalizeDisplayName("  عبدالرحمن  "), "عبدالرحمن");
chk("normalize leaves inner spaces alone", normalizeDisplayName(" Abu Bakr "), "Abu Bakr");

const EXPECTED = 32;
const ran = pass + fail;
console.log(`---- ${pass} passed, ${fail} failed, ${ran} of ${EXPECTED} assertions reached`);
if (ran !== EXPECTED) {
  console.log(`!! expected ${EXPECTED} assertions, only ${ran} reached. Treating as failure.`);
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
