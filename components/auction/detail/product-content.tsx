import { Alert } from "@/components/ui/alert";

/**
 * MOHAMMED'S FILE — `@m7ya505`. Created empty by S0-13 (#22); filled by
 * AUC-12 (#54). Product name, description, image, seller display name.
 *
 * Wholly presentation: nothing here is derived from bidding or auth behaviour,
 * so it is the one region of the detail page with a single owner
 * (ARCHITECTURE §14.6 — "None — static per page load").
 *
 * The product NAME is rendered by the page shell as the page's single <h1>
 * (AUC-11), so that the shell and this region never produce two competing
 * headings. FR-DETAIL-02 is satisfied there; everything below is AUC-12's.
 *
 * What AUC-12 must honour, recorded now so the requirement does not have to be
 * rediscovered from four documents:
 *
 *   - the SELLER'S DISPLAY NAME, never their email (FR-DETAIL-13, BR-26). The
 *     name is read from public.profiles; email lives in the auth schema and no
 *     join here may reach it (CLAUDE.md §6).
 *   - the description keeps its original line breaks (FR-DETAIL-03).
 *   - the image is large enough to evaluate the item, and a delivery failure
 *     shows a placeholder while the auction stays fully biddable — ImageFrame
 *     already does this (FR-DETAIL-04, EC-18).
 *   - the product name and the seller name are user-supplied and may be Latin,
 *     Arabic or mixed. Both go inside <bdi> or they reorder the line around
 *     them (CLAUDE.md §3).
 */
export function ProductContent() {
  return (
    <Alert tone="info" title="محتوى المنتج">
      <p>
        منطقة عرض فارغة من <span className="num">S0-13</span>. الاسم والوصف
        والصورة واسم البائع ضمن <span className="num">AUC-12</span>.
      </p>
    </Alert>
  );
}
