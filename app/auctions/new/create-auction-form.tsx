"use client";

import { useActionState, useState } from "react";

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
  validateName,
  validateStartingPrice,
} from "@/lib/auctions/validation";

import { createAuctionAction, type CreateAuctionState } from "./actions";

/**
 * AUC-01 — the creation form. Mohammed's issue (#43); see the header of
 * ./actions.ts for why it is in this branch.
 *
 * Two structural choices, both required rather than stylistic:
 *
 *  - **Every field is controlled React state.** FR-CREATE-12 says the user's
 *    entered values must be preserved when validation fails, and React resets
 *    an *uncontrolled* form once a form action resolves. A 2000-character
 *    description must not evaporate because the image was the wrong type
 *    (EC-08). The file input is the sole exception: no browser lets a page
 *    repopulate one.
 *  - **The end time is submitted as an absolute instant.** The picker gives a
 *    naked wall-clock string with no zone, and the server would resolve it
 *    against ITS timezone — reading a Riyadh seller's 10:30 as 10:30 UTC. The
 *    hidden field below carries the instant the user actually meant.
 *
 * Validation shown here is fast feedback, never the gate. The action re-runs
 * every one of these functions on the server, against the server clock
 * (BR-08, SEC-V6, FR-CREATE-11).
 */

/** The picker's value → an absolute instant. `""` when it is not yet a date. */
function toInstant(localValue: string): string {
  if (!localValue) return "";
  const parsed = new Date(localValue);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
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
   * FR-CREATE-26a — the seller gets exactly one attempt at this, so the price
   * is echoed back in the canonical format (BR-43) before submission. It is a
   * PREVIEW, not a rewrite: AmountInput never reformats what was typed
   * (FR-BID-17), and the string submitted is the string in the box.
   */
  const pricePreview = trySar(startingPrice);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {/* FR-CREATE-24 / FR-CREATE-25 stated BEFORE the fields, not after the
          mistake: nothing on this page can be undone once it is published. */}
      <Alert tone="info">
        بعد النشر لا يمكن تعديل المزاد ولا إلغاؤه، ويستمر حتى وقت انتهائه. راجع
        البيانات قبل الإرسال.
      </Alert>

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
          سيُعرض السعر هكذا: <bdi className="num font-semibold">{formatSarWithSuffix(pricePreview)}</bdi>
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
        error={state.fieldErrors?.image}
        required
      >
        {(props) => (
          <>
            <Input
              {...props}
              name="image"
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              onChange={(event) => setImageName(event.target.files?.[0]?.name ?? null)}
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

      {/*
        EC-21 — a duplicate auction can never be removed by anyone, so blocking
        the second submit is a correctness requirement, not polish. `loading`
        disables the button for the whole round trip (see components/ui/button.tsx).
      */}
      <Button type="submit" loading={pending}>
        انشر المزاد
      </Button>
    </form>
  );
}
