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
    color: "text-risk-low",
    bg: "bg-risk-low/10",
  },
  {
    icon: UserCheck,
    label: "Diyetisyen onayı",
    value: "Onaylandı",
    color: "text-sage",
    bg: "bg-sage/10",
  },
  {
    icon: CheckCircle,
    label: "Erişim",
    value: "Davetli",
    color: "text-primary",
    bg: "bg-primary/10",
  },
];

export function ProductPreview() {
  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      aria-label="SiriusAI ürün önizlemesi"
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/30 px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-risk-high/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-risk-medium/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-risk-low/60" />
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
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">AI Taslak</span>
                <Clock size={10} className="text-muted-foreground" />
              </div>
            ) : null}
            {message.role === "dietitian" ? (
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase text-sage">Diyetisyen</span>
                {message.approved ? <CheckCircle size={10} className="text-sage" /> : null}
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
            <span className="text-[10px] text-muted-foreground">{message.time}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
        {STATUS_PILLS.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`inline-flex items-center gap-1.5 rounded-full ${bg} px-2.5 py-1 text-[10px] font-medium ${color}`}>
            <Icon size={10} />
            <span className="text-muted-foreground">{label}:</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
