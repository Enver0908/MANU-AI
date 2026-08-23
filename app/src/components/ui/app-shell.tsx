"use client";

import type { ReactNode } from "react";
import { useOptionalShellProvider } from "@/components/dashboard/shell-provider";
import { cn } from "./cn";
import type { IconType } from "./tokens";

export type AppShellNavItem = {
  id: string;
  label: string;
  icon: IconType;
  badge?: string;
  onSelect?: () => void;
};

/**
 * Transitional adapter: inside the Stage 5 authenticated shell, AppShell does
 * not emit a second navigation landmark and only renders children. Outside that
 * boundary it keeps the legacy primitive chrome for non-dashboard surfaces.
 */
export function AppShell({
  brand,
  navItems,
  activeId,
  topBarActions,
  children,
}: {
  brand: ReactNode;
  navItems: AppShellNavItem[];
  activeId: string;
  topBarActions?: ReactNode;
  children: ReactNode;
}) {
  const shell = useOptionalShellProvider();
  if (shell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-paper text-ink" data-testid="legacy-app-shell">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <AppSidebar brand={brand} navItems={navItems} activeId={activeId} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopBar brand={brand} actions={topBarActions} />
          <main className="flex-1 px-safe py-4 pb-24 lg:pb-6">{children}</main>
        </div>
      </div>
      <AppBottomNav navItems={navItems} activeId={activeId} />
    </div>
  );
}

export function AppSidebar({
  brand,
  navItems,
  activeId,
}: {
  brand: ReactNode;
  navItems: AppShellNavItem[];
  activeId: string;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="border-b border-line px-4 py-4">{brand}</div>
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onSelect}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium transition",
                active ? "bg-primary text-white" : "text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span className="command-label flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-warm/15 px-1.5 text-xs font-medium text-warm">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function AppTopBar({ brand, actions }: { brand: ReactNode; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-line bg-surface/95 px-safe backdrop-blur">
      <div className="lg:hidden">{brand}</div>
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </header>
  );
}

export function AppBottomNav({ navItems, activeId }: { navItems: AppShellNavItem[]; activeId: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-safe lg:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onSelect}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              active ? "text-primary" : "text-ink-muted",
            )}
          >
            <Icon size={20} className="shrink-0" />
            <span className="command-label px-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
