import { Bell, Lock, Smartphone, WifiOff } from "lucide-react";
import { AIYA_BRAND_NAME } from "@/lib/brand";

const FEATURES = [
  {
    icon: Lock,
    title: "Yalnızca aktif aboneler",
    desc: "PWA kurulumu yalnızca geçerli aboneliği olan hesaplara açıktır.",
  },
  {
    icon: WifiOff,
    title: "API/PHI cache yok",
    desc: "Cihazda hasta verisi veya API anahtarı önbelleğe alınmaz.",
  },
  {
    icon: Bell,
    title: "Bildirim ve anlık erişim",
    desc: "Onaylı danışan mesajları için bildirim desteği; güvenli oturum zorunlu.",
  },
] as const;

export function MobileSection() {
  return (
    <section id="mobil" className="bg-surface py-20" aria-labelledby="mobile-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase text-primary">Mobil</p>
            <h2 id="mobile-heading" className="mb-4 font-display text-3xl font-bold text-off-black">
              PWA — Aboneye özel kurulum
            </h2>
            <p className="mb-8 leading-relaxed text-muted-foreground">
              {AIYA_BRAND_NAME} mobil erişimi; public bir uygulama değil, aktif abonelik sahibi diyetisyenler için sunulan gated
              bir avantajdır.
            </p>

            <ul className="flex flex-col gap-5">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon size={15} className="text-primary" />
                  </div>
                  <div>
                    <p className="mb-0.5 text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-8 border-l-2 border-border pl-3 text-xs text-muted-foreground">
              PWA kurulum linki dashboard&apos;unuzda aktif aboneliğiniz onaylandıktan sonra görünür.
            </p>
          </div>

          <div className="flex justify-center md:justify-end">
            <div className="relative">
              <div className="w-56 rounded-3xl border-4 border-off-black/20 bg-off-black/5 p-2 shadow-xl">
                <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                  <div className="flex items-center justify-between px-4 pb-2 pt-3">
                    <span className="text-[10px] font-semibold text-muted-foreground">09:41</span>
                    <div className="flex gap-1">
                      <div className="h-1.5 w-3 rounded-sm bg-muted-foreground/40" />
                      <div className="h-1.5 w-1.5 rounded-sm bg-muted-foreground/40" />
                    </div>
                  </div>
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-xs font-semibold text-off-black">{AIYA_BRAND_NAME}</p>
                    <p className="text-[10px] text-muted-foreground">Klinik çalışma alanı</p>
                  </div>
                  <div className="mx-4 mb-1 mt-3 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2">
                    <Smartphone size={12} className="text-primary" />
                    <span className="text-[10px] font-medium text-primary">1 yeni mesaj — onay bekliyor</span>
                  </div>
                  <div className="mx-4 mb-4 mt-2 rounded-md border border-border bg-muted/40 px-3 py-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      Durum: <span className="font-semibold text-foreground">Aktif abone</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="absolute left-1/2 top-0 mt-2 h-5 w-16 -translate-x-1/2 rounded-b-xl bg-off-black/20" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
