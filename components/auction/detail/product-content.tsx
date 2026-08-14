import { Card, CardBody } from "@/components/ui/card";
import { ImageFrame } from "@/components/ui/image-frame";

/**
 * MOHAMMED'S FILE — `@m7ya505`. AUC-12 (#54); the empty file came from S0-13.
 * Product image, seller display name, and the full description.
 *
 * Wholly presentation: nothing here is derived from bidding or auth behaviour,
 * so it is the one region of the detail page with a single owner
 * (ARCHITECTURE §14.6 — "None — static per page load").
 *
 * The product NAME is rendered by the page shell as the page's single <h1>
 * (AUC-11), so the shell and this region never produce two competing headings.
 * FR-DETAIL-02 is satisfied there; everything below is AUC-12's.
 */
export interface ProductContentProps {
  /** Not rendered as a heading here — used as the image's alt text. */
  name: string;
  description: string;
  imageUrl?: string;
  /** FR-DETAIL-13 — the seller's public identity. Never their email. */
  sellerName: string;
}

export function ProductContent({
  name,
  description,
  imageUrl,
  sellerName,
}: ProductContentProps) {
  return (
    <div className="flex flex-col gap-4">
      {/*
        FR-DETAIL-04 — "a size adequate to evaluate the item", so this is the
        wide ratio at the full width of the content column, not the listing's
        square thumbnail. `priority` because on a wide viewport it is the
        largest element above the fold.

        A delivery failure is not an auction failure: ImageFrame renders its
        placeholder and everything else on the page stays usable and biddable
        (EC-18). The product name IS the alt text — for this image there is no
        information the name does not already carry, and a user-supplied string
        is safe in an attribute because nothing interprets it.
      */}
      <ImageFrame src={imageUrl} alt={name} ratio="wide" priority />

      <Card as="section" aria-label="تفاصيل المنتج">
        <CardBody className="gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-ink-3 text-xs font-bold">البائع</h2>
            {/*
              FR-DETAIL-13 and BR-26: the display name, and there is no path to
              an email from here — the read joins public.profiles, which has no
              email column at all (CLAUDE.md §6, SEC-P1). <bdi> because a
              display name may be Latin, Arabic or mixed and would otherwise
              reorder the line it sits in.
            */}
            <p className="text-base font-semibold">
              <bdi>{sellerName}</bdi>
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <h2 className="text-ink-3 text-xs font-bold">الوصف</h2>
            {/*
              FR-DETAIL-03 — the ORIGINAL LINE BREAKS survive. `whitespace-pre-line`
              keeps every newline the seller typed and still wraps long lines,
              which `pre` would not. Without it the description collapses into
              one paragraph and a seller's deliberate structure — a spec list,
              a condition note — is silently destroyed. They get exactly one
              chance to write it (FR-CREATE-26a, BR-31), so losing it is not
              recoverable by editing.

              `break-words` because a 2000-character description (FR-CREATE-05)
              may contain an unbroken URL or serial number, and at 375px that
              would otherwise force the page to scroll sideways.

              <bdi> isolates a Latin or mixed-script description so it cannot
              reorder anything around it. It does not set the paragraph's own
              base direction — a wholly-Latin description still reads
              right-aligned. Doing that properly means a per-element direction
              decision, which is the open `dir` question in the design notes and
              Mohammed's to settle, not this issue's.
            */}
            <p className="text-ink text-sm leading-relaxed break-words whitespace-pre-line">
              <bdi>{description}</bdi>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
