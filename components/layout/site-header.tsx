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
const PUBLIC_NAV = [{ href: "/", label: "المزادات" }] as const;

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

  return (
    <header className="bg-surface border-rule sticky top-0 z-20 border-b">
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="text-lg font-bold"
          aria-label="دلال — الصفحة الرئيسية"
        >
          دلال
        </Link>

        {/* Desktop navigation. Hidden on phones, where the menu below serves. */}
        <nav aria-label="التنقل الرئيسي" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-tap items-center rounded-md px-3 text-sm font-semibold transition-colors duration-[120ms]",
                      current
                        ? "bg-brand-weak text-brand-text"
                        : "text-ink-2 hover:bg-sunk hover:text-ink",
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
          <Link
            href="/login"
            className="text-brand-text hidden min-h-tap items-center px-2 text-sm font-semibold md:flex"
          >
            تسجيل الدخول
          </Link>
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
      </Container>

      {/*
        Mobile navigation. Rendered only when open so its links stay out of
        the tab order while collapsed — `hidden` alone would not do that.
      */}
      {open ? (
        <nav id={menuId} aria-label="التنقل الرئيسي" className="border-rule border-t md:hidden">
          <Container className="py-2">
            <ul className="flex flex-col">
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
          </Container>
        </nav>
      ) : null}
    </header>
  );
}
