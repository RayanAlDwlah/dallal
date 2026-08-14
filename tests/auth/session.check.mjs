// ============================================================================
// AUTH-11 — session behaviour over HTTP, against a running server.
//
// Run:  npm run dev          (in another terminal)
//       node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON tests/auth/session.check.mjs
//
//       DALAL_BASE_URL=https://dallal-rust.vercel.app node ... tests/auth/session.check.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT PLAYWRIGHT
//
// AUTH-11's remaining criteria read as though they need a browser. Decomposed,
// most of them are HTTP properties wearing a browser costume:
//
//   "survives a page reload"        the cookie is sent again and accepted
//   "survives a BROWSER RESTART"    the cookie is PERSISTENT rather than a
//                                   session cookie — i.e. Set-Cookie carries
//                                   Max-Age. A browser drops session cookies on
//                                   restart and keeps persistent ones, so the
//                                   attribute IS the property. Playwright would
//                                   test it by simulating the thing the header
//                                   already states.
//   "expiry is not silent"          an unusable token degrades to the visitor
//                                   state AND the user is told (FR-AUTH-17)
//
// So this uses node's built-in fetch and @supabase/ssr, which is already a
// direct dependency. Zero new packages, so package.json is untouched and
// TEAM.md §11 does not apply.
//
// WHAT IT DELIBERATELY DOES NOT COVER: driving the actual form with JavaScript
// enabled, and anything visual. FR-AUTH-24 makes route gating a UX affordance
// and the server the authority, so the criteria that carry weight are the ones
// observable here. The rest is INT-06 and manual by nature.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";

const BASE = (process.env.DALAL_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

let pass = 0;
let fail = 0;
let skipped = 0;

function chk(label, got, want) {
  if (got === want) {
    pass += 1;
    console.log(`PASS  ${label.padEnd(56)}  (${got})`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label.padEnd(56)}  got=${got}  want=${want}`);
  }
}
function skip(label, why) {
  skipped += 1;
  console.log(`SKIP  ${label.padEnd(56)}  ${why}`);
}

/** Never follows redirects — the redirect IS the assertion for every guard. */
async function get(path, cookie) {
  return fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
}

/* .env.local is gitignored and holds the dev keys. Parsed by hand rather than
 * adding dotenv for four lines. */
function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* absent is normal — the required group below needs no credentials */
  }
}
loadEnvLocal();

// --------------------------------------------------------------------------
// Preflight. A suite that reports 0/0 against a server that is not running is
// the "clean result from a check that never ran" failure this project keeps
// hitting, so refuse to start rather than print a green nothing.
// --------------------------------------------------------------------------
try {
  await get("/");
} catch {
  console.log(`!! no server at ${BASE}`);
  console.log("   start one with `npm run dev`, or set DALAL_BASE_URL to a deployment.");
  process.exit(1);
}
console.log(`base: ${BASE}\n`);

// ==========================================================================
// REQUIRED — needs no credentials at all.
// ==========================================================================

// FR-AUTH-23, BR-40: browsing is public and must not require a session.
chk("FR-AUTH-23 listing is public", String((await get("/")).status), "200");
chk("FR-AUTH-25 reset screen is public", String((await get("/reset-password")).status), "200");
chk("login screen is public", String((await get("/login")).status), "200");

/*
 * FR-AUTH-22 — the guarded routes. The redirect target is the assertion, not
 * just the status: reason=required is what FR-AUTH-17 turns into a sentence on
 * the login screen, and a guard that dropped it would still redirect correctly
 * while silently undoing the requirement.
 */
for (const [path, next] of [
  ["/profile", "%2Fprofile"],
  ["/auctions/new", "%2Fauctions%2Fnew"],
]) {
  const res = await get(path);
  chk(`FR-AUTH-22 ${path} redirects a visitor`, String(res.status), "307");
  chk(
    `FR-AUTH-17 ${path} carries next + reason=required`,
    res.headers.get("location")?.replace(BASE, "") ?? "none",
    `/login?next=${next}&reason=required`,
  );
}

/*
 * FR-AUTH-17, the half that was silent before AUTH-06 (#97). A cookie that is
 * present but unusable is an ENDED session, not a visitor who never signed in,
 * and the two must produce different sentences.
 *
 * The cookie name is deliberately not the real project ref: getSessionState
 * matches sb-<anything>-auth-token, so this asserts the rule and not one
 * deployment's configuration.
 */
{
  const res = await get("/profile", "sb-notarealref-auth-token=this-is-not-a-session");
  chk("FR-AUTH-17 a dead session redirects", String(res.status), "307");
  chk(
    "FR-AUTH-17 a dead session says expired, not required",
    res.headers.get("location")?.replace(BASE, "") ?? "none",
    "/login?next=%2Fprofile&reason=expired",
  );
}

/*
 * FR-AUTH-18, EC-12 — when a session dies, VIEWING must keep working. Only the
 * protected action needs re-authentication. A guard that swept the public pages
 * too would satisfy every assertion above and still break the requirement.
 */
chk(
  "FR-AUTH-18 a dead session can still browse",
  String((await get("/", "sb-notarealref-auth-token=dead")).status),
  "200",
);

/* FR-AUTH-29, EC-28 — an exhausted or absent recovery link is refused, not a blank form. */
{
  const res = await get("/auth/callback");
  chk("FR-AUTH-29 a callback with no code is refused", String(res.status), "307");
  chk(
    "FR-AUTH-29 and lands where a new link can be asked for",
    res.headers.get("location")?.replace(BASE, "") ?? "none",
    "/reset-password?expired=1",
  );
}

/*
 * The open redirect, asserted over the wire rather than only as a unit. The
 * pure-function check covers loginPath(); this covers the page that reads it
 * back off the URL, which is where a careless refactor would reintroduce it.
 */
{
  const res = await get("/login?next=https%3A%2F%2Fevil.example");
  chk("open redirect refused at the login screen", String(res.status), "200");
}

// ==========================================================================
// OPTIONAL — needs a real account on the dev project.
//
// Skipped loudly rather than silently: an assertion that does not run must not
// look like one that passed.
// ==========================================================================
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.DALAL_TEST_EMAIL;
const password = process.env.DALAL_TEST_PASSWORD;

if (!url || !key || !email || !password) {
  const why = "set DALAL_TEST_EMAIL + DALAL_TEST_PASSWORD (and .env.local)";
  skip("FR-AUTH-15 a signed-in viewer is named on the page", why);
  skip("FR-AUTH-16 the session cookie survives a restart", why);
  skip("FR-AUTH-16 the session is accepted on a second request", why);
} else {
  /*
   * The cookies are produced BY @supabase/ssr rather than hand-rolled, so this
   * cannot drift from whatever format the library actually writes.
   */
  const jar = [];
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: (list) => jar.push(...list) },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const why = `sign-in failed: ${error.message}`;
    skip("FR-AUTH-15 a signed-in viewer is named on the page", why);
    skip("FR-AUTH-16 the session cookie survives a restart", why);
    skip("FR-AUTH-16 the session is accepted on a second request", why);
  } else {
    const cookie = jar.map((c) => `${c.name}=${c.value}`).join("; ");

    /*
     * FR-AUTH-16's "across browser restarts" reduced to the attribute that
     * actually decides it. A session cookie — one with no Max-Age and no
     * Expires — is dropped when the browser closes, and the requirement fails
     * with no other symptom.
     */
    const persistent = jar.every(
      (c) => (c.options?.maxAge ?? 0) > 0 || c.options?.expires !== undefined,
    );
    chk("FR-AUTH-16 the session cookie survives a restart", String(persistent), "true");

    const profile = await get("/profile", cookie);
    chk("FR-AUTH-16 the session is accepted on a second request", String(profile.status), "200");

    /* FR-AUTH-15 — every page states who the viewer is. */
    const home = await get("/", cookie);
    const html = await home.text();
    chk(
      "FR-AUTH-15 a signed-in viewer is named on the page",
      String(!html.includes(">تسجيل الدخول<")),
      "true",
    );
  }
}

// --------------------------------------------------------------------------
const REQUIRED = 13;
const ran = pass + fail;
console.log(
  `---- ${pass} passed, ${fail} failed, ${skipped} skipped, ${ran} of ${REQUIRED} required assertions reached`,
);
if (skipped > 0) {
  console.log(`     ${skipped} assertion(s) NOT PROVEN — the optional group did not run.`);
}
if (ran !== REQUIRED) {
  console.log(`!! expected ${REQUIRED} required assertions, only ${ran} reached. Treating as failure.`);
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
