"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";

import { logoutAction } from "@/app/(auth)/actions";
import { Container } from "@/components/layout/container";
import type { Viewer } from "@/lib/auth/identity";
import { cn } from "@/lib/cn";

/**
 * Primary navigation.
 *
 * Auth-facing destinations are listed here because the shell must support
 * them (S0-08), but their pages belong to Abdulrahman. AUTH-05 wires the
 * session state in: `viewer` is the identity contract's thing (1) — it decides
 * what is DISPLAYED and never what is ALLOWED (docs/identity-contract.md §3).
 * Hiding "أنشئ مزادًا" from a visitor is an affordance (FR-AUTH-22); the page
 * itself and the row policy behind it are the enforcement (FR-AUTH-24).
 *
 * Presentation is unchanged from S0-08 — same classes, same structure.
 */
const PUBLIC_NAV = [
  { href: "/", label: "المزادات" },
  { href: "/sessions", label: "الجلسات" },
] as const;

/** Shown only to a signed-in user (S0-10 §3.3). */
const MEMBER_NAV = [
  { href: "/auctions/new", label: "أنشئ مزادًا" },
  { href: "/profile", label: "حسابي" },
] as const;

function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** The sign-out control. A form, so it is a POST and works without JavaScript. */
function LogoutButton({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  return (
    <form action={logoutAction} onSubmit={onNavigate}>
      <button type="submit" className={className}>
        تسجيل الخروج
      </button>
    </form>
  );
}

export function SiteHeader({ viewer }: { viewer: Viewer | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  /**
   * Closing on navigation is handled by the links themselves rather than by
   * an effect watching `pathname`: navigation is a user event, and syncing
   * state from an effect causes a cascading render (react-hooks/
   * set-state-in-effect).
   */
  const closeMenu = () => setOpen(false);

  const nav = viewer ? [...PUBLIC_NAV, ...MEMBER_NAV] : PUBLIC_NAV;

  /*
   * V2 (design-system/previews/topbar.html): the header is a FLOATING bar —
   * rounded, translucent, blurred — sitting on the canvas rather than a
   * full-bleed strip with a border. Structure, links, the logout form, the
   * mobile menu and every aria-* are unchanged; this is the same header in a
   * different shell.
   *
   * What the preview shows and this deliberately does NOT add: the search
   * field (no search exists — an input wired to nothing is a fake affordance),
   * the notification bell (PRD §N1–N4 grades notifications Future), and the
   * avatar-instead-of-name (FR-AUTH-15 wants the signed-in identity STATED;
   * an initial in a circle weakens that). Each becomes real when its feature
   * does.
   */
  return (
    <header className="sticky top-0 z-20 pt-3">
      <Container>
        <div className="bg-surface/80 shadow-e1 rounded-lg backdrop-blur-xl">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4">
            <Link
              href="/"
              className="text-xl font-bold"
              aria-label="دلال — الصفحة الرئيسية"
            >
              {/* His logo: the wordmark with a gold full stop. Decorative. */}
              دلال
              <span aria-hidden="true" className="text-brand-text">
                .
              </span>
            </Link>

        {/* Desktop navigation. Hidden on phones, where the menu below serves. */}
        <nav aria-label="التنقل الرئيسي" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => {
              const current = isCurrent(pathname, item.href);
              /*
               * V2: «أنشئ مزادًا» is the bar's one gold CTA (his `nav a.cta`).
               * Everything else is a quiet pill — the current page marked by a
               * soft white wash, not by gold, so gold keeps meaning "act".
               */
              const cta = item.href === "/auctions/new";
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-tap items-center rounded-md px-3.5 text-sm font-semibold transition-colors duration-[120ms]",
                      cta
                        ? "bg-brand text-on-brand hover:bg-brand-hover"
                        : current
                          ? "bg-white/7 text-ink"
                          : "text-ink-2 hover:bg-white/5 hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/*
          FR-AUTH-15 — every page states whether the viewer is signed in and,
          if so, who they are. FR-AUTH-12 puts logout in the same place on
          every page, which is what this header being in the root layout gives.
        */}
        {viewer ? (
          <div className="hidden items-center gap-1 md:flex">
            {/* bdi: a Latin display name must not flip the header line. */}
            <span className="text-ink-2 flex min-h-tap items-center px-2 text-sm font-semibold">
              <bdi>{viewer.displayName}</bdi>
            </span>
            <LogoutButton className="text-brand-text flex min-h-tap cursor-pointer items-center px-2 text-sm font-semibold" />
          </div>
        ) : (
          /*
           * V2's visitor bar pairs a quiet «دخول» with the gold «إنشاء حساب»
           * CTA. Both routes exist (S0-08); this only surfaces /register in
           * the bar, it invents no flow.
           */
          <div className="hidden items-center gap-1 md:flex">
            <Link
              href="/login"
              className="text-ink-2 hover:text-ink flex min-h-tap items-center rounded-md px-3 text-sm font-semibold transition-colors duration-[120ms]"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/register"
              className="bg-brand text-on-brand hover:bg-brand-hover flex min-h-tap items-center rounded-md px-3.5 text-sm font-semibold transition-colors duration-[120ms]"
            >
              إنشاء حساب
            </Link>
          </div>
        )}

        <button
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          onClick={() => setOpen((v) => !v)}
          className="border-rule-strong text-ink flex size-11 items-center justify-center rounded-md border md:hidden"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            {open ? "✕" : "☰"}
          </span>
        </button>
          </div>

          {/*
            Mobile navigation — INSIDE the floating bar, so opening it extends
            the same rounded surface instead of bolting a full-width strip
            under a rounded one. Rendered only when open so its links stay out
            of the tab order while collapsed — `hidden` alone would not do that.
          */}
          {open ? (
            <nav id={menuId} aria-label="التنقل الرئيسي" className="border-rule border-t px-2 md:hidden">
              <ul className="flex flex-col py-2">
              {nav.map((item) => {
                const current = isCurrent(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeMenu}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex min-h-tap items-center rounded-md px-3 text-base font-semibold",
                        current ? "bg-brand-weak text-brand-text" : "text-ink",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}

              <li>
                {viewer ? (
                  <>
                    <span className="text-ink-3 flex min-h-tap items-center px-3 text-sm font-semibold">
                      <bdi>{viewer.displayName}</bdi>
                    </span>
                    <LogoutButton
                      onNavigate={closeMenu}
                      className="text-ink flex min-h-tap w-full cursor-pointer items-center rounded-md px-3 text-base font-semibold"
                    />
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    aria-current={isCurrent(pathname, "/login") ? "page" : undefined}
                    className={cn(
                      "flex min-h-tap items-center rounded-md px-3 text-base font-semibold",
                      isCurrent(pathname, "/login")
                        ? "bg-brand-weak text-brand-text"
                        : "text-ink",
                    )}
                  >
                    تسجيل الدخول
                  </Link>
                )}
              </li>
              </ul>
            </nav>
          ) : null}
        </div>
      </Container>
    </header>
  );
}
