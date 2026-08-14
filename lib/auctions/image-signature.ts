/**
 * What the file actually IS — FR-CREATE-18, SEC-V5.
 *
 * SEC-V5 is unusually specific: type must be validated server-side, "not by
 * extension **or client-reported values**". Both of the obvious checks fail
 * that sentence:
 *
 *   - the filename extension is chosen by the uploader;
 *   - `File.type` in a multipart body is the browser's `Content-Type` for that
 *     part, which is equally chosen by the uploader. A curl request can label
 *     an executable `image/png` and every `file.type === "image/png"` check in
 *     the product agrees with it.
 *
 * So the bytes are read. These are the container signatures, which are fixed
 * by the formats themselves and are not attacker-chosen without also changing
 * what the file is.
 *
 * This is NOT a claim that the file is a *safe* image — it is not a decoder and
 * it does not inspect anything past the header. It establishes that the stored
 * object is the type it is stored as, which is what stops a bucket that is
 * publicly readable (FR-CREATE-20) from serving something else under an image
 * content type.
 *
 * Server-only. Deliberately not imported by the form: the browser cannot do
 * this check meaningfully anyway, and keeping it out of the client bundle keeps
 * it obvious which side is the authority (BR-08, SEC-V6).
 */

/** How many leading bytes any signature below needs. */
export const SIGNATURE_BYTES = 12;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

/**
 * The MIME type the bytes say this is, or `null` for anything else.
 *
 * Returns only the three types FR-CREATE-16 accepts. An unrecognised
 * signature is `null` — never "probably fine", never the client's claim as a
 * fallback.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  // JPEG — SOI marker followed by the first segment's marker byte.
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";

  // PNG — the 8-byte signature, including the CRLF/EOF pair that exists to
  // detect exactly this kind of tampering.
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  // WebP — a RIFF container whose form type is "WEBP" at offset 8. Checking
  // "RIFF" alone would also accept WAV and AVI, which are RIFF containers too.
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && // "RIFF"
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8) // "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}
