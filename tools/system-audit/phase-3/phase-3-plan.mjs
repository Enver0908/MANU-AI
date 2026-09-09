export const AUDIT_PLAN_ID = "aiya-system-compatibility-reliability-release-readiness-v1";
export const AUDIT_PLAN_VERSION = "1.0.0";
export const PHASE_3_ID = "phase-3";

export const PHASE_3_STAGES = [
  {
    id: "3.1",
    title: "Backend route ve API sozlesmelerini sabitle",
    prerequisiteStageIds: ["phase-2-closed"],
    requiredOutputFiles: ["api-contract-matrix.json"],
    operations: [
      "app/src/app/api altindaki tum route.ts dosyalarini ve export edilen HTTP metodlarini kaynak satiri ile cikar.",
      "Her route'u tenant uygulama, AI chat, shell, ticari admin, auth, public commercial, webhook, demo veya release health siniflarindan tam olarak birine ata.",
      "Her route icin auth gate, tenant context, admin allowlist, request body/query parser, response/error serializer ve service-role erisimini kaydet.",
      "Tenant veya admin sinirindaki route'larda istemciden gelen tenant_id, user_id, auth_user_id veya dietitian_id degerinin yetki kaynagi olarak kullanilmasini reddet.",
      "Bilinmeyen route sinifi, koruma kapisi olmayan protected route, tanimsiz response ailesi veya client-supplied identity bulgusunu blocker olarak siniflandir.",
      "Route matrix ve source file digestlerini docs/system-audit/phase-3/api-contract-matrix.json icine secret degerleri olmadan yaz.",
    ],
    verificationRules: [
      "Phase 2 CLOSED ve tum 2.x stage evidence/output digestleri gecerli olmali.",
      "Tarama 116 route varsayimina baglanmadan mevcut tum route.ts dosyalarini kapsayabilmeli.",
      "Her route tam olarak bir contractClass, en az bir HTTP method ve bir verificationScenario tasimali.",
      "Protected route'lar bilinen auth/tenant/admin wrapper ile eslesmeli; unknown veya unguarded kayit sayisi sifir olmali.",
      "Client-supplied identity blocker sayisi sifir olmali.",
      "Cikti token, cookie, password, service-role key veya kisi verisi icermemeli.",
    ],
  },
  {
    id: "3.2",
    title: "Kimlik, session, admin allowlist ve API hata sozlesmesini dogrula",
    prerequisiteStageIds: ["3.1"],
    requiredOutputFiles: ["identity-contract-matrix.json"],
    operations: [
      "Supabase anon/server client ile service-role client sinirini ve auth cookie mutation yolunu kaynak koddan dogrula.",
      "Customer auth ve admin auth route'larinin password, magic-link, reset, callback, session ve logout akislarini siniflandir.",
      "Admin allowlist'in varsayilan iki hesabini ve MANU_ADMIN_EMAIL_ALLOWLIST override davranisini deger deger yazmadan dogrula.",
      "Admin GET erisiminde allowlist/token gate, admin mutation'larinda allowlist session ve same-origin kontrolunun bulunmasini dogrula.",
      "API hata payloadlarinda error/requestId ve ilgili field/revision aktariminin route helper ile client consumer arasinda korundugunu test et.",
      "Auth, admin, proxy, session ve request-id testlerini tek bir deterministic test kosusunda calistir; sonucu identity matrix'e ekle.",
    ],
    verificationRules: [
      "Service-role anahtari client bundle veya public env yoluna sizdirilmiyor olmali.",
      "Allowlist disi email, eksik session, gecersiz cookie ve origin mismatch fail-closed olmali.",
      "Auth cookie yazimi yalnizca server-side mutable adapter uzerinden olmali.",
      "Admin login ve reset route'lari allowlist disi email'i Supabase password akisi calismadan reddetmeli.",
      "Targeted identity/API testsin tamami PASS olmali; eski veya yanlis dosya okuyan test PASS sayilmaz.",
    ],
  },
  {
    id: "3.3",
    title: "Tenant veri erisimini ve cross-tenant izolasyonu dogrula",
    prerequisiteStageIds: ["3.2"],
    requiredOutputFiles: ["tenant-security-matrix.json"],
    operations: [
      "Phase 2 integrity surface ve route contract matrix'ten tenant kapsamli tablo/RPC erisimlerini tabloya bagli olarak eslestir.",
      "Local Supabase fixture'i temiz baslat; public schema migrationlarini uygula; remote veya production hedefinde yazma yapma.",
      "Iki sentetik tenant, iki authenticated actor ve service-role actor ile cross-tenant read, update, delete, insert ve RPC privilege senaryolarini calistir.",
      "Session activity, shell, AI chat, client, conversation, notification, commercial ve channel akislari icin mevcut RLS integration suite'i kos.",
      "Tenant identity'nin URL/body/query'den degil verified auth membership ve server-side context'ten turetildigini static ve runtime kanitla.",
      "Local fixture'i test sonunda durdur; ham database dump, JWT, cookie veya secret'i docs kanitina yazma.",
    ],
    verificationRules: [
      "Local RLS preflight skip edilirse PASS sayilmaz.",
      "Cross-tenant read/write/delete ve privilege bypass sayisi sifir olmali.",
      "Service-role kullanimi yalnizca server-side trusted operation olarak gorunmeli; client route'ta raw key veya client-controlled role bulunmamali.",
      "RLS suite, hosted-sandbox tenant isolation suite ve static identity scan birlikte PASS olmali.",
      "Linked Supabase veya production mutasyon kaniti bulunmali; bulunursa faz BLOCKED olmali.",
    ],
  },
  {
    id: "3.4",
    title: "Backend guvenlik kapanisini yap",
    prerequisiteStageIds: ["3.3"],
    requiredOutputFiles: ["backend-security-closure.json"],
    operations: [
      "3.1, 3.2 ve 3.3 output/evidence digestlerini tekrar hesapla ve stale kaniti reddet.",
      "Route, identity, admin, session, tenant isolation ve API error contract testlerinin final kosusunu yap.",
      "Her faz asamasinin operation listesindeki tum kayitlari PASS olarak isaretlenmeden closure olusturma.",
      "Blocker, unresolved dynamic route, failed test veya eksik output varsa phase-3 state'i BLOCKED birak ve closure yazma.",
      "Tum stage'ler VERIFIED ve outputlar digest-valid oldugunda backend-security-closure.json ile Phase 3'u CLOSED yap ve sonraki faz kilidini ac.",
    ],
    verificationRules: [
      "Dort stage'in her biri VERIFIED olmali.",
      "Tum required output ve stage evidence dosyalari mevcut ve digest-valid olmali.",
      "Final targeted test run PASS olmali.",
      "Closure kaniti source commit, stage evidence digestleri, test summary ve nextPhaseUnlocked alanlarini tasimali.",
      "Phase 3 CLOSED olmadan Phase 4 icin state veya uygulama degisikligi yapilmamali.",
    ],
  },
];

export function getPhase3Stage(stageId) {
  const stage = PHASE_3_STAGES.find((stage) => stage.id === stageId);
  if (!stage) throw new Error(`unsupported_phase_3_stage:${stageId}`);
  return stage;
}
