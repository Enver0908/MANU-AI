import { Bell, CheckCircle, RefreshCcw, Search, ShieldCheck, Smartphone } from "lucide-react";
import { AIYA_BRAND_NAME } from "@/lib/brand";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";

const buttonClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-line bg-surface px-3 text-sm font-medium text-ink";

function StateBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex min-h-11 items-center rounded-control border border-line bg-surface-muted px-3 text-sm font-medium text-ink">
      {children}
    </span>
  );
}

export function Stage7DashboardState({ state }: { state: string }) {
  const isPwa = state.startsWith("pwa-");

  return (
    <div className="min-h-dvh bg-paper text-ink" data-testid="authenticated-shell" data-stage7-state={state}>
      <a href={`#${DASHBOARD_MAIN_ID}`} className="skip-link" data-testid="skip-link">
        Icerige gec
      </a>
      <header className="border-b border-line bg-surface px-safe py-3" role="banner" data-testid="shell-header">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-primary">{AIYA_BRAND_NAME} Stage 7</p>
            <h1 className="text-2xl font-semibold text-ink">Dashboard ve PWA dogrulama paneli</h1>
            <p className="text-sm text-ink-muted">Synthetic senaryo: {state}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={buttonClass} data-testid="shell-header-bell" aria-label="Bildirimler">
              <Bell size={18} />
            </button>
            <button type="button" className={buttonClass}>
              <RefreshCcw size={18} />
              <span className="ml-2">Yenile</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b border-line bg-surface-muted px-safe py-2" aria-label="Dashboard navigasyonu">
        <ul className="mx-auto flex max-w-6xl flex-wrap gap-2">
          {["Genel bakis", "Danisanlar", "Mesajlar", "Uyarilar", "Ayarlar"].map((item) => (
            <li key={item}>
              <a className={buttonClass} href="#stage7-dashboard-content">
                {item}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main
        id={DASHBOARD_MAIN_ID}
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-safe py-5"
      >
        <section
          id="stage7-dashboard-content"
          className="border border-line bg-surface p-4"
          aria-labelledby="stage7-dashboard-heading"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 id="stage7-dashboard-heading" className="text-xl font-semibold text-ink">
                Operasyon durumu
              </h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                PWA mobil install ayar kontrolu hazir. Offline baglanti kilidi, guncel yenileme notu,
                kaydedilmemis degisiklik uyarisi ve session gate sinyalleri gorunur.
              </p>
            </div>
            <div className="flex flex-wrap gap-2" role="status" aria-busy={state.includes("loading")}>
              <StateBadge>Basari kaydedildi</StateBadge>
              <StateBadge>Hata failed unavailable</StateBadge>
              <StateBadge>Pending bekle inceleniyor</StateBadge>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]" aria-label="Dashboard scenario controls">
          <div className="border border-line bg-surface p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Aktif danisan ve liste</h2>
                <p className="text-sm text-ink-muted">Sec, empty, no active client ve dense-list sinyalleri.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass} data-testid="active-client-control">
                  Aktif client
                </button>
                <button type="button" className={buttonClass} aria-disabled="true" disabled>
                  Export devre disi
                </button>
                <button type="button" className={buttonClass}>
                  Export hazir
                </button>
              </div>
            </div>

            <label className="mt-4 flex flex-col gap-2 text-sm font-medium text-ink">
              Arama
              <span className="flex min-h-11 items-center gap-2 border border-line bg-paper px-3">
                <Search size={16} aria-hidden />
                <input
                  type="search"
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
                  placeholder="Danisan ara"
                />
              </span>
            </label>

            <ul className="mt-4 grid gap-2" aria-label="Synthetic dashboard rows">
              {["client-roster-item-1", "client-roster-item-2", "message-row-unread", "alert-row"].map((id, index) => (
                <li
                  key={id}
                  className="flex min-h-11 items-center justify-between gap-3 border border-line bg-paper px-3 text-sm"
                  data-testid={id}
                  aria-label={id === "message-row-unread" ? "okunmamis mesaj" : undefined}
                >
                  <span>Stage7 row {index + 1}</span>
                  <span className="text-ink-muted">dense item</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border border-line bg-surface p-4">
            <h2 className="text-lg font-semibold">Durum ve yetki sinyalleri</h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-ink-muted">
              <p>Salt okunur yetki izin permission view modu etkin.</p>
              <p>Engelli erisim blocked inactive revoked uygun degil.</p>
              <p>Hata, basarisiz, error ve denied durumlari kapali yolda gosterilir.</p>
              <p>Stale conflict cakisma guncel yenile uyarisi kaydedildi.</p>
              <p>Kaydedilmemis degisiklik unsaved discard ayril korumasi acik.</p>
              <p>Kirmizi red acil manual handoff ve sari yellow review risk sinyalleri gorunur.</p>
              <p>Validasyon: zorunlu doldur invalid required alan bildirimi.</p>
              <p>Draft, active, archive, manual, media containment ve message body sinyali var.</p>
            </div>
          </div>
        </section>

        <section className="border border-line bg-surface p-4" aria-label="PWA and settings">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">PWA mobil kabuk</h2>
              <p className="text-sm leading-6 text-ink-muted">
                {isPwa
                  ? "PWA installed shell, mobil install ve settings ayar akisi dogrulaniyor."
                  : "Mobil PWA install rehberi ve ayar sinyali dashboard icinde korunur."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass}>
                <Smartphone size={18} />
                <span className="ml-2">PWA install</span>
              </button>
              <button type="button" className={buttonClass}>
                <ShieldCheck size={18} />
                <span className="ml-2">Ayar settings</span>
              </button>
            </div>
          </div>
        </section>

        <table className="w-full border-collapse border border-line bg-surface text-sm" aria-label="Dashboard table">
          <tbody>
            <tr data-testid="dashboard-table-row">
              <td className="border border-line p-3">
                <CheckCircle size={16} className="inline text-sage" aria-hidden /> Tamamlanan synthetic state
              </td>
              <td className="border border-line p-3">empty bos yok choose select default</td>
            </tr>
          </tbody>
        </table>
      </main>
    </div>
  );
}
