"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LogIn, ShieldAlert, type LucideIcon } from "lucide-react";
import { buttonClasses, Card, CardBody } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { SKELETON_BLOCK_CLASS } from "@/lib/phase-83e6-states-polish";

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn(SKELETON_BLOCK_CLASS, className)} />;
}

/** Stable-layout loading shell shown while client workspace state hydrates. */
export function DashboardLoadingSkeleton() {
  return (
    <div
      className="min-h-screen bg-surface-muted text-ink"
      aria-busy="true"
      aria-label="Loading SiriusAI workspace"
      data-testid="dashboard-loading-skeleton"
    >
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="hidden space-y-3 border-r border-line bg-surface p-5 lg:block lg:w-72">
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-7 w-44" />
          <div className="space-y-2 pt-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-11 w-full" />
            ))}
          </div>
        </aside>
        <main className="flex-1 space-y-5 px-safe py-6 sm:px-6">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-8 w-56" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-24 w-full rounded-card" />
            ))}
          </div>
          <SkeletonBlock className="h-72 w-full rounded-card" />
        </main>
      </div>
    </div>
  );
}

export function EmptyState({
  message,
  title,
  icon: Icon,
  action,
}: {
  message: string;
  title?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div
      className="rounded-card border border-dashed border-line bg-surface-sunken p-6 text-center"
      data-testid="empty-state"
      role="status"
    >
      {Icon ? (
        <span className="mx-auto mb-3 inline-flex rounded-control bg-stone-100 p-2 text-stone-600">
          <Icon size={20} aria-hidden="true" />
        </span>
      ) : null}
      {title ? <p className="text-sm font-semibold text-ink">{title}</p> : null}
      <p className={`text-sm leading-6 text-ink ${title ? "mt-1" : ""}`}>{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  detail,
  recoveryHref = "/",
  recoveryLabel = "Yeniden giriş yap",
  onAction,
  actionLabel,
}: {
  title: string;
  message: string;
  detail?: string;
  recoveryHref?: string;
  recoveryLabel?: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted px-safe py-8 text-ink">
      <div className="w-full max-w-md">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="rounded-control bg-red-100 p-2 text-red-900">
                <ShieldAlert size={22} aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-lg font-semibold text-ink">{title}</h1>
                <p className="mt-1 text-sm text-ink-muted">{message}</p>
              </div>
            </div>
            {detail ? (
              <p className="rounded-control bg-stone-100 px-3 py-2 text-xs text-ink-subtle" role="note">
                {detail}
              </p>
            ) : null}
            <Link href={recoveryHref} className={`${buttonClasses("primary", "md")} w-full`}>
              <LogIn size={17} />
              {recoveryLabel}
            </Link>
            {onAction ? (
              <button type="button" className={`${buttonClasses("secondary", "md")} w-full`} onClick={onAction}>
                {actionLabel ?? "Tekrar dene"}
              </button>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
