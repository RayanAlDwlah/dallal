// ============================================================================
// siteOrigin() — the password-reset link's origin.
//
// Run:  node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON tests/auth/site-url.check.mjs
//
// Needs nothing but node (>= 22, for native TypeScript type-stripping). No
// Docker, no network, no credentials — this is pure logic and should stay
// cheap enough that nobody has a reason to skip it.
//
// The flag only silences a notice that lib/ has no "type" field in
// package.json. Plain `node tests/auth/site-url.check.mjs` runs identically and
// prints it; adding "type": "module" to package.json to remove it would change
// how every other file in the project is loaded, for a cosmetic line.
//
// Written as .mjs importing the .ts module so it runs under plain node while
// staying out of `tsc`'s include globs, which cover **/*.ts only. The module
// under test is the real one, not a copy.
// ============================================================================
import { siteOrigin } from "../../lib/auth/site-url.ts";

let pass = 0;
let fail = 0;

function chk(label, got, want) {
  if (got === want) {
    pass += 1;
    console.log(`PASS  ${label.padEnd(52)}  (${got})`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label.padEnd(52)}  got=${got}  want=${want}`);
  }
}

function env(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

/** The headers a request carries, including anything an attacker put there. */
function headers(init) {
  return new Headers(init);
}

const ATTACKER = "attacker.example";

// --------------------------------------------------------------------------
// The reason this function exists: a forged header must not reach the email.
// --------------------------------------------------------------------------
env("NODE_ENV", "production");
env("SITE_URL", "https://dallal-rust.vercel.app");

chk(
  "forged Host ignored in production",
  siteOrigin(headers({ host: ATTACKER })),
  "https://dallal-rust.vercel.app",
);

chk(
  "forged X-Forwarded-Host ignored in production",
  siteOrigin(headers({ host: ATTACKER, "x-forwarded-host": ATTACKER })),
  "https://dallal-rust.vercel.app",
);

chk(
  "forged X-Forwarded-Proto cannot downgrade the scheme",
  siteOrigin(headers({ "x-forwarded-proto": "http", "x-forwarded-host": ATTACKER })),
  "https://dallal-rust.vercel.app",
);

// --------------------------------------------------------------------------
// Unset in production: refuse. A fallback here would restore the whole hole,
// and it would do it silently, on exactly the deployment that forgot to
// configure itself.
// --------------------------------------------------------------------------
env("SITE_URL", undefined);
chk(
  "unset in production returns null, no header fallback",
  siteOrigin(headers({ host: ATTACKER, "x-forwarded-host": ATTACKER })),
  null,
);

chk("empty string is treated as unset", (env("SITE_URL", "   "), siteOrigin(headers({ host: ATTACKER }))), null);

// --------------------------------------------------------------------------
// A malformed or hostile SITE_URL must not become an origin either. The value
// is trusted less than "it came from config" would suggest.
// --------------------------------------------------------------------------
env("SITE_URL", "javascript:alert(1)");
chk("javascript: rejected", siteOrigin(headers({})), null);

env("SITE_URL", "file:///etc/passwd");
chk("file: rejected", siteOrigin(headers({})), null);

env("SITE_URL", "dallal-rust.vercel.app");
chk("scheme-less value rejected", siteOrigin(headers({})), null);

env("SITE_URL", "https://user:pw@dallal-rust.vercel.app");
chk(
  "credentials stripped from the origin",
  siteOrigin(headers({})),
  "https://dallal-rust.vercel.app",
);

// --------------------------------------------------------------------------
// Normalisation — the value is pasted into a dashboard by a human, so the
// shapes a human actually types have to work.
// --------------------------------------------------------------------------
env("SITE_URL", "https://dallal-rust.vercel.app/");
chk("trailing slash normalised", siteOrigin(headers({})), "https://dallal-rust.vercel.app");

env("SITE_URL", "https://dallal-rust.vercel.app/some/path?x=1");
chk("path and query normalised away", siteOrigin(headers({})), "https://dallal-rust.vercel.app");

env("SITE_URL", "  https://dallal-rust.vercel.app  ");
chk("surrounding whitespace trimmed", siteOrigin(headers({})), "https://dallal-rust.vercel.app");

// --------------------------------------------------------------------------
// Development: `next dev` has no fixed public URL, so Host is used — but
// X-Forwarded-Host still is not, because nothing legitimately sets it here.
// --------------------------------------------------------------------------
env("NODE_ENV", "development");
env("SITE_URL", undefined);

chk("dev falls back to Host", siteOrigin(headers({ host: "localhost:3000" })), "http://localhost:3000");

chk(
  "dev still ignores X-Forwarded-Host",
  siteOrigin(headers({ host: "localhost:3000", "x-forwarded-host": ATTACKER })),
  "http://localhost:3000",
);

chk("dev with no Host at all returns null", siteOrigin(headers({})), null);

env("SITE_URL", "https://dallal-rust.vercel.app");
chk(
  "configured value still wins in development",
  siteOrigin(headers({ host: "localhost:3000" })),
  "https://dallal-rust.vercel.app",
);

// --------------------------------------------------------------------------
// A run that aborts partway prints neither PASS nor FAIL, so a clean-looking
// result can mean assertions never executed. Count them.
// --------------------------------------------------------------------------
const EXPECTED = 16;
const ran = pass + fail;
console.log(`---- ${pass} passed, ${fail} failed, ${ran} of ${EXPECTED} assertions reached`);

if (ran !== EXPECTED) {
  console.log(`!! expected ${EXPECTED} assertions, only ${ran} reached. Treating as failure.`);
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
