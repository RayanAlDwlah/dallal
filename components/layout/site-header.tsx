"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";

import { Container } from "@/components/layout/container";
import { cn } from "@/lib/cn";

/**
 * Primary navigation.
 *
 * Auth-facing destinations are listed here because the shell must support
 * them (S0-08), but their pages belong to Abdulrahman. This component holds
 * no session state and makes no authentication decision — which link a
 * signed-in user sees is wired in AUTH-05 against the identity contract
 * (docs/identity-contract.md), where "is someone signed in?" is display-only.
 */
const NAV = [
  { href: "/", label: "المزادات" },
  { href: "/auctions/new", label: "أنشئ مزادًا" },
  { href: "/profile", label: "حسابي" },
] as const;

function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
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
            {NAV.map((item) => {
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

        <Link
          href="/login"
          className="text-brand-text hidden min-h-tap items-center px-2 text-sm font-semibold md:flex"
        >
          تسجيل الدخول
        </Link>

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
              {[...NAV, { href: "/login", label: "تسجيل الدخول" }].map((item) => {
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
            </ul>
          </Container>
        </nav>
      ) : null}
    </header>
  );
}
