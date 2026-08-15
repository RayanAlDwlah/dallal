"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/cn";

export interface ImageFrameProps {
  /** `undefined` renders the placeholder — EC-18, FR-DETAIL-04. */
  src?: string;
  alt: string;
  /** Listing thumbnails are square; the detail hero is wider. */
  ratio?: "square" | "wide";
  className?: string;
  priority?: boolean;
  /**
   * AUC-09 (#148) — what share of the viewport this frame occupies, so the
   * optimiser picks a derivative instead of the largest candidate. Defaults
   * from `ratio`, which already encodes the two places a frame appears.
   */
  sizes?: string;
}

/**
 * Product image with a placeholder fallback.
 *
 * A missing image must never take the auction down with it: the placeholder
 * renders and the auction stays fully usable and biddable (EC-18).
 *
 * ---------------------------------------------------------------------------
 * AUC-06 (#48) — "fails to load" is not the same as "is absent"
 *
 * `FR-DETAIL-04` asks for a sensible placeholder **if the image fails to
 * load**, and `GITHUB_PLAN.md:394` repeats it. Until this change the component
 * handled only ABSENCE — `src === undefined` — which is a different event with
 * a different cause. Every real failure mode leaves `src` perfectly well
 * formed: the storage object was never written because the insert raced an
 * upload error, the bucket answers 404, the CDN times out, the viewer is on a
 * network that blocks it. In all of those the old component rendered a live
 * `<img>` pointing at nothing and the browser drew its broken-image glyph and
 * the alt text — inside a bordered frame, which reads as a defect in the
 * listing rather than as a missing photo.
 *
 * That is exactly the class of gap this repository keeps meeting: the code
 * LOOKS like it handles the requirement, because a placeholder does exist and
 * is right there in the file.
 *
 * So the failure is caught. `onError` requires state, which requires a client
 * component — and that cost was already paid on this surface: `Countdown` is a
 * client component rendered once per listing card with a one-second interval,
 * so a leaf that holds one boolean is far below the water line already set.
 * ---------------------------------------------------------------------------
 *
 * Deliberately a plain <img>: next/image needs a configured remote host, and
 * V-4 (#27) has not yet settled whether transformation is available. Swapping
 * to next/image later is a change inside this one component.
 */
/**
 * Default `sizes` per frame shape, matching the layouts that render them:
 *   square — the listing grid, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
 *   wide   — the detail hero, one column until `lg`, then the content column
 *            of `lg:grid-cols-[minmax(0,1fr)_22rem]`
 * Wrong values here do not break the layout; they make the browser fetch a
 * candidate wider than it needs, which is the exact cost NFR-PERF-05 is about.
 */
const DEFAULT_SIZES = {
  square: "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  wide: "(min-width: 1024px) 60vw, 100vw",
} as const;

export function ImageFrame({
  src,
  alt,
  ratio = "square",
  className,
  priority,
  sizes,
}: ImageFrameProps) {
  /*
   * The FAILED URL, not a boolean.
   *
   * A boolean would stick: once one src failed, a re-render carrying a
   * different, working src would keep showing the placeholder, because nothing
   * resets it. Storing which url failed makes the comparison below self-
   * clearing — a new src is by definition not the failed one — with no effect
   * and no key prop for a caller to remember.
   */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const frame = cn(
    "bg-sunk border-rule relative overflow-hidden rounded-md border",
    ratio === "square" ? "aspect-square" : "aspect-[16/10]",
    className,
  );

  const broken = src !== undefined && failedSrc === src;

  if (!src || broken) {
    return (
      <div className={frame} role="img" aria-label={alt}>
        <span className="text-ink-3 absolute inset-0 flex items-center justify-center px-2 text-center text-xs">
          {/*
            The two cases are told apart, because they are not the same fact
            for the person reading them. "No image" describes the auction;
            "could not be loaded" describes this attempt, and is the one where
            a reload might help. Neither is an error state: EC-18 requires the
            auction stay fully usable and biddable, so the frame keeps its
            normal surface rather than taking an error tone.
          */}
          {broken ? "تعذّر تحميل الصورة" : "لا توجد صورة"}
        </span>
      </div>
    );
  }

  return (
    <div className={frame}>
      {/*
        AUC-09 (#148) — next/image, not a bare <img>. V-4 measured what the bare
        one costs: 100 originals is 56 MB at the most compressible source
        measured and 566 MB at a photo-like one, against NFR-PERF-01's 3 s — and
        two thumbnails alone already exceeded the budget, so lazy loading was
        not rescuing it. NFR-PERF-05 is the plainer half: a thumbnail must not
        download the full-resolution original, and every one did.

        `fill` rather than width/height: the frame owns the aspect ratio
        (`aspect-square` / `aspect-[16/10]`) and is already `relative`, and the
        stored image's intrinsic dimensions are not known here — nothing records
        them, and inventing a pair would distort every image that disagreed.

        `onError` survives the swap (AUC-06, #143): next/image supports it, and
        it is what turns a 404 or a dead CDN into the placeholder rather than a
        broken-image glyph inside a bordered frame.
      */}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? DEFAULT_SIZES[ratio]}
        priority={priority}
        onError={() => setFailedSrc(src)}
        className="object-cover"
      />
    </div>
  );
}
