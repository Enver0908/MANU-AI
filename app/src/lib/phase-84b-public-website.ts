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
  contactCta: "Bize ulaşın",
  contactSectionTitle: "Erişim ve demo talebi",
  contactSectionBody:
    "AIya erişimi davetlidir. Henüz müşteri değilseniz ekibimizle iletişime geçin; uygunluk ve onboarding sürecini birlikte planlayalım.",
  contactFormNote:
    "Formu doldurarak erişim talebi bırakabilir veya doğrudan e-posta ile ulaşabilirsiniz.",
  demoPageTitle: "Yerel demo girişi",
  demoPageBody:
    "Bu kısayol yalnızca geliştirme veya açıkça etkinleştirilmiş demo ortamları içindir. Üretim müşteri girişi e-posta ve şifre ile yapılır.",
  demoButton: "Demo panelini aç",
  loginTitle: "Müşteri girişi",
  loginBody:
    "Kayıtlı AIya müşterileri e-posta ve şifreyle giriş yapar. Giriş bağlantısı isteğe bağlı yedek yöntemdir.",
  onboardingTitle: "Çalışma alanınızı bağlayın",
  onboardingBody:
    "Kurulum bağlantınız varsa bir sonraki adımda çalışma alanınızı bu hesaba bağlayabileceksiniz. Destek ekibimiz süreci tamamlamanıza yardımcı olabilir.",
  onboardingSupportTitle: "Erişim desteği gerekli",
  onboardingSupportBody:
    "Oturumunuz açık ancak bağlanacak aktif bir çalışma alanı bulunamadı. Davet, ödeme veya onboarding durumunuz için ekibimizle iletişime geçin.",
  footerNote:
    "AIya, diyetisyen-danışan iletişimi için davetli klinik çalışma alanıdır. Erişim ekip değerlendirmesi ile açılır.",
} as const;

export const PUBLIC_CONTACT_COPY = {
  heading: "Erişim talebi bırakın",
  processIntro:
    "Henüz müşteri değilseniz formu doldurun. Ekibimiz klinik uygunluğunuzu değerlendirip onay sonrası kurulum bağlantısı gönderir.",
  processSteps: [
    "Formu gönderin",
    "Ekibimiz 1-3 iş günü içinde ulaşır",
    "Onay sonrası kurulum bağlantısı e-posta ile gelir",
  ],
  successTitle: "Talebiniz başarıyla alındı",
  successBody:
    "Ekibimiz talebinizi inceleyecek ve uygunluk değerlendirmesinden sonra kurulum bağlantısını e-posta adresinize iletecektir.",
  errorRetry: "Talep gönderilemedi. Lütfen tekrar deneyin veya e-posta ile ulaşın.",
  errorGeneric: "Bir hata oluştu. Lütfen tekrar deneyin veya e-posta ile ulaşın.",
  unavailable: "Hata: Çevrimiçi form şu an kullanılamıyor. Lütfen e-posta ile ulaşın.",
  consentNote: "Formu göndererek ekibin klinik uygunluğu değerlendireceğini kabul etmiş olursunuz.",
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
    body: "Gelen danışan mesajından onay ve el devrine kadar aynı güvenlik sözleşmesi korunur.",
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
    body: "AIya otonom bir diyetisyen değildir. Ürün, denetimli iletişim desteği olarak konumlanır.",
    bullets: [
      "Danışana giden metinlerde AI kimliği açıklanmaz",
      "Tenant izolasyonu ve denetim kayıtları",
      "Erişim ekip onayı ve kurulum bağlantısı ile açılır",
    ],
  },
  {
    id: "onboarding",
    title: "Davetli onboarding",
    body: "Erişim iletişim talebi, ekip incelemesi ve kurulum bağlantısı ile başlar. Onaylı müşteriler e-posta ve şifreyle hesaplarını bağlar ve çalışma alanlarını talep eder.",
    bullets: [
      "İnceleme sonrası kurulum bağlantısı",
      "Aktif entitlement ile panel ve PWA kurulumu",
      "Ücretli tenantlara demo danışan verisi kopyalanmaz",
    ],
  },
] as const;
