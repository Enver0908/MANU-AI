import { LogOut, ShieldAlert, UserRoundX } from "lucide-react";

export function NoMembershipState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f5ef] px-4 py-6 text-stone-950">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">No workspace access</h2>
              <p className="mt-1 text-sm text-stone-600">
                Your account is not linked to any MANU-AI workspace.
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-stone-600">
            A workspace owner or administrator must add your account to a tenant before you can access
            the dashboard. Contact your clinic administrator.
          </p>
          <form action="/api/demo-logout" method="post" className="mt-5">
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
              type="submit"
            >
              <LogOut size={17} />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function NoDietitianProfileState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f5ef] px-4 py-6 text-stone-950">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
              <UserRoundX size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Dietitian profile missing</h2>
              <p className="mt-1 text-sm text-stone-600">
                Your account has workspace access but no dietitian profile.
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-stone-600">
            A dietitian profile must be created for your account before you can use the dashboard.
            Contact your workspace administrator to complete onboarding.
          </p>
          <form action="/api/demo-logout" method="post" className="mt-5">
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
              type="submit"
            >
              <LogOut size={17} />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function MembershipBadge({ displayName, role }: { displayName: string; role: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700">
      <UserRoundX size={16} className="text-emerald-800" />
      {displayName}
      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-semibold uppercase text-stone-500">
        {role}
      </span>
    </span>
  );
}
