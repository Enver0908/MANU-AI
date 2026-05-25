import { Bot, LockKeyhole, Smartphone } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f5ef] px-4 py-6 text-stone-950 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">MANU-AI</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
              Dietitian messaging operations console
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
              Local SaaS prototype for client controls, AI activation, conversation provenance, and inbound simulator.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Capability icon={Bot} label="Core orchestrator" />
              <Capability icon={Smartphone} label="Installable PWA" />
              <Capability icon={LockKeyhole} label="Demo protected" />
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Demo sign in</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Starts a local demo session. When Supabase is configured, this uses Supabase Auth and tenant membership.
            </p>
            <form action="/api/demo-login" method="post" className="mt-5">
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
                type="submit"
              >
                <LockKeyhole size={17} />
                Enter dashboard
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function Capability({ icon: Icon, label }: { icon: typeof Bot; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700">
      <Icon size={16} className="text-emerald-800" />
      {label}
    </span>
  );
}
