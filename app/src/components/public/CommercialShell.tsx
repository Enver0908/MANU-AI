import type { ReactNode } from "react";
import Link from "next/link";

export function CommercialShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="w-full border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-off-black transition-colors hover:text-primary"
            aria-label="SiriusAI ana sayfaya dön"
          >
            SiriusAI
          </Link>
          <Link href="/#iletisim" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            Yardım için iletişim
          </Link>
        </div>
      </header>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} SiriusAI</p>
          <p className="text-xs text-muted-foreground">
            Production pilot: <span className="font-medium text-destructive">NO-GO</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
