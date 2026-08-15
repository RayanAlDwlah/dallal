"use client";

import { useActionState, useState, type ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { formatSarWithSuffix, trySar } from "@/lib/money";
import {
  ACCEPTED_IMAGE_TYPES,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  MAX_IMAGE_MB,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  validateDescription,
  validateEndTime,
  validateImage,
  validateName,
  validateStartingPrice,
} from "@/lib/auctions/validation";

import { createAuctionAction, type CreateAuctionState } from "./actions";

/**
 * AUC-01 — the creation form. AUC-03 — the review step and the intent key.
 *
 * Three structural choices, all required rather than stylistic:
 *
 *  - **Every field is controlled React state.** FR-CREATE-12 says the user's
 *    entered values must be preserved when validation fails, and React resets
 *    an *uncontrolled* form once a form action resolves. A 2000-character
 *    description must not evaporate because the image was the wrong type
 *    (EC-08). The file input is the sole exception: no browser lets a page
 *    repopulate one — so the chosen File is held in state and re-attached to
 *    the FormData on submit instead. See `imageFile` and `submit` below; the
 *    input stays empty after a rejection, the payload does not.
 *  - **The end time is submitted as an absolute instant.** The picker gives a
 *    naked wall-clock string with no zone, and the server would resolve it
 *    against ITS timezone — reading a Riyadh seller's 10:30 as 10:30 UTC. The
 *    hidden field below carries the instant the user actually meant.
 *  - **Publishing takes two deliberate steps** (AUC-03). See REVIEW below.
 *
 * Validation shown here is fast feedback, never the gate. The action re-runs
 * every one of these functions on the server, against the server clock
 * (BR-08, SEC-V6, FR-CREATE-11).
 *
 * ---------------------------------------------------------------------------
 * REVIEW — why the first click does not publish
 *
 * FR-CREATE-26a: "the creation form is the **only** opportunity to get an
 * auction right", because FR-CREATE-24 and FR-CREATE-25 remove editing and
 * cancellation. PRD.md:1094 turns that into a requirement on this screen —
 * "step 4 should give the seller a clear view of what they are about to
 * publish" — and EC-26 repeats it.
 *
 * A summary that sits permanently above the button satisfies the letter of
 * that and not its purpose: a control the seller never has to look at is a
 * control they will not look at. So the values are shown on a screen of their
 * own, and publishing is a second, separate decision.
 *
 * The two-step shape also does real work for EC-21, and it is worth being
 * precise about how much: the first click is now harmless, so an accidental
 * double-click on it cannot create anything at all. What it does NOT do is
 * make duplicate prevention a UI property — a double-click on the CONFIRM
 * button still issues two requests, and `submissionKey` below plus
 * auctions_one_per_submission are what make the second one a no-op.
 * ---------------------------------------------------------------------------
 */

/** The picker's value → an absolute instant. `""` when it is not yet a date. */
function toInstant(localValue: string): string {
  if (!localValue) return "";
  const parsed = new Date(localValue);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/*
 * `ar-SA` alone resolves numberingSystem to "arab" and renders ٢٠/٠٨/٢٠٢٦.
 * BR-42 requires Western digits. Same construction as components/auction/
 * countdown.tsx, which shows the same instant on the auction's own page —
 * the seller should recognise the string they approved here.
 */
function formatEndTime(instant: string): string {
  if (!instant) return "";
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(instant));
}

/**
 * EC-21 / AUC-03 — a fresh identifier for one publishing intent.
 *
 * `crypto.randomUUID()` needs a secure context. The fallback is not
 * decoration: on a non-secure origin it is the difference between a seller
 * being unable to publish at all and a seller publishing normally, and the
 * server rejects any key that is not a well-formed v4 UUID.
 *
 * Deliberately NOT generated during render or on the server. A value minted in
 * a server render is a value the framework may cache and hand to a second
 * visit, and two visits sharing one key would mean the seller's SECOND auction
 * silently redirecting to their first. Minting it here, from a user gesture,
 * has no such coupling.
 */
function newSubmissionKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  /* `?? 0` satisfies noUncheckedIndexedAccess; a 16-byte array always has both. */
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export function CreateAuctionForm() {
  const [state, formAction, pending] = useActionState<CreateAuctionState, FormData>(
    createAuctionAction,
    {},
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [imageName, setImageName] = useState<string | null>(null);

  /*
   * The File itself, not just its name — because React destroys the input.
   *
   * React resets the <form> once the action completes (react-dom's `r`
   * dispatcher calls requestFormReset, and the commit phase calls
   * form.reset()). Every controlled field is re-applied from state on the next
   * render and survives; a file input CANNOT be controlled, so the seller's
   * chosen file is gone and no browser lets a page put it back.
   *
   * Measured on 2026-08-15 against a live server: after a rejected submission
   * `input[name=image].files.length` was 0 while the page still read
   * "الملف المختار: watch.png" — `imageName` is state and survived. `incomplete`
   * consults `imageName`, so review stayed enabled, the seller confirmed again,
   * and the server answered "اختر صورة للمنتج." — an inescapable loop, with the
   * screen asserting the opposite of the truth at every turn.
   *
   * Keeping the File and re-attaching it in `submit` below is deterministic:
   * it does not depend on when the reset lands relative to an effect, and it
   * does not try to write back into a file input, which is not permitted.
   */
  const [imageFile, setImageFile] = useState<File | null>(null);

  /*
   * The review view is a REQUEST, not a fact — a server rejection revokes it.
   *
   * A rejection returns to the review screen, and every message it carries is
   * a `fieldErrors` entry rendered by a `Field` inside the `hidden` block
   * below, so the seller sees the confirm button do nothing at all. Measured
   * on 2026-08-15 against a live server: an end time that was valid when it
   * was typed and stale by the time it was confirmed came back as
   * `fieldErrors.endTime`, into a node with a 0x0 rect and a hidden ancestor.
   *
   * Dropping back to the fields is the fix rather than echoing the text above
   * the panel, because the message belongs against the input the seller has to
   * change and that is where `Field` already puts it. `reviewing` is DERIVED
   * rather than corrected after the fact: an effect that calls setState here
   * would be a cascading render, and React's own guidance is to compute it.
   *
   * The rejection is identified by the action-state object itself, so
   * `startReview` can dismiss the one it has already answered for and let the
   * seller back in. Nothing about the payload moves — the block is hidden,
   * never unmounted — and `submissionKey` is untouched, so this stays the same
   * intent being corrected rather than a second one.
   */
  const [reviewRequested, setReviewRequested] = useState(false);
  const [answeredRejection, setAnsweredRejection] = useState<CreateAuctionState | null>(
    null,
  );

  const serverRejected =
    state !== answeredRejection &&
    Boolean(state.fieldErrors && Object.values(state.fieldErrors).some(Boolean));

  const reviewing = reviewRequested && !serverRejected;

  /*
   * One key per intent, minted on the first move to review and kept across
   * every retry of that intent — including a server-side rejection, which
   * returns here without remounting. Going back to edit and returning does NOT
   * mint a new one: correcting a typo is the same intent.
   */
  const [submissionKey, setSubmissionKey] = useState("");

  /*
   * The end-time check is the one that has to read a clock, so it is computed
   * on the change EVENT and stored, not derived during render: `Date.now()` in
   * a render body is impure, and an "is this at least 5 minutes ahead?" answer
   * that silently changes on an unrelated re-render is precisely the instability
   * that rule exists to catch. It is also the honest place for it — the clock
   * this reads is the browser's, and the server re-checks against its own
   * (FR-CREATE-11).
   */
  const [endsAtError, setEndsAtError] = useState<string | undefined>(undefined);

  function changeEndsAt(value: string) {
    setEndsAt(value);
    setEndsAtError(value ? validateEndTime(toInstant(value), Date.now()) : undefined);
  }

  /*
   * Shown only once the field has content, so an untouched form is not covered
   * in red before the user has done anything wrong. `undefined` while empty
   * lets the server's message through on submit.
   */
  const liveErrors = {
    name: name ? validateName(name) : undefined,
    description: description ? validateDescription(description) : undefined,
    startingPrice: startingPrice ? validateStartingPrice(startingPrice) : undefined,
    endTime: endsAtError,
  };

  const errorFor = (key: keyof typeof liveErrors) =>
    liveErrors[key] ?? state.fieldErrors?.[key];

  /*
   * FR-CREATE-26a — the price is echoed in the canonical format (BR-43) while
   * editing as well as on the review screen. It is a PREVIEW, not a rewrite:
   * AmountInput never reformats what was typed (FR-BID-17), and the string
   * submitted is the string in the box.
   */
  const pricePreview = trySar(startingPrice);

  /*
   * What the review step refuses to advance past. The image is checked through
   * the same validator the action uses rather than by "did they pick a file",
   * so a 6 MB PNG is named as too large here instead of surviving to a failed
   * upload after the seller has already confirmed.
   *
   * This is the client mirror and is not the gate (SEC-V6): a crafted request
   * skips the review screen entirely and meets every one of these again on the
   * server, plus the database constraints underneath.
   */
  const [imageError, setImageError] = useState<string | undefined>(undefined);

  function changeImage(file: File | null) {
    setImageFile(file);
    setImageName(file?.name ?? null);
    setImageError(file ? validateImage(file) : undefined);
  }

  /*
   * Re-attach the retained File when the input has been emptied by the reset
   * described above. `formData.get("image")` on an empty file input is still a
   * File — an empty one — so the test is the size, not the presence.
   *
   * This never overrides a real choice: on the first submission, and after the
   * seller picks a different file, the input holds it and the branch is skipped.
   * The server re-validates either way (SEC-V6); this only stops the client
   * from silently sending nothing.
   */
  function submit(formData: FormData) {
    const inForm = formData.get("image");
    if (imageFile && (!(inForm instanceof File) || inForm.size === 0)) {
      formData.set("image", imageFile);
    }
    return formAction(formData);
  }

  const incomplete =
    !name ||
    !description ||
    !startingPrice ||
    !endsAt ||
    !imageName ||
    Boolean(liveErrors.name) ||
    Boolean(liveErrors.description) ||
    Boolean(liveErrors.startingPrice) ||
    Boolean(liveErrors.endTime) ||
    Boolean(imageError);

  function startReview() {
    /*
     * Re-read the clock here and not only on the change event: an end time
     * that was five minutes ahead when it was typed can be four by the time
     * the seller reaches this button, and `endsAtError` is only ever as fresh
     * as the last keystroke. Without this the seller bounces between the two
     * views — the server rejecting a time the client still believes in.
     */
    const endTimeNow = endsAt ? validateEndTime(toInstant(endsAt), Date.now()) : undefined;
    if (endTimeNow !== endsAtError) setEndsAtError(endTimeNow);
    if (incomplete || endTimeNow) return;
    if (!submissionKey) setSubmissionKey(newSubmissionKey());
    setAnsweredRejection(state);
    setReviewRequested(true);
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {/* FR-CREATE-24 / FR-CREATE-25 stated BEFORE the fields, not after the
          mistake: nothing on this page can be undone once it is published. */}
      <Alert tone="info">
        بعد النشر لا يمكن تعديل المزاد ولا إلغاؤه، ويستمر حتى وقت انتهائه. راجع
        البيانات قبل الإرسال.
      </Alert>

      {/*
        `hidden` rather than unmounted. Two reasons, and the second one is not
        optional: an unmounted file input loses the seller's chosen file, and no
        browser lets a page put it back (EC-08). A hidden field is still part of
        the form and still submits, so the review screen is a change of view,
        never a change of payload.
      */}
      <div hidden={reviewing} className="flex flex-col gap-5">
        <Field
          label="اسم المنتج"
          hint={`من ${NAME_MIN_LENGTH} إلى ${NAME_MAX_LENGTH} محرفًا.`}
          error={errorFor("name")}
          required
        >
          {(props) => (
            <Input
              {...props}
              name="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              /*
               * maxLength is the ONE field bound that is a real cap, and it is
               * FR-CREATE-04's, not a layout decision. Note that the amount field
               * below has no equivalent — a length cap there would be the price
               * ceiling BR-21 and SEC-R3 forbid.
               */
              maxLength={NAME_MAX_LENGTH}
            />
          )}
        </Field>

        <Field
          label="وصف المنتج"
          hint={`من ${DESCRIPTION_MIN_LENGTH} إلى ${DESCRIPTION_MAX_LENGTH} محرفًا.`}
          error={errorFor("description")}
          required
        >
          {(props) => (
            <Textarea
              {...props}
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={DESCRIPTION_MAX_LENGTH}
            />
          )}
        </Field>

        <Field
          label="سعر البداية"
          /*
           * Says what the starting price MEANS, because BR-29 is the product's
           * most confusable rule: the first bid may equal this amount exactly.
           * Getting that wrong is unfixable after publication (BR-31).
           */
          hint="أول مزايدة بهذا المبلغ بالضبط مقبولة. لا يوجد حد أعلى للسعر."
          error={errorFor("startingPrice")}
          required
        >
          {(props) => (
            <AmountInput
              {...props}
              name="startingPrice"
              value={startingPrice}
              onValueChange={setStartingPrice}
              placeholder="0.00"
            />
          )}
        </Field>

        {pricePreview && !errorFor("startingPrice") ? (
          <p className="text-ink-2 -mt-3 text-sm">
            سيُعرض السعر هكذا:{" "}
            <bdi className="num font-semibold">{formatSarWithSuffix(pricePreview)}</bdi>
          </p>
        ) : null}

        <Field
          label="وقت انتهاء المزاد"
          /* BR-38 — the permitted range is stated up front, not only on failure. */
          hint="بين 5 دقائق و7 أيام من الآن، بتوقيت جهازك."
          error={errorFor("endTime")}
          required
        >
          {(props) => (
            <>
              <Input
                {...props}
                type="datetime-local"
                value={endsAt}
                onChange={(event) => changeEndsAt(event.target.value)}
                /*
                 * The control's own digits, unlike everything else on the page,
                 * are laid out by the browser. `dir="ltr"` keeps the date and
                 * time segments in the order the picker expects; the page stays
                 * RTL around it (BR-42 — Western digits either way).
                 */
                dir="ltr"
                className="text-start"
              />
              {/* The absolute instant. See toInstant() above for why the picker's
                  own value must not be what the server parses. */}
              <input type="hidden" name="endTime" value={toInstant(endsAt)} />
            </>
          )}
        </Field>

        <Field
          label="صورة المنتج"
          hint={`صورة واحدة، بصيغة JPEG أو PNG أو WebP، وبحجم لا يتجاوز ${MAX_IMAGE_MB} ميجابايت.`}
          error={imageError ?? state.fieldErrors?.image}
          required
        >
          {(props) => (
            <>
              <Input
                {...props}
                name="image"
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                onChange={(event) => changeImage(event.target.files?.[0] ?? null)}
                className="py-2 file:me-3 file:rounded-md file:border-0 file:bg-sunk file:px-3 file:py-1.5 file:text-sm file:font-semibold"
              />
              {imageName ? (
                /* A filename is user-supplied and frequently Latin; unisolated it
                   flips the direction of the line it sits in (CLAUDE.md §3). */
                <p className="text-ink-2 text-xs">
                  الملف المختار: <bdi>{imageName}</bdi>
                </p>
              ) : null}
            </>
          )}
        </Field>
      </div>

      {reviewing ? (
        <ReviewPanel
          name={name}
          description={description}
          price={pricePreview ? formatSarWithSuffix(pricePreview) : startingPrice}
          endTime={formatEndTime(toInstant(endsAt))}
          imageName={imageName}
        />
      ) : null}

      {/* EC-21 — the intent, carried through every retry. See newSubmissionKey(). */}
      <input type="hidden" name="submissionKey" value={submissionKey} />

      {reviewing ? (
        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          {/*
            The only control in this component with type="submit". Everything
            before it is reversible; this is not (BR-30, BR-31).

            `loading` disables it for the whole round trip, which stops the
            easy double-click. It is not what makes EC-21 hold — a disabled
            button is a client-side courtesy and a crafted request ignores it.
            auctions_one_per_submission is the guarantee.
          */}
          <Button type="submit" loading={pending}>
            أكّد النشر
          </Button>
          <Button
            type="button"
            tone="secondary"
            /*
             * Not disabled while pending — but it cannot strand the seller
             * either: returning to the fields keeps the same submissionKey, so
             * if the in-flight submit did land, publishing again resolves to
             * that same auction rather than a second one.
             */
            onClick={() => setReviewRequested(false)}
          >
            رجوع للتعديل
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={startReview} disabled={incomplete}>
          راجع قبل النشر
        </Button>
      )}
    </form>
  );
}

/**
 * FR-CREATE-26a / PRD.md:1094 — what is about to become permanent.
 *
 * Every value the seller typed, rendered the way the auction will render it:
 * the price through the canonical formatter (BR-43) and the end time through
 * the same `Intl` construction the auction's own countdown uses. A review
 * screen that formats differently from the destination is a review screen that
 * can be read as approving something other than what publishes.
 */
function ReviewPanel({
  name,
  description,
  price,
  endTime,
  imageName,
}: {
  name: string;
  description: string;
  price: string;
  endTime: string;
  imageName: string | null;
}) {
  return (
    <section
      className="border-rule bg-sunk flex flex-col gap-4 rounded-lg border p-4"
      aria-labelledby="review-heading"
    >
      <h2 id="review-heading" className="text-ink text-md font-semibold">
        راجع قبل النشر
      </h2>

      {/*
        `info`, not `error` and not `race`. Nothing here has gone wrong, and
        DESIGN_SYSTEM.md §8.1 reserves the brass `race` tone for concurrency
        loss specifically. Dressing a normal confirmation in an alarm colour is
        how a real alarm stops being read.
      */}
      <Alert tone="info">
        بعد التأكيد يصبح المزاد مباشرًا، ولا يمكن تعديله ولا إلغاؤه ولا حذفه.
      </Alert>

      <dl className="flex flex-col gap-3 text-sm">
        <ReviewRow label="اسم المنتج">
          {/* Product names are routinely Latin; unisolated they flip the line. */}
          <bdi>{name}</bdi>
        </ReviewRow>

        <ReviewRow label="الوصف">
          {/* whitespace-pre-line: the seller's own line breaks are part of what
              they are approving, and collapsing them here would show them a
              different description from the one that publishes. */}
          <bdi className="whitespace-pre-line">{description}</bdi>
        </ReviewRow>

        <ReviewRow label="سعر البداية">
          {/* The currency indicator stays OUTSIDE the isolate (CLAUDE.md §3) —
              formatSarWithSuffix already returns the canonical "1,250.00 SAR",
              so the isolate wraps the whole rendered string exactly as Money
              does elsewhere. */}
          <bdi className="num font-semibold">{price}</bdi>
        </ReviewRow>

        <ReviewRow label="ينتهي في">
          <bdi className="num">{endTime}</bdi>
        </ReviewRow>

        <ReviewRow label="الصورة">
          <bdi>{imageName}</bdi>
        </ReviewRow>
      </dl>

      <p className="text-ink-2 text-xs">
        أول مزايدة بمبلغ <bdi className="num">{price}</bdi> بالضبط مقبولة.
      </p>
    </section>
  );
}

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
      <dt className="text-ink-2 shrink-0 sm:w-28">{label}</dt>
      <dd className="text-ink min-w-0 break-words">{children}</dd>
    </div>
  );
}
