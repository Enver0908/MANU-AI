import { KeyRound, Link2, MessageSquare, Search } from "lucide-react";

const STEPS = [
  {
    icon: MessageSquare,
    step: "01",
    title: "Talep bırak",
    desc: "İletişim formu aracılığıyla klinik bilgilerinizi ve kullanım amacınızı ekibimizle paylaşın.",
  },
  {
    icon: Search,
    step: "02",
    title: "Ekip değerlendirir",
    desc: "Ekibimiz talebinizi inceler, klinik uygunluğu ve pilot koşulları değerlendirir.",
  },
  {
    icon: KeyRound,
    step: "03",
    title: "Davet kodu oluşturulur",
    desc: "Onaylanan talepler için size özel davet kodu e-posta ile iletilir.",
  },
  {
    icon: Link2,
    step: "04",
    title: "Çalışma alanı bağlanır",
    desc: "Davet kodunuzla ödeme ve hesap bağlama adımlarını tamamlayın, çalışma alanınıza erişin.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section id="nasil-calisir" className="bg-surface py-20" aria-labelledby="how-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase text-primary">Süreç</p>
          <h2 id="how-heading" className="font-display text-3xl font-bold text-off-black">
            Nasıl çalışır?
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            SiriusAI self-serve bir platform değildir. Erişim, ekip değerlendirmesi ve davet kodu ile açılır.
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, step, title, desc }) => (
            <li key={step} className="relative flex flex-col gap-4 rounded-lg border border-border bg-paper p-6">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Icon size={18} className="text-primary" />
                </div>
                <span className="text-2xl font-bold text-muted-foreground">{step}</span>
              </div>
              <div>
                <h3 className="mb-1.5 font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
