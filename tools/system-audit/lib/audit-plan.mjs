export const AUDIT_PLAN_ID = "aiya-system-compatibility-reliability-release-readiness-v1";
export const AUDIT_PLAN_VERSION = "1.0.0";
export const PHASE_1_ID = "phase-1";

export const PHASE_1_STAGES = [
  {
    id: "1.1",
    title: "Başlangıcı sabitle",
    prerequisiteStageIds: [],
    requiredOutputFiles: ["baseline.json"],
    operations: [
      "Kaydedilmiş faz giriş gözlemini doğrula.",
      "Aktif dalı, HEAD commitini, çalışma ağacı durumunu ve upstream bilgisini kaydet.",
      "Güncel karar ve kanıt belgelerinin varlığını ve SHA-256 özetlerini kaydet.",
      "Tarihsel belge ile güncel otorite arasındaki çelişkileri ayrı listele.",
    ],
    verificationRules: [
      "phase-entry.json ile branch, HEAD ve temiz çalışma ağacı bilgisi eşleşmeli.",
      "Otorite belgelerinin her biri mevcut olmalı ve contentSha256 taşımalı.",
      "Çıktı, sır veya kişisel veri içermemeli.",
    ],
  },
  {
    id: "1.2",
    title: "Aşama kontrolünü kur",
    prerequisiteStageIds: ["1.1"],
    requiredOutputFiles: ["plan-manifest.json"],
    operations: [
      "Audit planı, fazı ve dört aşamanın sıralı sözleşmesini yaz.",
      "Aşama durum geçişlerini ve öncül aşama kilidini tanımla.",
      "EvidenceDigest, stage evidence ve phase closure alanlarını tanımla.",
      "Eksik kanıt, eski özet, yanlış sıra ve atlama durumlarını reddeden kontrolü doğrula.",
    ],
    verificationRules: [
      "Plan manifesti bu plan kimliği/sürümüyle eşleşmeli.",
      "Aşamalar tam olarak 1.1, 1.2, 1.3, 1.4 sırasında bulunmalı.",
      "Her aşamanın operasyon, ön koşul, çıktı ve doğrulama kuralı bulunmalı.",
    ],
  },
  {
    id: "1.3",
    title: "Sistem envanterini ve bağlantıları çıkar",
    prerequisiteStageIds: ["1.2"],
    requiredOutputFiles: ["system-inventory.json", "coverage-matrix.json"],
    operations: [
      "Route dosyalarını TypeScript/JavaScript syntax tree üzerinden çıkar.",
      "Supabase table/RPC/storage çağrılarını ve fetch dış çağrılarını kaynak konumuyla kaydet.",
      "Ortam değişkeni referanslarını değerleri kaydetmeden çıkar.",
      "Worker girişlerini, çözülemeyen dinamik hedefleri ve her kaydın bağlı doğrulama senaryosunu üret.",
    ],
    verificationRules: [
      "Inventory yalnızca izin verilen kaynak köklerini taramalı.",
      "Her bağlantı kaydı kaynak, satır, hedef/işlem ve verificationScenario taşımalı.",
      "Coverage matrix inventory kayıtlarının tamamını tam bir kez kapsamalı.",
      "Dinamik hedefler unresolvedReferences içinde açıkça görünmeli; gizlenmemeli.",
    ],
  },
  {
    id: "1.4",
    title: "Ortamları ve kapsam dağılımını sabitle",
    prerequisiteStageIds: ["1.3"],
    requiredOutputFiles: ["environment-map.json"],
    operations: [
      "Local, hosted_sandbox ve production profillerini aynı şemayla kaydet.",
      "Environment key varlığını değerleri kaydetmeden raporla.",
      "Canlı public/admin release health endpointlerini salt okunur kontrol et.",
      "Servis komutlarını, worker girişlerini, GitHub workflowlarını ve hedef faz bağlantılarını eşleştir.",
    ],
    verificationRules: [
      "Üç profil de mevcut olmalı; production NO-GO durumu korunmalı.",
      "Secret değerleri, tokenlar ve cookie içerikleri çıktıda bulunmamalı.",
      "Hosted release sonucu HTTP durumu ve release kimliğiyle kaydedilmeli.",
      "Her environment/servis kaydı bir verificationScenario taşımalı.",
    ],
  },
];

export function getPhaseDefinition(phaseId) {
  if (phaseId !== PHASE_1_ID) {
    throw new Error(`unsupported_phase:${phaseId}`);
  }
  return { id: PHASE_1_ID, title: "Denetim Kontrolü, Sistem Envanteri ve Ortam Haritası", stageIds: PHASE_1_STAGES.map((stage) => stage.id) };
}

export function getStageDefinition(stageId) {
  const stage = PHASE_1_STAGES.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`unsupported_stage:${stageId}`);
  return stage;
}
