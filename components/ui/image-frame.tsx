"use client";

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
export function ImageFrame({ src, alt, ratio = "square", className, priority }: ImageFrameProps) {
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailedSrc(src)}
        className="size-full object-cover"
      />
    </div>
  );
}
