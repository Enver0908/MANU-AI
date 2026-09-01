"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AIYA_BRAND_NAME } from "@/lib/brand";

const NAV_LINKS = [
  { label: "Nasıl çalışır", href: "/#nasil-calisir" },
  { label: "Güvenlik", href: "/#guvenlik" },
  { label: "Mobil", href: "/#mobil" },
  { label: "İletişim", href: "/#iletisim" },
] as const;

export function PublicNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Ana gezinti">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-lg font-semibold tracking-tight text-off-black transition-colors hover:text-primary"
          aria-label={`${AIYA_BRAND_NAME} ana sayfa`}
        >
          {AIYA_BRAND_NAME}
        </Link>

        <ul className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <li key={href}>
              <Link href={href} className="inline-flex min-h-11 items-center transition-colors hover:text-foreground">
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Giriş yap
          </Link>
          <Link
            href="/purchase"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Davet koduyla başla
          </Link>
        </div>

        <button
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open ? (
        <div id="mobile-nav" className="border-t border-border bg-surface px-4 py-4 md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex min-h-[44px] items-center py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-border pt-3">
              <Link
                href="/login"
                className="flex min-h-[44px] items-center py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                Giriş yap
              </Link>
            </li>
            <li className="mt-1">
              <Link
                href="/purchase"
                className="flex min-h-[44px] items-center justify-center rounded-md bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                onClick={() => setOpen(false)}
              >
                Davet koduyla başla
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}
