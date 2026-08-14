// ============================================================================
// AUC-04 — server-side image type validation, by content (FR-CREATE-18, SEC-V5).
//
// Run:  node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON tests/auction/image-type.check.mjs
//
// Needs nothing but node (>= 22, for native TypeScript type-stripping). No
// Docker, no network, no credentials. Same shape as tests/auth/*.check.mjs.
//
// WHY THIS FILE EXISTS
//
// SEC-V5 is unusually specific: type must be validated server-side, "not by
// extension **or client-reported values**". Both halves of that sentence
// describe things an uploader chooses, and a test that only feeds this code
// well-formed files cannot tell the difference between reading the bytes and
// believing the label — both pass.
//
// So the assertions below are built around disagreement: bytes that say one
// thing while the label says another, in both directions. That is the only
// arrangement in which "which one decided?" has an observable answer.
// ============================================================================
import {
  SIGNATURE_BYTES,
  sniffImageType,
} from "../../lib/auctions/image-signature.ts";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  extensionFor,
  validateImage,
  validateImageSize,
  validateImageType,
} from "../../lib/auctions/validation.ts";

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

/** Rejected or not — never the wording. Messages are Mohammed's to restyle. */
const rejected = (message) => (message === undefined ? "accepted" : "rejected");

/* --------------------------------------------------------------------------
   Fixtures. Real container signatures, padded to SIGNATURE_BYTES so every
   case reaches the same code path — a short buffer would be rejected by the
   length guard rather than by the signature, which is a different assertion.
   -------------------------------------------------------------------------- */
const pad = (bytes) =>
  Uint8Array.from([...bytes, ...Array(Math.max(0, SIGNATURE_BYTES - bytes.length)).fill(0)]);

const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// "RIFF" + 4 size bytes + "WEBP" — the form type at offset 8 is the whole point.
const WEBP = pad([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
// Same RIFF container, different form type. A "RIFF"-only check accepts this.
const WAV = pad([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
const GIF = pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const PDF = pad([0x25, 0x50, 0x44, 0x46, 0x2d]);
// ELF. The file an "image/png" label is most likely to be lying about.
const ELF = pad([0x7f, 0x45, 0x4c, 0x46]);

const file = (bytes, type, size = bytes.length) => ({ type, size });

// ==========================================================================
// 1. The three accepted formats are recognised from their bytes alone.
// ==========================================================================
chk("FR-CREATE-16 JPEG is recognised by signature", sniffImageType(JPEG), "image/jpeg");
chk("FR-CREATE-16 PNG is recognised by signature", sniffImageType(PNG), "image/png");
chk("FR-CREATE-16 WebP is recognised by signature", sniffImageType(WEBP), "image/webp");

// ==========================================================================
// 2. Everything else is null. Never "probably fine", never the client's claim
//    as a fallback.
// ==========================================================================
chk("FR-CREATE-16 GIF is not an accepted format", sniffImageType(GIF), null);
chk("FR-CREATE-16 PDF is not an accepted format", sniffImageType(PDF), null);
chk("SEC-V5 an ELF binary is not an image", sniffImageType(ELF), null);
chk("SEC-V5 empty input is not an image", sniffImageType(new Uint8Array(0)), null);

// A RIFF container that is not WebP. This is the assertion that distinguishes
// checking the form type at offset 8 from checking "RIFF" and stopping — a WAV
// passes the lazy version and would be stored as image/webp.
chk("SEC-V5 a WAV is RIFF but not WebP", sniffImageType(WAV), null);

// Truncated: the signature is right as far as it goes and does not go far
// enough. startsWith() must fail closed rather than read past the end.
chk(
  "SEC-V5 a truncated PNG signature is refused",
  sniffImageType(Uint8Array.from([0x89, 0x50, 0x4e])),
  null,
);
chk(
  "SEC-V5 RIFF with no form type is refused",
  sniffImageType(Uint8Array.from([0x52, 0x49, 0x46, 0x46])),
  null,
);

// ==========================================================================
// 3. THE POINT — the label cannot promote or demote the bytes.
//
// The old server path was `!sniffed || sniffed !== image.type`. Under it the
// second assertion here failed: a real PNG labelled image/jpeg was rejected.
// The first assertion passed then and passes now, and that is the security
// half — it is what must never regress.
// ==========================================================================
chk("SEC-V5 an ELF labelled image/png stays unrecognised", sniffImageType(ELF), null);
chk("SEC-V5 a PNG labelled image/jpeg is still a PNG", sniffImageType(PNG), "image/png");
chk("SEC-V5 a PNG with no label at all is still a PNG", sniffImageType(PNG), "image/png");

// The stored extension follows the sniffed type, never the name or the label.
chk("FR-CREATE-18 extension follows the sniffed type (png)", extensionFor("image/png"), "png");
chk("FR-CREATE-18 extension follows the sniffed type (webp)", extensionFor("image/webp"), "webp");
chk("FR-CREATE-18 an unknown type never yields its own extension", extensionFor("image/gif"), "jpg");

// ==========================================================================
// 4. The split. validateImageSize is what the server runs; validateImageType
//    is the browser's mirror. The server must not reject on the label.
// ==========================================================================
chk(
  "SEC-V5 size check ignores an octet-stream label",
  rejected(validateImageSize(file(PNG, "application/octet-stream"))),
  "accepted",
);
chk(
  "SEC-V5 size check ignores an empty label",
  rejected(validateImageSize(file(PNG, ""))),
  "accepted",
);
chk(
  "FR-CREATE-16 the CLIENT mirror does reject an octet-stream label",
  rejected(validateImageType(file(PNG, "application/octet-stream"))),
  "rejected",
);

// FR-CREATE-17, both sides of the boundary. A rule tested only where it
// rejects passes just as well when it rejects everything.
chk(
  "FR-CREATE-17 exactly 5 MB is accepted",
  rejected(validateImageSize(file(PNG, "image/png", MAX_IMAGE_BYTES))),
  "accepted",
);
chk(
  "FR-CREATE-17 one byte over 5 MB is rejected",
  rejected(validateImageSize(file(PNG, "image/png", MAX_IMAGE_BYTES + 1))),
  "rejected",
);
chk(
  "FR-CREATE-17 a zero-byte file is rejected",
  rejected(validateImageSize(file(PNG, "image/png", 0))),
  "rejected",
);
chk("FR-CREATE-17 a missing file is rejected", rejected(validateImageSize(null)), "rejected");

// The combined form entry point still behaves as the form expects: size first,
// so an oversized file is named as oversized rather than as the wrong type.
chk(
  "EC-08 the form check reports size before type",
  validateImage(file(PNG, "application/octet-stream", MAX_IMAGE_BYTES + 1)) ===
    validateImageSize(file(PNG, "image/png", MAX_IMAGE_BYTES + 1))
    ? "size"
    : "type",
  "size",
);

// ==========================================================================
// 5. The accepted set is exactly three, and matches the bucket's
//    allowed_mime_types in 20260814120000_auc01_auction_product_fields.sql.
//    FR-CREATE-15/16: one image, three formats, no fourth added quietly.
// ==========================================================================
chk("FR-CREATE-16 exactly three formats are accepted", String(ACCEPTED_IMAGE_TYPES.length), "3");
chk(
  "FR-CREATE-16 the accepted set matches the bucket",
  ACCEPTED_IMAGE_TYPES.join(","),
  "image/jpeg,image/png,image/webp",
);
chk(
  "FR-CREATE-16 every accepted type is reachable from bytes",
  [JPEG, PNG, WEBP].map(sniffImageType).join(","),
  ACCEPTED_IMAGE_TYPES.join(","),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
