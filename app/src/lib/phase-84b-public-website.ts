/**
 * Phase 84B professional AIya public marketing website: copy, contact,
 * and env-gated demo entry. No auth, billing, or lead-storage logic here.
 */

import { AIYA_BRAND_NAME, AIYA_PUBLIC_CONTACT_EMAIL } from "./brand";

export const PHASE_84B_VERSION = "phase84-public-website-v1";

/** Public business inbox for access and demo requests. */
export const SIRIUSAI_PUBLIC_CONTACT_EMAIL = AIYA_PUBLIC_CONTACT_EMAIL;
export const AIYA_MARKETING_CONTACT_EMAIL = AIYA_PUBLIC_CONTACT_EMAIL;

export function isPublicDemoLoginEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === "development" && env.MANU_ALLOW_PUBLIC_DEMO_LOGIN === "true";
}

export function buildContactMailtoUrl(subject = `${AIYA_BRAND_NAME} erişim talebi`): string {
  const params = new URLSearchParams({
    subject,
  });
  return `mailto:${AIYA_MARKETING_CONTACT_EMAIL}?${params.toString()}`;
}

export const PUBLIC_MARKETING_COPY = {
  brand: AIYA_BRAND_NAME,
  tagline: "Diyetisyenler için denetimli mesajlaşma asistanı",
  heroTitle: "Danışan mesajlarını güvenle yönetin, klinik kontrol sizde kalsın",
  heroSubtitle:
    "AIya rutin danışan iletişimini hızlandırır; riskli beslenme ve sağlık mesajlarını diyetisyen onayına yükseltir. Web paneli ve kurulabilir mobil PWA aynı güvenli yüzeyi paylaşır.",
  loginLabel: "Giriş yap",
  purchaseLabel: "Satın al",
  contactCta: "Bizimle iletişime geçin",
  contactSectionTitle: "Erişim ve demo talebi",
  contactSectionBody:
    "AIya erişimi davetlidir. Henüz müşteri değilseniz ekibimizle iletişime geçin; uygunluk ve onboarding sürecini birlikte planlayalım.",
  contactFormNote:
    "Formu doldurarak erişim talebi bırakabilir veya doğrudan e-posta ile ulaşabilirsiniz.",
  demoPageTitle: "Yerel demo girişi",
  demoPageBody:
    "Bu kısayol yalnızca geliştirme veya açıkça etkinleştirilmiş demo ortamları içindir. Üretim müşteri girişi magic link ile yapılır.",
  demoButton: "Demo panelini aç",
  loginTitle: "Müşteri girişi",
  loginBody:
    "Kayıtlı AIya müşterileri e-posta adreslerine gönderilen tek kullanımlık giriş bağlantısı ile oturum açar.",
  onboardingTitle: "Çalışma alanınızı bağlayın",
  onboardingBody:
    "Ödemeniz doğrulandıysa bir sonraki adımda çalışma alanınızı bu hesaba bağlayabileceksiniz. Şimdilik destek ekibimiz süreci tamamlamanıza yardımcı olabilir.",
  onboardingSupportTitle: "Erişim desteği gerekli",
  onboardingSupportBody:
    "Oturumunuz açık ancak bağlanacak aktif bir çalışma alanı bulunamadı. Davet, ödeme veya onboarding durumunuz için ekibimizle iletişime geçin.",
  footerNote:
    "Bu yüzey tanıtım amaçlıdır ve gerçek danışan verisi göstermez. Üretim klinik kullanımı ayrı onaylara tabidir. Üretim pilotu NO-GO.",
} as const;

export const PUBLIC_MARKETING_SECTIONS = [
  {
    id: "value",
    title: "Diyetisyen odaklı operasyon",
    body: "Tek panelden danışanlar, görüşmeler, taslak onayları ve el devir kuyruğu. Yoğun klinik günlerde tarama hızı önceliklidir.",
    bullets: [
      "Danışan bazlı AI modu ve persona kontrolü",
      "Mesaj kökeni: danışan, diyetisyen, sistem",
      "Kritik bağlam ve iç copilot ile kaynak referanslı iç görü",
    ],
  },
  {
    id: "safety",
    title: "Denetimli AI güvenlik modeli",
    body: "Yeşil, sarı ve kırımızı risk sınıflandırması klinik iş akışını yönlendirir. Riskli durumlarda otomatik danışana gönderim yapılmaz.",
    bullets: [
      "Sarı mesajlar onay taslağı olarak bekler",
      "Kırmızı mesajlar insan devrine alınır",
      "Belirsiz veya eksik bağlamda fail-closed davranış",
    ],
  },
  {
    id: "workflow",
    title: "Günlük iş akışı",
    body: "Gelen mesaj simülasyonundan canlı kanal hazırlığına kadar aynı güvenlik sözleşmesi korunur.",
    bullets: [
      "Görüşme zaman çizelgesi ve AI karar izi",
      "Manuel yanıt, taslak onayı ve el devir çözümü",
      "Form, menü ve gıda kuralları manuel kaynak otoritesi",
    ],
  },
  {
    id: "mobile",
    title: "Mobil PWA erişimi",
    body: "Aboneler uygulamayı telefon ana ekranına kurabilir. Service worker yalnızca kabuk ve statik varlıkları önbelleğe alır; API yanıtları ağ üzerinden kalır.",
    bullets: [
      "Mobil alt gezinme ile tam panel eşlemesi",
      "44px dokunma hedefleri ve safe-area desteği",
      "Acil el devir ve taslak onayı için mobil ergonomi",
    ],
  },
  {
    id: "governance",
    title: "Klinik yönetişim sınırları",
    body: "AIya otonom bir diyetisyen değildir. Ürün, denetimli iletişim desteği olarak konumlanır; üretim pilotu ve dış onaylar ayrı kapılara tabidir.",
    bullets: [
      "Danışana giden metinlerde AI kimliği açıklanmaz",
      "Tenant izolasyonu ve denetim kayıtları",
      "Sandbox faturalandırma; canlı Stripe ayrı onay gerektirir",
    ],
  },
  {
    id: "onboarding",
    title: "Davetli onboarding",
    body: "Erişim davet ve sandbox ödeme ile başlar. Onaylı müşteriler magic link ile hesaplarını bağlar ve çalışma alanlarını talep eder.",
    bullets: [
      "Davet + Stripe test ödeme doğrulaması",
      "Aktif entitlement ile panel ve PWA kurulumu",
      "Ücretli tenantlara demo danışan verisi kopyalanmaz",
    ],
  },
] as const;
