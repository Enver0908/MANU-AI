import { Bot, Building2, KeyRound, ShieldCheck, Split, User } from "lucide-react";

const ITEMS = [
  {
    icon: Bot,
    title: "Denetimli AI",
    desc: "Yapay zeka taslak üretir; her mesaj diyetisyen onayı olmadan danışana ulaşmaz.",
  },
  {
    icon: Split,
    title: "Risk ayrımı",
    desc: "Sistem mesajları klinik risk düzeyine göre sınıflandırır; yüksek risk otomatik olarak işaretlenir.",
  },
  {
    icon: User,
    title: "Diyetisyen kontrolü",
    desc: "Tüm iletişim akışı diyetisyen tarafından yönetilir. AI asistan rolündedir, karar verici değil.",
  },
  {
    icon: Building2,
    title: "Tenant izolasyonu",
    desc: "Her klinik çalışma alanı birbirinden izole edilmiştir. Veriler karışmaz.",
  },
  {
    icon: KeyRound,
    title: "Davet ve yetki mantığı",
    desc: "Erişim yalnızca geçerli davet kodu ve onaylı e-posta ile mümkündür.",
  },
  {
    icon: ShieldCheck,
    title: "Entitlement yönetimi",
    desc: "Abonelik ve erişim hakları merkezi olarak izlenir; inactive veya revoked hesaplara erişim kapatılır.",
  },
] as const;

export function SecuritySection() {
  return (
    <section id="guvenlik" className="bg-paper py-20" aria-labelledby="security-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase text-primary">Güvenlik</p>
          <h2 id="security-heading" className="font-display text-3xl font-bold text-off-black">
            Güvenli, denetimli, izole
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Klinik iletişim çalışma alanı; AI, güvenlik ve veri yönetimi prensipleri üzerine inşa edilmiştir.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sage/15">
                <Icon size={16} className="text-sage" />
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
