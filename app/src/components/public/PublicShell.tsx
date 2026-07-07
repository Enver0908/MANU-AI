import type { ReactNode } from "react";
import { PublicFooter } from "./PublicFooter";
import { PublicNavbar } from "./PublicNavbar";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <a href="#main" className="skip-link">
        Ana içeriğe geç
      </a>
      <PublicNavbar />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
