"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { ALLOWED_IMAGE_TYPES, publicImageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

/** Display name + avatar. Display name is the only public identity. */
export function ProfileEditor({
  displayName: initialName,
  avatarUrl,
}: {
  displayName: string;
  avatarUrl: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function saveName() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      setMsg({ kind: "err", text: "الاسم المعروض من محرفين إلى 40 محرفًا" });
      return;
    }
    setBusy(true);
    setMsg(null);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", uid ?? "");
    setBusy(false);
    if (error) setMsg({ kind: "err", text: "تعذّر الحفظ — حاول مرة أخرى" });
    else {
      setMsg({ kind: "ok", text: "تم الحفظ" });
      router.refresh();
    }
  }

  async function uploadAvatar(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setMsg({ kind: "err", text: "الصيغ المقبولة: JPG أو PNG أو WebP" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ kind: "err", text: "حجم الصورة الأقصى 2 ميجابايت" });
      return;
    }
    setBusy(true);
    setMsg(null);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${uid}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) {
      setBusy(false);
      setMsg({ kind: "err", text: "تعذّر رفع الصورة — حاول مرة أخرى" });
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: publicImageUrl("avatars", path) })
      .eq("id", uid);
    setBusy(false);
    if (error) setMsg({ kind: "err", text: "تعذّر الحفظ — حاول مرة أخرى" });
    else router.refresh();
  }

  return (
    <div className="hairline flex flex-wrap items-center gap-4 rounded-[20px] bg-surface p-5">
      <button
        onClick={() => fileInput.current?.click()}
        title="غيّر الصورة"
        className="hairline relative grid size-16 cursor-pointer place-items-center overflow-hidden rounded-full font-display text-xl font-semibold text-ink2"
        style={{ background: "linear-gradient(140deg,#2A3140,#171C26)" }}
      >
        {avatarUrl ? (
          // 64 px is the button's own size (`size-16`); next/image serves the
          // thumbnail instead of the full upload the user just made.
          <Image src={avatarUrl} alt="" width={64} height={64} className="size-full object-cover" />
        ) : (
          initialName.trim().charAt(0)
        )}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadAvatar(f);
          e.target.value = "";
        }}
      />

      <div className="min-w-0 flex-1">
        <label className="mb-1 block text-[12.5px] text-ink3" htmlFor="p-name">
          الاسم المعروض
        </label>
        <div className="flex max-w-[380px] gap-2">
          <input
            id="p-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="field h-11"
          />
          <button onClick={saveName} disabled={busy} className="btn-gold h-11 px-5 text-sm">
            حفظ
          </button>
        </div>
        {msg ? (
          <p className={`m-0 mt-1.5 text-[12.5px] ${msg.kind === "ok" ? "text-green" : "text-red"}`}>
            {msg.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
