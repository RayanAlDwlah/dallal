import { publicSupabaseConfig } from "@/lib/supabase/config";

/**
 * Storage keys → public URLs. The value stored on the row is always a KEY
 * inside the bucket (never a URL), so the origin is never seller-controlled.
 */
export function publicImageUrl(bucket: "auction-images" | "avatars", path: string): string {
  const { url } = publicSupabaseConfig();
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}

export function auctionImageUrl(path: string): string {
  return publicImageUrl("auction-images", path);
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_AUCTION_IMAGES = 10;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Browser-only: shrink an image to a JPEG data URL before it is sent to the
 * assistive endpoints — a 5 MB photo becomes ~100 KB and a local vision model
 * does not need more pixels than this to describe a product.
 */
export async function toModelDataUrl(source: File | string, maxDim = 1024): Promise<string> {
  const bitmap =
    typeof source === "string"
      ? await createImageBitmap(await (await fetch(source)).blob())
      : await createImageBitmap(source);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
