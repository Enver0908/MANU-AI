import { CheckCircle, Clock, ShieldCheck, UserCheck } from "lucide-react";

const MESSAGES = [
  {
    role: "client" as const,
    text: "Bugün çok yorgunum, hiçbir şey yemek istemedim.",
    time: "14:23",
  },
  {
    role: "ai" as const,
    text: "Taslak hazırlanıyor...",
    time: "14:23",
    draft: true,
  },
  {
    role: "dietitian" as const,
    text: "Anladım, bu zor bir gün gibi görünüyor. Hafif bir şeyler deneyelim mi?",
    time: "14:25",
    approved: true,
  },
];

const STATUS_PILLS = [
  {
    icon: ShieldCheck,
    label: "Risk ayrımı",
    value: "Düşük",
    riskDot: true,
  },
  {
    icon: UserCheck,
    label: "Diyetisyen onayı",
    value: "Onaylandı",
    riskDot: false,
  },
  {
    icon: CheckCircle,
    label: "Erişim",
    value: "Davetli",
    riskDot: false,
  },
];

export function ProductPreview() {
  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      aria-label="SiriusAI ürün önizlemesi"
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/30 px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <div className="h-2.5 w-2.5 rounded-full bg-ink-subtle" />
        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
        <span className="ml-2 text-xs text-muted-foreground">siriusai · çalışma alanı</span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {MESSAGES.map((message) => (
          <div
            key={`${message.role}-${message.time}`}
            className={`flex flex-col gap-1 ${message.role === "client" ? "items-end" : "items-start"}`}
          >
            {message.role === "ai" ? (
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase text-muted-foreground">AI Taslak</span>
                <Clock size={10} className="text-muted-foreground" aria-hidden />
              </div>
            ) : null}
            {message.role === "dietitian" ? (
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase text-foreground">Diyetisyen</span>
                {message.approved ? <CheckCircle size={10} className="text-primary" aria-hidden /> : null}
              </div>
            ) : null}
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                message.role === "client"
                  ? "bg-muted text-foreground"
                  : message.draft
                    ? "border border-dashed border-border bg-accent/40 text-muted-foreground italic"
                    : "bg-primary text-primary-foreground"
              }`}
            >
              {message.text}
            </div>
            <span className="text-xs text-muted-foreground">{message.time}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
        {STATUS_PILLS.map(({ icon: Icon, label, value, riskDot }) => (
          <div
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground"
          >
            <Icon size={10} className="text-primary" aria-hidden />
            <span className="text-muted-foreground">{label}:</span>
            {riskDot ? (
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-risk-low" aria-hidden />
                <span>{value}</span>
              </span>
            ) : (
              <span>{value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
