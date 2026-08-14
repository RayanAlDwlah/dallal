// ============================================================================
// INT-01 / CP-1 — identity flows end to end, against a real Supabase project.
//
// Run:  DALAL_E2E_CONFIRM_WRITES=1 \
//       node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON tests/auth/identity-e2e.check.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, which
// .env.local carries. Nothing else.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS, AND WHY IT IS NOT A BROWSER TEST
//
// CP-1's criteria are: a user registers, signs in, and creates an auction
// ATTRIBUTED TO THEM, and a crafted request naming a different owner is
// attributed to the caller instead (SC-39). Every one of those is a property of
// the identity path, not of any screen — so driving a browser would test
// Mohammed's forms on the way to testing something else, and would fail for
// presentation reasons that have nothing to do with attribution.
//
// What it deliberately does NOT cover: the creation FORM (AUC-01's UI), image
// upload to storage, and anything visual. Those are INT-06 and manual by nature.
// The crafted request here goes straight at PostgREST, which is what a real
// attacker would do and what the RLS policy actually has to survive.
//
// ---------------------------------------------------------------------------
// IT WRITES, AND WHAT IT WRITES CANNOT BE DELETED
//
// Registration creates a real account. Creating an auction creates a real row
// that NOTHING in this product can remove: there is no delete policy on
// `auctions` for any role, and no cancel (BR-30, BR-31). That is the behaviour
// under test, not a limitation to work around.
//
// So: the writes are gated behind DALAL_E2E_CONFIRM_WRITES=1, and the script
// REFUSES to run against the production project ref outright. A permanent test
// auction in `dallal-prod` would be indistinguishable from a real one and
// equally unremovable.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/* `dallal-prod` (docs/supabase-cli.md). Never a target for a suite that writes. */
const PROD_REF = "yfszokbunbqesigdfuwk";

let pass = 0;
let fail = 0;

function chk(label, got, want) {
  if (got === want) {
    pass += 1;
    console.log(`PASS  ${label.padEnd(58)}  (${got})`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label.padEnd(58)}  got=${got}  want=${want}`);
  }
}

/* Same hand-rolled .env.local read as session.check.mjs — no dotenv for four lines. */
function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* absent is normal; the checks below report what is missing */
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/*
 * There is no "unconfigured" mode. A suite that exits 0 having asserted nothing
 * is the failure this project keeps meeting — every other harness here carries
 * an EXPECTED count for the same reason. If it cannot verify CP-1, it fails.
 */
if (!url || !key) {
  console.log("!! NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set.");
  console.log("   They live in .env.local — see docs/supabase-cli.md.");
  process.exit(1);
}
if (url.includes(PROD_REF)) {
  console.log(`!! refusing to run against dallal-prod (${PROD_REF}).`);
  console.log("   This suite registers an account and creates an auction, and neither");
  console.log("   can be deleted afterwards (BR-30, BR-31). Point it at dallal-dev.");
  process.exit(1);
}
if (process.env.DALAL_E2E_CONFIRM_WRITES !== "1") {
  console.log("!! this suite WRITES to the target project, permanently.");
  console.log("   It registers one account and creates one auction. Nothing in the");
  console.log("   product can delete either afterwards — that immutability is the");
  console.log("   behaviour under test (BR-30, BR-31), not an oversight.");
  console.log("   Re-run with DALAL_E2E_CONFIRM_WRITES=1 if that is what you want.");
  process.exit(1);
}

console.log(`project: ${url}\n`);

/*
 * A fresh identity per run. CP-1's first criterion is REGISTRATION, so reusing
 * an existing account would skip the half the checkpoint exists to prove.
 * The stamp is passed in rather than generated from a clock inside an assertion,
 * so a rerun never collides with a previous one.
 */
const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const email = `dalal-cp1-${stamp}@example.com`;
const password = `Cp1-${stamp}-Aa1!`;
const displayName = `cp1_${stamp}`.slice(0, 30);

const anon = () => createClient(url, key, { auth: { persistSession: false } });

// ==========================================================================
// 1. Registration — FR-AUTH-01, FR-PROF-02
// ==========================================================================
const signUpClient = anon();
const { data: signUp, error: signUpError } = await signUpClient.auth.signUp({
  email,
  password,
  /*
   * Carried into raw_user_meta_data, where the signup trigger reads it to build
   * the profile row IN THE SAME TRANSACTION as the account. Asserting the
   * profile below is therefore asserting that structure, not a later write.
   */
  options: { data: { display_name: displayName } },
});

if (signUpError) {
  console.log(`!! registration failed: ${signUpError.message}`);
  console.log("   FR-AUTH-07: email confirmation must be OFF for signUp to return a");
  console.log("   live session. If it is on, that is the finding, not this script.");
  process.exit(1);
}

const userId = signUp.user?.id ?? null;
chk("FR-AUTH-01 registration returns an account", String(userId !== null), "true");
chk("FR-AUTH-07 registration returns a live session, no email step",
  String(signUp.session !== null), "true");

// ==========================================================================
// 2. Sign-in — FR-AUTH-08. A separate client, so this proves the credentials
//    work rather than reusing the session signUp already handed back.
// ==========================================================================
const user = anon();
const { data: signIn, error: signInError } = await user.auth.signInWithPassword({
  email,
  password,
});
chk("FR-AUTH-08 the registered credentials sign in", String(signInError === null), "true");
chk("FR-AUTH-19 the signed-in id is the registered id",
  String(signIn?.user?.id === userId), "true");

// ==========================================================================
// 3. The profile — FR-PROF-02, BR-26. Read as the SIGNED-IN user.
// ==========================================================================
const { data: profile } = await user
  .from("profiles")
  .select("id, display_name")
  .eq("id", userId)
  .maybeSingle();

chk("FR-PROF-02 a profile exists for the new account",
  String(profile !== null), "true");
chk("FR-PROF-02 it carries the display name given at registration",
  profile?.display_name ?? "none", displayName);

/*
 * CLAUDE.md §6 — email is never in a public read. The guarantee is structural
 * (profiles has no email column), so this asserts the STRUCTURE rather than one
 * value: no column of the row may contain an address. A future join that
 * reintroduced email would fail here even if it named the column something else.
 */
const profileText = JSON.stringify(profile ?? {});
chk("CLAUDE.md §6 no email address in the profile read",
  String(profileText.includes("@")), "false");

// ==========================================================================
// 4. Attribution — FR-CREATE-02, SEC-Z2. The auction is created through
//    PostgREST with the user's own token, which is the path a crafted request
//    takes too; §5 then changes exactly one field.
// ==========================================================================
/*
 * end_time is now + 30 minutes, not now + 5. The policy tests
 * `end_time >= now() + interval '5 minutes'` against the DATABASE clock, while
 * this value is built from Node's — the two-clock gap measured on #44/#108. At
 * exactly five minutes the insert is refused deterministically. A margin keeps
 * this suite testing ATTRIBUTION rather than re-testing that defect.
 */
const endTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

/* Amounts are strings from end to end and are never parsed (S0-12 §1, §6). */
const STARTING_PRICE = "1250.00";

const auctionRow = {
  status: "active",
  end_time: endTime,
  starting_price: STARTING_PRICE,
  current_price: STARTING_PRICE, // BR-13 — the insert policy's WITH CHECK tests this
  name: `مزاد تحقّق ${stamp}`,
  description: "صف تحقّق آلي لنقطة التفتيش CP-1. لا يمثّل منتجًا حقيقيًا.",
  image_path: `${userId}/cp1-${stamp}.jpg`,
};

const { data: created, error: createError } = await user
  .from("auctions")
  .insert({ ...auctionRow, owner_id: userId })
  .select("id, owner_id, starting_price::text, current_price::text")
  .single();

chk("FR-CREATE-02 the signed-in user can create an auction",
  String(createError === null), "true");
chk("FR-CREATE-02 it is attributed to the creator",
  created?.owner_id ?? "none", String(userId));

/*
 * ::text on both money columns. Without it PostgREST serialises `numeric` as an
 * unquoted JSON number and JSON.parse corrupts it before this line runs — with
 * none of our code on the stack (#103, CLAUDE.md §4 rule 7). Comparing as
 * strings is also the only comparison the money contract allows.
 */
chk("S0-12 §6 the starting price survives transport exactly",
  created?.starting_price ?? "none", STARTING_PRICE);
chk("BR-13 the price is born equal to the starting price",
  created?.current_price ?? "none", STARTING_PRICE);

// ==========================================================================
// 5. SC-39 — the crafted request. One field differs from §4: an owner_id that
//    is not the caller. Everything else is a row the database just accepted,
//    so a rejection here can only be about attribution.
// ==========================================================================
const OTHER_OWNER = "00000000-0000-0000-0000-0000000000ff";

const { data: crafted, error: craftedError } = await user
  .from("auctions")
  .insert({ ...auctionRow, owner_id: OTHER_OWNER, image_path: `${OTHER_OWNER}/x-${stamp}.jpg` })
  .select("id")
  .maybeSingle();

chk("SC-39 a crafted owner_id is refused", String(craftedError !== null), "true");
chk("SC-39 and nothing was written", String(crafted === null), "true");
/*
 * 42501 is insufficient_privilege — the RLS policy refusing, which is the
 * mechanism SEC-Z2 names. A different code would mean the row was stopped by
 * something else (a CHECK, a FK) and SC-39 would be passing by accident.
 */
chk("SC-39 refused by the row policy, not by something else",
  craftedError?.code ?? "none", "42501");

// ==========================================================================
// 6. The auction as the public sees it — BR-40, and §6 again on the read path
//    that actually reaches visitors.
// ==========================================================================
const visitor = anon();
const { data: publicRead } = await visitor
  .from("auctions")
  .select("id, owner_id, name, starting_price::text, owner:profiles!auctions_owner_id_fkey(display_name)")
  .eq("id", created?.id ?? "00000000-0000-0000-0000-000000000000")
  .maybeSingle();

chk("BR-40 an anonymous visitor can read the auction",
  String(publicRead !== null), "true");
chk("BR-26 the seller is named by display name",
  publicRead?.owner?.display_name ?? "none", displayName);
chk("CLAUDE.md §6 no email address in the public auction read",
  String(JSON.stringify(publicRead ?? {}).includes("@")), "false");

// --------------------------------------------------------------------------
const EXPECTED = 17;
const ran = pass + fail;
console.log(`\n---- ${pass} passed, ${fail} failed, ${ran} of ${EXPECTED} assertions reached`);
console.log(`     account ${email} and its auction are permanent — see the header.`);

/*
 * The account this run created is a usable fixture for session.check.mjs, whose
 * three FR-AUTH-15/16 assertions skip without credentials. Printed as a
 * ready-to-run line rather than as two values to transcribe: the first attempt
 * at doing this by hand was run with the placeholder still in it, and the suite
 * reported a clean 13/13 with three SKIPs — which reads like a pass at a glance.
 *
 * No exposure is added by printing the password: the account is disposable, it
 * lives only on the dev project this script refuses to point at production, and
 * the value is already derivable from the email above plus this file.
 */
if (fail === 0) {
  /*
   * Printed with DALAL_BASE_URL already filled in when this run was given one,
   * because a line with one placeholder left in it is a line that gets run with
   * the placeholder still in it — twice, so far.
   */
  const base = process.env.DALAL_BASE_URL;
  console.log("\n     to run the three credentialed assertions in session.check.mjs:");
  if (base) {
    console.log(
      `     DALAL_TEST_EMAIL=${email} DALAL_TEST_PASSWORD='${password}' DALAL_BASE_URL=${base} node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON tests/auth/session.check.mjs`,
    );
  } else {
    console.log("     (re-run this suite with DALAL_BASE_URL set to a preview deployment");
    console.log("      and the whole command is printed here, ready to paste)");
  }
}
if (ran !== EXPECTED) {
  console.log(`!! expected ${EXPECTED} assertions, only ${ran} reached. Treating as failure.`);
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
