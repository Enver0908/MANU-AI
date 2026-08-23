import Link from "next/link";
import { LockKeyhole, LogOut } from "lucide-react";
import { CommercialShell } from "@/components/public/CommercialShell";

export function CommercialInstallBlockedState({
  title,
  description,
  blockingReasons,
}: {
  title: string;
  description: string;
  blockingReasons?: string[];
}) {
  return (
    <CommercialShell>
      <div className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-border bg-surface p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-warm/15 p-2 text-warm">
                <LockKeyhole size={22} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground">{title}</h1>
                <p className="free-text mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            </div>
            {blockingReasons && blockingReasons.length > 0 ? (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {blockingReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-5 flex flex-col gap-2">
              <Link
                href="/dashboard"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                Dashboard&apos;a dön
              </Link>
              <form action="/api/demo-logout" method="post">
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
                  type="submit"
                >
                  <LogOut size={17} />
                  Çıkış yap
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </CommercialShell>
  );
}
