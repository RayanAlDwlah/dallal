"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/auth/identity";
import { loginPath } from "@/lib/auth/validation";
import { SIGNATURE_BYTES, sniffImageType } from "@/lib/auctions/image-signature";
import {
  IMAGE_BUCKET,
  MIN_DURATION_MS,
  extensionFor,
  isSubmissionKey,
  validateDescription,
  validateEndTime,
  validateImageSize,
  validateName,
  validateStartingPrice,
} from "@/lib/auctions/validation";

/**
 * AUC-01 — create an auction.
 *
 * ---------------------------------------------------------------------------
 * WHOSE WORK THIS IS
 *
 * AUC-01 is Mohammed's issue (#43) and CLAUDE.md §1 makes the whole of the
 * presentation his. This file is written by Rayan at @RayanAlDwlah's explicit
 * direction as project owner, announced on #43 and #51 before it existed, and
 * it is @m7ya505's to reject or rewrite. Same note as the head of
 * supabase/migrations/20260814120000_auc01_auction_product_fields.sql.
 * ---------------------------------------------------------------------------
 *
 * The order of operations, and why it is this order:
 *
 *   1. verify the session on the server              FR-CREATE-02, SEC-Z2
 *   2. validate EVERY field, report all failures     FR-CREATE-12
 *   3. sniff the image bytes                         FR-CREATE-18, SEC-V5
 *   4. settle an already-spent intent                EC-21, AUC-03
 *   5. upload                                        FR-CREATE-15 → 21
 *   6. insert, letting the policy be the authority   FR-CREATE-26, FR-CREATE-28
 *   7. settle the intent again if step 6 raced       EC-21, AUC-03
 *
 * Nothing here re-implements a rule the database already enforces. The
 * `auctions_owner_insert` policy pins owner_id to auth.uid(), forces
 * status='active' and current_price=starting_price, and rejects an end time
 * outside the 5-minute-to-7-day window — inside the database, where a request
 * that never touches this file still meets it (SEC-Z2). What this action adds
 * is the specific Arabic message per field that a bare 23514 cannot give.
 *
 * The starting price is a STRING from FormData to the wire. It is never parsed,
 * never rounded, never widened to a Number (S0-12 §1, §6).
 */

export interface CreateAuctionState {
  /** Form-level failure, shown above the fields. */
  error?: string;
  /** FR-CREATE-12 — every failing field, in one response. */
  fieldErrors?: {
    name?: string;
    description?: string;
    startingPrice?: string;
    endTime?: string;
    image?: string;
  };
}

/*
 * FR-CREATE-12 and EC-08 also require the user's entered values to survive a
 * rejection. They are NOT echoed back through this state: the form holds all
 * five in React state, so nothing is lost on a failed submit and there is no
 * second copy of the user's input travelling over the wire to be kept in sync.
 * The image is the one field a retry has to re-pick — a browser will not let a
 * server repopulate a file input — which is exactly why EC-08 is worded
 * "without re-entering the OTHER fields".
 */

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * EC-21 — the auction this intent already produced, or null.
 *
 * Reads through the owner's own id and the key together, which is the same
 * pair auctions_one_per_submission indexes. It cannot return another seller's
 * auction even if they somehow share a key: the key is not a secret (every
 * column of public.auctions is publicly readable, BR-40) and is deliberately
 * not treated as one.
 *
 * `id` only — nothing about the existing auction is echoed back to the caller
 * beyond the address they are about to be sent to.
 */
async function auctionForIntent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  submissionKey: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("auctions")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("submission_key", submissionKey)
    .maybeSingle<{ id: string }>();

  return data?.id ?? null;
}

export async function createAuctionAction(
  _prevState: CreateAuctionState,
  formData: FormData,
): Promise<CreateAuctionState> {
  /*
   * FR-CREATE-02 / SEC-Z2 — the owner is the session, full stop. There is no
   * owner field in this form and there must never be one: an owner_id accepted
   * from the client would let anyone list an auction in someone else's name.
   * getVerifiedUserId() revalidates the token with the auth server rather than
   * decoding a cookie (S0-10 — thing (2), not thing (1)).
   */
  const userId = await getVerifiedUserId();
  if (!userId) {
    redirect(loginPath("/auctions/new"));
  }

  const name = field(formData, "name").trim();
  const description = field(formData, "description").trim();
  const startingPrice = field(formData, "startingPrice").trim();

  /*
   * An absolute instant (`2026-08-15T07:30:00.000Z`), not the picker's naked
   * wall-clock string. `new Date("2026-08-15T10:30")` resolves against
   * whichever timezone the runtime is in, so parsing the picker value here
   * would read a Riyadh seller's 10:30 as 10:30 UTC on a Vercel server — a
   * silent three-hour error in the end time, on a value BR-31 makes permanent.
   * The form converts before submitting; FR-CREATE-14 keeps display local.
   *
   * The INSTANT is the user's input and legitimately comes from the client.
   * "Now", which the range is measured against, is server time and is read
   * below — that is what FR-CREATE-11 requires.
   */
  const endTime = field(formData, "endTime");

  const rawImage = formData.get("image");
  const image = rawImage instanceof File ? rawImage : null;

  /*
   * EC-21 / AUC-03 — which INTENT this submission belongs to.
   *
   * Minted by the form when the seller reaches the review step and resent
   * unchanged on every retry of that intent, so the second arrival of one
   * intent is recognisable as a replay rather than as a new auction.
   *
   * Shape-checked, not trusted: uniqueness is decided by
   * auctions_one_per_submission below. There is no Arabic message for this
   * because no seller can reach it — the form always sends a well-formed key,
   * so a malformed one is a crafted request or a bug.
   */
  const submissionKey = field(formData, "submissionKey").trim();
  if (!isSubmissionKey(submissionKey)) {
    return { error: "تعذّر إنشاء المزاد، ولم يُنشأ شيء. أعد تحميل الصفحة وحاول مرة أخرى." };
  }

  /*
   * All five validated before any one of them stops the function.
   * FR-CREATE-12 is explicit that the failures arrive together — reporting the
   * name this attempt and the description the next is the behaviour it exists
   * to forbid. FR-CREATE-26a explains why that matters more here than
   * elsewhere: with no edit (BR-31) and no cancel (BR-30), this form is the
   * only chance anyone gets to state the auction correctly.
   */
  const fieldErrors: CreateAuctionState["fieldErrors"] = {
    name: validateName(name),
    description: validateDescription(description),
    startingPrice: validateStartingPrice(startingPrice),
    endTime: validateEndTime(endTime, Date.now()), // FR-CREATE-11 — server clock
    /*
     * SIZE ONLY. The type is decided below, from the bytes.
     *
     * This used to be validateImage(), which also tests `file.type` — the
     * browser's claim. SEC-V5 rules that out in as many words ("not by
     * extension or client-reported values"), and it was not merely a wording
     * problem: it made the client's claim the FIRST gate, so a genuine PNG
     * arriving as `application/octet-stream` was refused with "the accepted
     * formats are…" and its signature was never read (FR-CREATE-18).
     */
    image: validateImageSize(image),
  };

  if (Object.values(fieldErrors).some(Boolean)) {
    return { fieldErrors };
  }

  /*
   * Non-null once validateImageSize() passed. Asserted rather than `!` so that
   * a future change to the validator cannot turn this into a runtime crash.
   */
  if (!image) return { fieldErrors: { image: "اختر صورة للمنتج." } };

  /*
   * FR-CREATE-18, SEC-V5 — the bytes decide the type. Nothing else does.
   *
   * `sniffed` is the single source of truth from here on: it selects the stored
   * `contentType` and the object's extension, and it is the only thing that can
   * reject on type. The request's own `image.type` is never consulted again.
   *
   * The check used to be `!sniffed || sniffed !== image.type` — the bytes AND
   * the client's label agreeing. That reads like belt and braces and is not:
   * the braces can only *reject* files the bytes have already approved. A real
   * PNG mislabelled by the sender was refused, and no attack was prevented,
   * because a sender who controls the label can always make it agree with the
   * bytes. Removing the comparison loses no security and stops rejecting valid
   * images.
   *
   * Read before the upload, so a rejected file never becomes a stored object at
   * all. The message names the accepted formats (EC-08) rather than lecturing
   * the user about their Content-Type header.
   */
  const header = new Uint8Array(await image.slice(0, SIGNATURE_BYTES).arrayBuffer());
  const sniffed = sniffImageType(header);
  if (!sniffed) {
    return { fieldErrors: { image: "الملف ليس صورة صالحة بصيغة JPEG أو PNG أو WebP." } };
  }

  const supabase = await createClient();

  /*
   * STEP 4 — EC-21: has this intent already produced an auction?
   *
   * This settles the RETRY case, which is the one PRD.md:1094 names: the
   * connection dropped during submit, the seller does not know whether it
   * landed, and they submit again. Their auction exists; they are sent to it,
   * exactly as a first-time success would send them. No error, because nothing
   * went wrong — their intent was fulfilled, they simply could not see it.
   *
   * THIS CHECK IS NOT THE GUARANTEE, and it is important not to read it as
   * one. Two concurrent requests from a double-click both reach this line
   * before either has inserted, so both find nothing and both continue. What
   * makes that safe is auctions_one_per_submission at the insert below; this
   * read only spares the retry path an upload it would otherwise orphan.
   */
  const alreadyCreated = await auctionForIntent(supabase, userId, submissionKey);
  if (alreadyCreated) {
    revalidatePath("/");
    redirect(`/auctions/${alreadyCreated}`);
  }

  /*
   * The object key. Two properties are load-bearing:
   *
   *   - the FIRST path segment is the uploader's own id. That is precisely what
   *     `auction_images_owner_insert` checks, and it is what makes FR-CREATE-21
   *     structural: an authenticated user cannot write into another user's
   *     prefix, so they cannot put an image on someone else's listing.
   *   - the filename is a fresh UUID, never the uploaded name. A user-supplied
   *     filename ends up in a public URL, carrying whatever the user put in it
   *     and dragging path characters into a key. The extension comes from the
   *     SNIFFED type, never from the name (FR-CREATE-18).
   */
  const imagePath = `${userId}/${crypto.randomUUID()}.${extensionFor(sniffed)}`;

  const { error: uploadError } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(imagePath, image, {
      contentType: sniffed,
      /*
       * Never overwrite. The key is a fresh UUID so a collision is not expected
       * — but `upsert: true` would turn any collision, including a deliberately
       * replayed key, into a silent replacement of a live auction's image,
       * which BR-31 forbids.
       */
      upsert: false,
    });

  if (uploadError) {
    /*
     * EC-08 / FR-CREATE-19 — no auction is created, the user is told plainly,
     * and every other field is still on screen, so the retry is one click in a
     * file picker.
     */
    return {
      error: "تعذّر رفع الصورة، ولم يُنشأ المزاد. اختر الصورة مرة أخرى وأعد المحاولة.",
    };
  }

  /*
   * FR-CREATE-26, FR-CREATE-28 — Active immediately, current price equal to the
   * starting price, empty history. `status` and `current_price` are sent
   * explicitly because the insert policy's WITH CHECK tests them; they are not
   * defaults being restated for decoration.
   *
   * winner_id / final_price / closed_at are absent by design: an outcome exists
   * only at close (FR-END-08) and is written by finalization alone (SEC-Z6).
   */
  const { data: created, error: insertError } = await supabase
    .from("auctions")
    .insert({
      owner_id: userId,
      status: "active",
      end_time: new Date(endTime).toISOString(),
      starting_price: startingPrice,
      current_price: startingPrice,
      name,
      description,
      image_path: imagePath,
      /* EC-21 — the intent this row belongs to. See STEP 4 and the migration. */
      submission_key: submissionKey,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !created) {
    /*
     * STEP 7 — EC-21: the insert lost a race with its own twin.
     *
     * This is the double-click path. Both requests passed STEP 4, both
     * uploaded, both inserted; the index let exactly one through and this is
     * the other one. The seller performed one intent and one auction exists,
     * so this is a SUCCESS being reported through an error channel — the
     * correct response is the same redirect the winner got, not a message
     * telling them something failed.
     *
     * Detected by re-reading the pair rather than by matching the constraint
     * name out of the error text: a 23505 could also come from
     * bids_one_per_price_level or a future constraint, and a string match
     * would quietly turn one of those into a bogus "success". If the intent
     * resolves to a row, the guarantee held; if it does not, this was some
     * other failure and it falls through to the messages below.
     */
    if (insertError?.code === "23505") {
      const settled = await auctionForIntent(supabase, userId, submissionKey);
      if (settled) {
        revalidatePath("/");
        redirect(`/auctions/${settled}`);
      }
    }

    /*
     * KNOWN GAP, stated rather than papered over. SEC-I6 asks for no partial
     * record AND no orphaned image; this path delivers the first and not the
     * second.
     *
     * The image cannot be deleted from here: there is deliberately no delete
     * policy on storage.objects (§4 of the AUC-01 migration), because a delete
     * policy a user can reach is also a delete policy for a LIVE auction's
     * image, and BR-30/BR-31 make that image as immutable as the price. Trading
     * a permanent integrity hole for orphan-file tidiness is the wrong way
     * round.
     *
     * What IS guaranteed is the half that can hurt someone: no partial auction.
     * Orphan cleanup is AUC-05's and runs as the table owner.
     */

    /*
     * AUC-02 / SC-68 — ONE rule can have become false since it was validated,
     * and only one: the end-time floor.
     *
     * validateEndTime ran against this process's clock at T1. The insert policy
     * re-evaluates `end_time >= now() + interval '5 minutes'` against the
     * DATABASE's clock at T2, and the upload happens in between — so T2 > T1
     * always. An auction the user set to exactly five minutes therefore passes
     * validation and is then refused by the policy, deterministically rather
     * than as a race. Every other field is immutable between the two checks.
     *
     * Re-reading it here is the same technique registerAction uses for the
     * display-name race: ask what is true NOW instead of guessing why the
     * database said no, so the message is accurate rather than plausible.
     *
     * Without this the user was told "try again" — and retrying could not
     * work, because their chosen end time is closer to now on every attempt.
     * Each retry also re-uploads, orphaning one more file.
     *
     * This does NOT make SC-68's "exactly 5 minutes accepted" true; nothing in
     * this file can. That is a contradiction between an inclusive boundary and
     * a check re-evaluated against a clock that has moved, and it is open for
     * the team on #44. What this fixes is the unrecoverable dead end.
     */
    if (Date.parse(endTime) - Date.now() < MIN_DURATION_MS) {
      return {
        fieldErrors: {
          endTime:
            "وقت الانتهاء أصبح قريبًا جدًا أثناء الإنشاء. اختر وقتًا أبعد — مدة المزاد تُقاس من لحظة الإنشاء، لا من لحظة تعبئة النموذج.",
        },
      };
    }

    return { error: "تعذّر إنشاء المزاد، ولم يُنشأ شيء. حاول مرة أخرى." };
  }

  /* The new auction has to be in the listing on the next render (FR-CREATE-26). */
  revalidatePath("/");

  /* FR-CREATE-29 — straight to the auction, live. */
  redirect(`/auctions/${created.id}`);
}
