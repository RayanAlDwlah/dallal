"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The photo fixer («يصلّح الصور», ai.html) — the deterministic part, no model:
 * rotate, brightness, center-crop to the card's 4:3. Everything runs on a
 * canvas in the browser; the ORIGINAL is never destroyed — «رجّع الأصلية» is
 * wired by the caller keeping the first File it ever saw.
 */
export function ImageEditor({
  source,
  onDone,
  onRestoreOriginal,
  onClose,
}: {
  /** File or same-origin/CORS-enabled URL. */
  source: File | string;
  onDone: (edited: File) => void;
  /** present when an original exists to go back to */
  onRestoreOriginal: (() => void) | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [crop43, setCrop43] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
      const bmp = await createImageBitmap(blob);
      if (cancelled) {
        bmp.close();
        return;
      }
      bitmapRef.current = bmp;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      bitmapRef.current?.close();
      bitmapRef.current = null;
    };
  }, [source]);

  useEffect(() => {
    const bmp = bitmapRef.current;
    const canvas = canvasRef.current;
    if (!ready || !bmp || !canvas) return;

    /* 1 — rotate the full image into an offscreen canvas */
    const rotated = rotation % 180 !== 0;
    const off = document.createElement("canvas");
    off.width = rotated ? bmp.height : bmp.width;
    off.height = rotated ? bmp.width : bmp.height;
    const octx = off.getContext("2d")!;
    octx.translate(off.width / 2, off.height / 2);
    octx.rotate((rotation * Math.PI) / 180);
    octx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);

    /* 2 — pick the centered 4:3 window (or everything), scale, apply light */
    let sx = 0;
    let sy = 0;
    let sw = off.width;
    let sh = off.height;
    if (crop43) {
      const target = 4 / 3;
      if (sw / sh > target) {
        sw = Math.round(sh * target);
        sx = Math.round((off.width - sw) / 2);
      } else {
        sh = Math.round(sw / target);
        sy = Math.round((off.height - sh) / 2);
      }
    }
    const scale = Math.min(1, 1600 / Math.max(sw, sh));
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.filter = `brightness(${brightness}%)`;
    ctx.drawImage(off, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }, [ready, rotation, brightness, crop43]);

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    if (!blob) return;
    onDone(new File([blob], "edited.jpg", { type: "image/jpeg" }));
  }

  const tool = (on: boolean) =>
    `h-9 cursor-pointer rounded-[10px] px-3.5 text-[13px] border-0 ${
      on
        ? "bg-[rgba(124,58,237,.22)] text-[#C4A6FF] [box-shadow:inset_0_0_0_1px_rgba(124,58,237,.4)]"
        : "bg-raised text-ink2 [box-shadow:inset_0_0_0_1px_var(--color-hair)] hover:text-ink"
    }`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(4,6,10,.8)] p-4"
      onClick={onClose}
    >
      <div
        className="hairline w-full max-w-[560px] rounded-[22px] bg-raised p-5 shadow-[0_24px_60px_rgba(0,0,0,.55)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="تعديل الصورة"
      >
        <h3 className="m-0 mb-4 font-display text-[17px] font-semibold">تعديل الصورة</h3>

        <div className="grid max-h-[46vh] place-items-center overflow-hidden rounded-[14px] bg-black/40">
          {ready ? (
            <canvas ref={canvasRef} className="max-h-[46vh] max-w-full object-contain" />
          ) : (
            <div className="grid h-[220px] place-items-center text-[13px] text-ink3">
              يحمّل الصورة…
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className={tool(false)} onClick={() => setRotation((r) => (r + 90) % 360)}>
            ↻ تدوير
          </button>
          <button type="button" className={tool(crop43)} onClick={() => setCrop43((c) => !c)}>
            قصّ للمقاس 4:3
          </button>
          {onRestoreOriginal ? (
            <button
              type="button"
              className={tool(false)}
              onClick={() => {
                onRestoreOriginal();
                onClose();
              }}
            >
              ↺ رجّع الأصلية
            </button>
          ) : null}
        </div>

        <div className="mt-3.5 flex items-center gap-3">
          <span className="text-[13px] text-ink2">الإضاءة</span>
          <input
            type="range"
            min={60}
            max={160}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="flex-1 accent-[#7C3AED]"
          />
          <span className="num min-w-[42px] text-end text-[13px] text-ink2">{brightness}%</span>
        </div>

        <div className="mt-5 flex gap-2.5">
          <button type="button" onClick={save} className="btn-gold h-11 flex-1 text-sm">
            احفظ التعديل
          </button>
          <button type="button" onClick={onClose} className="btn-ghost h-11 px-5 text-sm">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
