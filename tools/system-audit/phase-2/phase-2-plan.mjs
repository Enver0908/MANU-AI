export const AUDIT_PLAN_ID = "aiya-system-compatibility-reliability-release-readiness-v1";
export const AUDIT_PLAN_VERSION = "1.0.0";
export const PHASE_2_ID = "phase-2";

export const PHASE_2_STAGES = [
  {
    id: "2.1",
    title: "Gercek kataloglari karsilastir",
    prerequisiteStageIds: ["phase-1-closed"],
    requiredOutputFiles: ["catalog-reconciliation.json"],
    operations: [
      "Phase 1 kapanis kanitini ve guncel kaynak commitini dogrula.",
      "Yerel migration dosya setini, object tanimlarini ve imza/privilege beklentilerini cikar.",
      "Linked Supabase migration gecmisini salt-okunur olarak al ve yerel setle karsilastir.",
      "pg_catalog ve information_schema dumpini public semasi icin almaya calis; ham dumpi sadece ignored runtime altinda tut.",
      "Gercek katalogdan tablo, kolon, constraint, index, view, trigger, RPC imzasi/govdesi/owner/grant, RLS policy ve storage kanitlarini cikar.",
      "Migration beklentisi ile gercek katalog arasindaki farklari kaydet; tam katalog alinmadan asamayi VERIFIED yapma.",
    ],
    verificationRules: [
      "Phase 1 state CLOSED ve closure kaniti digest-gecerli olmali.",
      "Linked migration satirlari okunabilir ve local/remote history farki sifir olmali.",
      "Gercek public katalog dumpi alinabilir olmali; Docker/DB erisim hatasi PASS sayilmaz.",
      "RPC salt-okunur probe'lari beklenen imza davranisini ve servis-rolu privilege sinirini vermeli.",
      "Ham dump veya environment secret degeri docs kanitina yazilmamali.",
    ],
  },
  {
    id: "2.2",
    title: "Sapmalari siniflandir ve duzeltme listesini uret",
    prerequisiteStageIds: ["2.1"],
    requiredOutputFiles: ["schema-diff-classification.json"],
    operations: [
      "Her catalog farkini MISSING, DEFINITION_MISMATCH, PRIVILEGE_MISMATCH, HISTORY_MISMATCH veya INTENTIONALLY_DEFERRED olarak siniflandir.",
      "INTENTIONALLY_DEFERRED kaydini yalnizca aktif kodun nesneyi kullanmadigi kanitlandiginda kabul et.",
      "RPC, grant, tenant membership/profile/entitlement foreign key ve uniqueness sapmalarini blocker olarak isaretle.",
      "Her blocker icin migration dosyasi, bagimlilik sirasi, geri alma etkisi ve test senaryosu yaz.",
    ],
    verificationRules: [
      "Her fark tam olarak bir sinifa sahip olmali ve kaynak kaniti tasimali.",
      "Aktif kodun cagirdigi eksik RPC veya yanlis grant INTENTIONALLY_DEFERRED olamaz.",
      "Duzeltme sirasi dependency graph ile tutarli olmali.",
      "Duzeltme listesi ham secret veya kisi verisi icermemeli.",
    ],
  },
  {
    id: "2.3",
    title: "Duzeltmeleri izole hedefte uygula",
    prerequisiteStageIds: ["2.2"],
    requiredOutputFiles: ["isolated-reconciliation.json"],
    operations: [
      "Tum migrationlari temiz izole veritabaninda bastan uygula ve temiz kurulum sonucunu kaydet.",
      "Gercek semanin izole kopyasini sentetik kayitlarla yukselterek upgrade yolunu calistir.",
      "Yalnizca yeni forward-only migration ile farklari dependency order sirasinda uygula; eski migration dosyasini degistirme.",
      "Her migration icin transaction/lock/timeout/idempotency davranisini ve once/sonra kayit sayisini kaydet.",
      "Kesinti sonrasi yeniden calistirma ve yarim migration recovery senaryosunu calistir.",
    ],
    verificationRules: [
      "Hicbir linked veya production Supabase hedefinde yazma islemi yapilmamali.",
      "Temiz kurulum, upgrade, repair ve interrupted migration senaryolarinin tamami PASS olmali.",
      "Data loss, tenant cross-read, foreign-key ihlali, duplicate unique key veya idempotency ihlali sifir olmali.",
      "Uygulanan correction migrationlari forward-only ve digest ile izlenebilir olmali.",
    ],
  },
  {
    id: "2.4",
    title: "Schema contract kontrolunu genislet",
    prerequisiteStageIds: ["2.3"],
    requiredOutputFiles: ["schema-contract-matrix.json"],
    operations: [
      "Publish kapsamindaki zorunlu RPC, signature, return/error behavior ve privilege beklentilerini manifestte tanimla.",
      "Deploy preflight icinde servis-rolu basari/alan hatasi probe'larini ve anon privilege-denied probe'larini calistir.",
      "Missing helper, incorrect grant, wrong signature ve eski release uyumsuzlugunu deploy blocker yap.",
      "Eski release ile yeni release arasinda schema compatibility matrix ve rollback incompatibility kaydi uret.",
    ],
    verificationRules: [
      "Her zorunlu nesne icin imza, davranis ve privilege kaniti bulunmali.",
      "Beklenmeyen 2xx, PGRST202 veya permission drift PASS sayilmamali.",
      "Eski release rollback karari acik bir compatibility sonucuna dayanmali.",
      "Preflight contract testi local fixture ve remote read-only fixture ile PASS olmali.",
    ],
  },
];

export function getPhase2Stage(stageId) {
  const stage = PHASE_2_STAGES.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`unsupported_phase_2_stage:${stageId}`);
  return stage;
}
