import { cn } from "@/lib/cn";

/**
 * OWNER: Mohammed. Product name, description, image and seller identity on
 * the auction detail page (FR-DETAIL-02 → 04, FR-DETAIL-13).
 *
 * The seller's DISPLAY NAME only — never their email (SEC-P1, FR-PROF-06).
 */
export function ProductContent({
  name,
  description,
  sellerDisplayName,
  className,
}: {
  name: string;
  description: string;
  sellerDisplayName: string;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <h1 className="text-xl font-bold text-balance">{name}</h1>

      {/* Original line breaks preserved (FR-DETAIL-03). */}
      <p className="max-w-[60ch] whitespace-pre-line text-ink-2">{description}</p>

      <p className="text-sm text-ink-3">البائع: {sellerDisplayName}</p>
    </section>
  );
}
