import { LockKeyhole, LogOut } from "lucide-react";
import Link from "next/link";

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
    <div className="flex min-h-screen items-center justify-center bg-[#f7f5ef] px-4 py-6 text-stone-950">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
              <LockKeyhole size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-stone-600">{description}</p>
            </div>
          </div>
          {blockingReasons && blockingReasons.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-stone-600">
              {blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
            >
              Dashboard&apos;a dön
            </Link>
            <form action="/api/demo-logout" method="post">
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
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
  );
}
