import type { ReactNode } from "react";
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
 * Unified app shell: one structure that renders a desktop sidebar and a mobile
 * bottom navigation from the same nav items, plus a shared top bar. Layout only;
 * navigation state and active view are owned by the consumer.
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
  return (
    <div className="min-h-screen bg-paper text-ink">
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
              <Icon size={18} />
              <span className="flex-1 text-left">{item.label}</span>
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
              "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition",
              active ? "text-primary" : "text-ink-subtle",
            )}
          >
            <Icon size={20} />
            <span className="truncate px-1">{item.label}</span>
            {item.badge ? (
              <span className="absolute right-1/4 top-2 h-1.5 w-1.5 rounded-full bg-warm" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
