import { cn } from "@/lib/cn";

export interface ImageFrameProps {
  /** `undefined` renders the placeholder — EC-18, FR-DETAIL-04. */
  src?: string;
  alt: string;
  /** Listing thumbnails are square; the detail hero is wider. */
  ratio?: "square" | "wide";
  className?: string;
  priority?: boolean;
}

/**
 * Product image with a placeholder fallback.
 *
 * A missing image must never take the auction down with it: the placeholder
 * renders and the auction stays fully usable and biddable (EC-18).
 *
 * Deliberately a plain <img>: next/image needs a configured remote host, and
 * the storage host is not decided yet (S0-04 created the projects, but the
 * bucket and its URL shape are AUC-04). Swapping to next/image later is a
 * change inside this one component.
 */
export function ImageFrame({ src, alt, ratio = "square", className, priority }: ImageFrameProps) {
  const frame = cn(
    "bg-sunk border-rule relative overflow-hidden rounded-md border",
    ratio === "square" ? "aspect-square" : "aspect-[16/10]",
    className,
  );

  if (!src) {
    return (
      <div className={frame} role="img" aria-label={alt}>
        <span className="text-ink-3 absolute inset-0 flex items-center justify-center text-xs">
          لا توجد صورة
        </span>
      </div>
    );
  }

  return (
    <div className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="size-full object-cover"
      />
    </div>
  );
}
