import { Check } from "lucide-react";
import { AIYA_BRAND_NAME } from "@/lib/brand";
import { ProductPreview } from "./ProductPreview";

const BULLETS = [
  "AI taslak hazırlar, diyetisyen onaylar",
  "Otomatik risk sınıflaması",
  "Yalnızca davetli erişim",
] as const;

export function WorkspacePreviewSection() {
  return (
    <section id="workspace-preview" className="bg-paper py-6" aria-labelledby="workspace-preview-heading">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-12">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-semibold uppercase text-primary">Çalışma alanı</p>
            <h2 id="workspace-preview-heading" className="font-display text-2xl font-bold leading-snug text-off-black">
              {AIYA_BRAND_NAME} çalışma alanı
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Diyetisyen onaylı, AI destekli iletişim akışını ön izleyin. Her mesaj risk sınıflamasından geçer; uzman
              onayı olmadan danışana ulaşmaz.
            </p>
            <ul className="mt-5 flex flex-col gap-2 text-sm text-muted-foreground">
              {BULLETS.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check size={10} aria-hidden />
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex w-full shrink-0 justify-center md:w-auto md:justify-end">
            <ProductPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
