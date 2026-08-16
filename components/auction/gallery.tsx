"use client";

import Image from "next/image";
import { useState } from "react";

import { auctionImageUrl } from "@/lib/images";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];

  return (
    <div>
      <div
        className="hairline relative aspect-[4/3] w-full overflow-hidden rounded-[20px]"
        style={{ background: "linear-gradient(135deg,#1B212C,#11151D)" }}
      >
        {current ? (
          <Image
            src={auctionImageUrl(current)}
            alt={title}
            fill
            sizes="(max-width: 1024px) 100vw, 700px"
            className="object-cover"
            priority
          />
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="rail-scroll mt-2.5 flex gap-2">
          {images.map((img, i) => (
            <button
              key={img}
              onClick={() => setIndex(i)}
              aria-label={`صورة ${i + 1}`}
              className={`relative size-[64px] flex-none cursor-pointer overflow-hidden rounded-[12px] ${
                i === index
                  ? "[box-shadow:inset_0_0_0_1.5px_var(--color-gold)]"
                  : "hairline opacity-70 hover:opacity-100"
              }`}
              style={{ background: "linear-gradient(140deg,#232B39,#141922)" }}
            >
              <Image
                src={auctionImageUrl(img)}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
