import Link from "next/link";

import { Bell } from "@/components/notifications/bell";
import { UserMenu } from "@/components/navigation/user-menu";
import { SearchBox } from "@/components/navigation/search-box";
import { createClient } from "@/lib/supabase/server";
import type { AppNotification } from "@/types/db";

/**
 * The approved topbar (topbar.html): logo, search, nav, bell, circular
 * avatar. No «حسابي» button — identity is the avatar at the end.
 */
export async function Topbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  let notifications: AppNotification[] = [];
  let unreadCount = 0;

  if (user) {
    const [{ data: profile }, { data: notif }, { count }] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single(),
      supabase
        .from("notifications")
        .select("*")
        .order("id", { ascending: false })
        .limit(12),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
    ]);
    displayName = profile?.display_name ?? null;
    avatarUrl = profile?.avatar_url ?? null;
    notifications = (notif as AppNotification[] | null) ?? [];
    unreadCount = count ?? 0;
  }

  const navLink =
    "rounded-[10px] px-3.5 py-2 text-sm font-medium text-ink2 transition hover:bg-white/5 hover:text-ink";

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
      <div className="mx-auto max-w-[1200px]">
        {/* ONE blurred surface holds both rows — a bare second row floating
           over scrolled content is what looked broken at high zoom. */}
        <div className="hairline rounded-[18px] bg-[rgba(15,18,25,.88)] backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 sm:gap-5 sm:px-5">
          <Link
            href="/"
            className="font-display text-[21px] font-bold text-ink"
            style={{ letterSpacing: "-0.01em" }}
          >
            دلّال<span className="text-gold">.</span>
          </Link>

          <div className="hidden max-w-[360px] flex-1 sm:block">
            <SearchBox />
          </div>

          <nav className="ms-auto flex items-center gap-1">
            <Link href="/" className={`${navLink} hidden md:block`}>
              المزادات
            </Link>
            <Link href="/sessions" className={`${navLink} hidden md:block`}>
              الجلسات
            </Link>
            {user ? (
              <Link
                href="/create"
                className="rounded-[10px] bg-gold px-3.5 py-2 text-sm font-semibold text-gold-ink"
              >
                أنشئ
              </Link>
            ) : (
              <>
                <Link href="/login" className={navLink}>
                  دخول
                </Link>
                <Link
                  href="/register"
                  className="rounded-[10px] bg-gold px-3.5 py-2 text-sm font-semibold text-gold-ink"
                >
                  إنشاء حساب
                </Link>
              </>
            )}
          </nav>

          {user ? (
            <div className="flex items-center gap-2">
              <Bell userId={user.id} initialItems={notifications} initialUnread={unreadCount} />
              <UserMenu displayName={displayName ?? "مستخدم"} avatarUrl={avatarUrl} />
            </div>
          ) : null}
        </div>

        {/* narrow viewports: search gets its own row INSIDE the surface */}
        <div className="px-4 pb-3 sm:hidden">
          <SearchBox />
        </div>
        </div>
      </div>
    </header>
  );
}
