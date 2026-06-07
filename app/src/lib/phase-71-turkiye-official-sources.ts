import {
  OFFICIAL_REGULATION_CORPUS_VERSION,
  evaluateOfficialRegulationCorpusQa,
  type OfficialRegulationCorpusQaEvaluation,
  type OfficialRegulationCorpusQaInput,
  type OfficialRegulationDerivedRuleDraft,
  type OfficialRegulationGoldenCaseRecord,
  type OfficialRegulationPdfPageExtractionRecord,
  type OfficialRegulationPdfSourceRecord,
  type OfficialRegulationSectionRef,
} from "./official-regulation-corpus";

export const PHASE_71_TURKIYE_SOURCE_PACK_VERSION = "phase-71-turkiye-official-source-pack-v1";

export type Phase71SourcePriority = "P0" | "P1" | "P2";
export type Phase71SourceKind = "core_regulation" | "official_health_source" | "legal_ethics_source";

export type Phase71TurkiyeOfficialSource = {
  sourceId: string;
  priority: Phase71SourcePriority;
  kind: Phase71SourceKind;
  officialAuthority: string;
  title: string;
  jurisdiction: "Turkiye";
  publicationDate: string;
  versionNote: string;
  sourceUrl: string;
  pdfUrl?: string;
  officialGazetteUrl?: string;
  suggestedFileName: string;
  phase71Role: string;
  criticalSections: string[];
  impact: {
    green: string[];
    yellow: string[];
    red: string[];
  };
};

export type Phase71PdfArtifactEvidence = {
  sourceId: string;
  sha256: string;
  byteSize: number;
  pageCount: number;
  receivedAt: string;
  pageExtractions: OfficialRegulationPdfPageExtractionRecord[];
};

export type Phase71SourcePackReadiness = {
  status: "pass" | "fail";
  sourcePackVersion: string;
  blockingReasons: string[];
  sourceCount: number;
  p0SourceCount: number;
  p1SourceCount: number;
  p2SourceCount: number;
  missingP0SourceIds: string[];
};

export type Phase71CorpusIntakeEvaluation = {
  sourcePackReadiness: Phase71SourcePackReadiness;
  qaEvaluation: OfficialRegulationCorpusQaEvaluation;
  unknownArtifactSourceIds: string[];
  artifactSourceCount: number;
};

export const PHASE_71_REQUIRED_P0_SOURCE_IDS = [
  "TR-P71-001",
  "TR-P71-002",
  "TR-P71-003",
  "TR-P71-004",
  "TR-P71-005",
  "TR-P71-006",
  "TR-P71-007",
  "TR-P71-008",
  "TR-P71-009",
] as const;

export const PHASE_71_TURKIYE_OFFICIAL_SOURCES: Phase71TurkiyeOfficialSource[] = [
  {
    sourceId: "TR-P71-001",
    priority: "P0",
    kind: "core_regulation",
    officialAuthority: "T.C. Cumhurbaskanligi Mevzuat Bilgi Sistemi / TBMM",
    title: "1219 sayili Tababet ve Suabati San'atlarinin Tarzi Icrasina Dair Kanun",
    jurisdiction: "Turkiye",
    publicationDate: "1928-04-14 Resmi Gazete; kabul 1928-04-11",
    versionNote: "Guncel konsolide metin uygulama tarihinde tekrar dogrulanmali.",
    sourceUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.3.1219.pdf",
    suggestedFileName: "TR_001_1219_tababet_suabati_kanunu_current.pdf",
    phase71Role: "Saglik meslek mensuplarinin yetki siniri ve diyetisyen tanimi icin ana kanun kaynagi.",
    criticalSections: ["Ek Madde 13", "Diyetisyen tanimi", "Hekimlik/tibbi uygulama sinirlari"],
    impact: {
      green: ["Diyetisyen onayli aktif plan hatirlatmasi ve onayli alternatifler."],
      yellow: ["Plan degisikligi, porsiyon/makro/kalori ve hastalik baglaminda beslenme yorumu."],
      red: ["Tani, tedavi, ilac/insulin karari, acil belirti ve hekime ait tibbi karar alani."],
    },
  },
  {
    sourceId: "TR-P71-002",
    priority: "P0",
    kind: "core_regulation",
    officialAuthority: "T.C. Cumhurbaskanligi Mevzuat Bilgi Sistemi / TBMM",
    title: "3359 sayili Saglik Hizmetleri Temel Kanunu",
    jurisdiction: "Turkiye",
    publicationDate: "1987-05-15 Resmi Gazete; kabul 1987-05-07",
    versionNote: "Guncel konsolide metin uygulama tarihinde tekrar dogrulanmali.",
    sourceUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.3359.pdf",
    suggestedFileName: "TR_002_3359_saglik_hizmetleri_temel_kanunu_current.pdf",
    phase71Role: "Saglik hizmet sunumu, planlama, izin, denetim ve uzaktan saglik dayanaklari.",
    criticalSections: ["Saglik hizmetlerinin planlanmasi", "Bakanlik duzenleme ve denetim yetkileri"],
    impact: {
      green: ["Genel operasyonel bilgi, randevu/lojistik ve onayli plan hatirlatmalari."],
      yellow: ["Saglik hizmeti kapsaminda yorum, takip, izlem veya tedavi sureci talepleri."],
      red: ["Yetkisiz saglik hizmeti, acil/tani/tedavi alani ve onaysiz production saglik verisi isleme."],
    },
  },
  {
    sourceId: "TR-P71-003",
    priority: "P0",
    kind: "core_regulation",
    officialAuthority: "T.C. Saglik Bakanligi",
    title: "Saglik Meslek Mensuplari ile Saglik Hizmetlerinde Calisan Diger Meslek Mensuplarinin Is ve Gorev Tanimlarina Dair Yonetmelik",
    jurisdiction: "Turkiye",
    publicationDate: "2014-05-22 Resmi Gazete, Sayi 29007",
    versionNote: "Son degisiklik bilgisi uygulama tarihinde Mevzuat Bilgi Sistemi uzerinden dogrulanmali.",
    sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=19696&MevzuatTur=7&MevzuatTertip=5",
    pdfUrl: "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=19696&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5",
    suggestedFileName: "TR_003_saglik_meslek_gorev_tanimlari_current.pdf",
    phase71Role: "Diyetisyen gorev tanimi, meslek sinirlari ve hasta/plan kaynaklari icin ana yonetmelik.",
    criticalSections: ["Madde 1-4", "Madde 5", "Madde 6", "Ek-1 Diyetisyen"],
    impact: {
      green: ["Aktif diyet planindan kaynakli hatirlatma, ogun plani lookup ve onayli substitution."],
      yellow: ["Hasta baglaminda plan degisikligi, porsiyon/kalori/makro ve klinik beslenme yorumu."],
      red: ["Tani/tedavi, ilac/insulin, lab yorumu, acil belirti ve yetki siniri disi talepler."],
    },
  },
  {
    sourceId: "TR-P71-004",
    priority: "P0",
    kind: "core_regulation",
    officialAuthority: "T.C. Saglik Bakanligi",
    title: "Saglik Meslek Mensuplarinin Serbest Meslek Icrasi Hakkinda Yonetmelik",
    jurisdiction: "Turkiye",
    publicationDate: "2025-03-29 Resmi Gazete, Sayi 32856",
    versionNote: "Son degisiklik 2025-08-15 olarak not edildi; uygulama tarihinde tekrar dogrulanmali.",
    sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=42353&MevzuatTur=7&MevzuatTertip=5",
    pdfUrl: "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=42353&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5",
    suggestedFileName: "TR_004_saglik_meslek_serbest_meslek_icrasi_current.pdf",
    phase71Role: "Serbest calisan diyetisyen/saglik meslek hizmet birimi izin, ruhsat, faaliyet ve kayit sinirlari.",
    criticalSections: ["Madde 1-4", "Calisma esaslari", "Kayit olusturma ve saklama yukumlulugu"],
    impact: {
      green: ["Lisansli/uygun diyetisyen tarafindan onayli plan kaynaklarinin hatirlatilmasi."],
      yellow: ["Serbest meslek hizmeti, kayit, ruhsat, yetki veya hasta hizmeti belirsizligi."],
      red: ["Ruhsatsiz/yetkisiz saglik hizmeti ve onaysiz production saglik hizmeti sunumu."],
    },
  },
  {
    sourceId: "TR-P71-005",
    priority: "P0",
    kind: "core_regulation",
    officialAuthority: "T.C. Saglik Bakanligi",
    title: "Hasta Haklari Yonetmeligi",
    jurisdiction: "Turkiye",
    publicationDate: "1998-08-01 Resmi Gazete, Sayi 23420",
    versionNote: "Guncel konsolide metin uygulama tarihinde tekrar dogrulanmali.",
    sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4847&MevzuatTur=7&MevzuatTertip=5",
    pdfUrl: "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=4847&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5",
    suggestedFileName: "TR_005_hasta_haklari_yonetmeligi_current.pdf",
    phase71Role: "Bilgilendirme, mahremiyet, riza/onam, kayitlara erisim ve hasta haklari sinirlari.",
    criticalSections: ["Bilgi alma", "Mahremiyet", "Riza/onam", "Kucukler ve kanuni temsilci"],
    impact: {
      green: ["Onayli hukuki/operasyonel metinden dusuk riskli genel hak veya izin bilgilendirmesi."],
      yellow: ["Kayit talebi, riza/onam, hak sikayeti, mahremiyet, veli/vasilik ve veri erisim talebi."],
      red: ["Acil tibbi durum, riza disi mudahale iddiasi, hasta hakki ihlali veya hukuki sikayet."],
    },
  },
  {
    sourceId: "TR-P71-006",
    priority: "P0",
    kind: "core_regulation",
    officialAuthority: "T.C. Saglik Bakanligi",
    title: "Kisisel Saglik Verileri Hakkinda Yonetmelik",
    jurisdiction: "Turkiye",
    publicationDate: "2019-06-21 Resmi Gazete, Sayi 30808",
    versionNote: "2025-12-03 tarihli degisiklik dikkate alinmali.",
    sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=32610&MevzuatTur=7&MevzuatTertip=5",
    pdfUrl: "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=32610&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5",
    suggestedFileName: "TR_006_kisisel_saglik_verileri_yonetmeligi_current.pdf",
    phase71Role: "Ozel nitelikli saglik verisinin islenmesi, erisim, aktarim, imha, cocuk verisi ve mahremiyet.",
    criticalSections: ["Madde 1-4", "Saglik verilerine erisim", "Madde 14", "Madde 15"],
    impact: {
      green: ["Onayli privacy/izin akisiyle ilgili dusuk riskli operasyonel aciklama."],
      yellow: ["Veri erisim, silme, aktarim, veli/vasilik, hasta yakini paylasimi, e-Nabiz ve acik riza."],
      red: ["Izinsiz hassas saglik verisi aktarimi, raw saglik verisini prompt'a alma ve kimlik belirsizligi."],
    },
  },
  {
    sourceId: "TR-P71-007",
    priority: "P0",
    kind: "core_regulation",
    officialAuthority: "T.C. Saglik Bakanligi",
    title: "Uzaktan Saglik Hizmetlerinin Sunumu Hakkinda Yonetmelik",
    jurisdiction: "Turkiye",
    publicationDate: "2022-02-10 Resmi Gazete, Sayi 31746",
    versionNote: "Guncel konsolide metin uygulama tarihinde tekrar dogrulanmali.",
    sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=39363&MevzuatTur=7&MevzuatTertip=5",
    pdfUrl: "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=39363&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5",
    officialGazetteUrl: "https://www.resmigazete.gov.tr/eskiler/2022/02/20220210-2.htm",
    suggestedFileName: "TR_007_uzaktan_saglik_hizmetleri_yonetmeligi_current.pdf",
    phase71Role: "WhatsApp-first/remote messaging urununun uzaktan saglik hizmeti sayilabilecegi sinirlar.",
    criticalSections: ["Madde 1-4", "Sistem izin/tescil", "Kimlik dogrulama", "Madde 12"],
    impact: {
      green: ["Randevu, teknik kanal, plan hatirlatma gibi onayli lojistik akisi."],
      yellow: ["Uzaktan takip, gozlem, danismanlik, tedavi sureci, tetkik sonucu veya klinik bulgu."],
      red: ["Uzaktan tani/tedavi, e-recete/e-rapor, ilac/insulin karari, acil belirti ve launch gate olmadan real remote health service."],
    },
  },
  {
    sourceId: "TR-P71-008",
    priority: "P0",
    kind: "core_regulation",
    officialAuthority: "T.C. Saglik Bakanligi",
    title: "Saglik Bilgi Yonetim Sistemleri Hakkinda Yonetmelik",
    jurisdiction: "Turkiye",
    publicationDate: "2022-08-25 Resmi Gazete, Sayi 31934",
    versionNote: "Guncel konsolide metin uygulama tarihinde tekrar dogrulanmali.",
    sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=39682&MevzuatTur=7&MevzuatTertip=5",
    pdfUrl: "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=39682&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5",
    suggestedFileName: "TR_008_saglik_bilgi_yonetim_sistemleri_yonetmeligi_current.pdf",
    phase71Role: "Saglik bilgi sistemi, loglama, entegrasyon, veri standartlari ve software compliance sinirlari.",
    criticalSections: ["Madde 1-4", "Madde 5", "KTS/kayit tescil", "Loglama"],
    impact: {
      green: ["Client-facing clinical response icin dogrudan kaynak degil; operasyonel compliance kaynagi."],
      yellow: ["Veri standardi, log, entegrasyon, saglik bilgi sistemi kayit/tescil belirsizligi."],
      red: ["Production saglik veri sistemi gibi davranma, kayitsiz entegrasyon ve raw health data leakage."],
    },
  },
  {
    sourceId: "TR-P71-009",
    priority: "P0",
    kind: "core_regulation",
    officialAuthority: "T.C. Saglik Bakanligi",
    title: "Saglik Hizmetlerinde Tanitim ve Bilgilendirme Faaliyetleri Hakkinda Yonetmelik",
    jurisdiction: "Turkiye",
    publicationDate: "2025-11-12 Resmi Gazete, Sayi 33075",
    versionNote: "2025 guncel metin; 2023 yonetmeligi yururlukten kalkmistir.",
    sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=42694&MevzuatTur=7&MevzuatTertip=5",
    pdfUrl: "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=42694&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5",
    officialGazetteUrl: "https://www.resmigazete.gov.tr/eskiler/2025/11/20251112-2.htm",
    suggestedFileName: "TR_009_saglik_tanitim_bilgilendirme_yonetmeligi_2025_current.pdf",
    phase71Role: "Client-facing product copy, WhatsApp mesaj tonu, reklam/tanitim siniri ve yaniltici iddia bloklari.",
    criticalSections: ["Madde 1-4", "Madde 5", "Mahremiyet/KVKK", "Madde 13"],
    impact: {
      green: ["Sagligi koruyucu/gelistirici, kaynakli, yaniltici olmayan genel bilgilendirme."],
      yellow: ["Basari vaadi, kilo verme iddiasi, once/sonra, hasta yorumu, kampanya ve belirsiz uzmanlik iddiasi."],
      red: ["Yetkisiz saglik hizmeti tanitimi, insan sagligini tehlikeye atabilecek iddia ve tani/tedavi surecini olumsuz etkileyen icerik."],
    },
  },
  {
    sourceId: "TR-P71-010",
    priority: "P1",
    kind: "official_health_source",
    officialAuthority: "T.C. Saglik Bakanligi Halk Sagligi Genel Mudurlugu",
    title: "Turkiye Beslenme Rehberi (TUBER) 2022",
    jurisdiction: "Turkiye",
    publicationDate: "2022",
    versionNote: "TUBER 2022; HSGM resmi linkleri uygulama tarihinde dogrulanmali.",
    sourceUrl: "https://hsgm.saglik.gov.tr/depo/birimler/saglikli-beslenme-ve-hareketli-hayat-db/Dokumanlar/Rehberler/Turkiye_Beslenme_Rehber_TUBER_2022_min.pdf",
    pdfUrl: "https://hsgm.saglik.gov.tr/media/attachments/2025/05/12/turkiye-beslenme-rehberi-2022.pdf",
    suggestedFileName: "TR_010_tuber_2022_turkiye_beslenme_rehberi.pdf",
    phase71Role: "Genel saglikli beslenme egitimi ve green general education icin resmi kaynak adayi.",
    criticalSections: ["Yasam evreleri", "Besin gruplari", "Su/tuz/seker/yag", "Fiziksel aktivite"],
    impact: {
      green: ["Genel, kaynakli, dusuk riskli saglikli beslenme egitimi."],
      yellow: ["Aktif plani degistirecek, kalori/makro/porsiyon belirleyecek veya hastalik baglaminda kisisellestirecek talepler."],
      red: ["Diyabet, gebelik, minor, eating disorder veya acil belirti baglaminda otomatik tavsiye."],
    },
  },
  {
    sourceId: "TR-P71-011",
    priority: "P1",
    kind: "official_health_source",
    officialAuthority: "T.C. Saglik Bakanligi Halk Sagligi Genel Mudurlugu",
    title: "Turkiye Diyabet Programi 2023-2027",
    jurisdiction: "Turkiye",
    publicationDate: "2023/2024 HSGM resmi program yayini",
    versionNote: "2023-2027 program donemi.",
    sourceUrl: "https://hsgm.saglik.gov.tr/depo/birimler/saglikli-beslenme-ve-hareketli-hayat-db/Dokumanlar/Programlar/Turkiye-Diyabet-Programi.pdf",
    suggestedFileName: "TR_011_turkiye_diyabet_programi_2023_2027.pdf",
    phase71Role: "Diyabet baglaminin hassas klinik risk oldugunu ve genel farkindalik sinirlarini belirlemek.",
    criticalSections: ["Diyabetin onlenmesi", "Erken tani", "Komplikasyonlar", "Ulusal program hedefleri"],
    impact: {
      green: ["Diyabet hakkinda genel farkindalik veya planina uygun hareket et turu kaynakli dusuk riskli bilgi."],
      yellow: ["Glukoz sayisi, diyabetli client beslenme degisikligi, ogun/karbonhidrat ayari, gebelik diyabeti ve semptom yorumu."],
      red: ["Hipoglisemi/hiperglisemi acil belirtileri, insulin/ilac dozu ve ciddi semptom."],
    },
  },
  {
    sourceId: "TR-P71-012",
    priority: "P1",
    kind: "official_health_source",
    officialAuthority: "T.C. Saglik Bakanligi",
    title: "Obezite Uniteleri ve Obezite Cerrahisi Uygulama Uniteleri Hakkinda Yonetmelik",
    jurisdiction: "Turkiye",
    publicationDate: "2025-11-12 Resmi Gazete, Sayi 33075",
    versionNote: "Guncel metin uygulama tarihinde tekrar dogrulanmali.",
    sourceUrl: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=42693&MevzuatTur=7&MevzuatTertip=5",
    pdfUrl: "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=42693&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5",
    suggestedFileName: "TR_012_obezite_uniteleri_yonetmeligi_2025_current.pdf",
    phase71Role: "Obezite tedavisi/cerrahisi baglaminin saglik hizmeti ve klinik uzmanlik alani oldugunu belirlemek.",
    criticalSections: ["Madde 1-3", "Obezite birimleri", "Obezite cerrahisi uygulama birimleri", "Madde 13"],
    impact: {
      green: ["Genel saglikli yasam ve diyetisyen onayli aktif plan hatirlatmasi."],
      yellow: ["Obezite tedavisi, cerrahi, ilac, klinik degerlendirme, hedef kilo/kalori/porsiyon degisikligi."],
      red: ["Cerrahi komplikasyon, ciddi semptom, acil belirti ve ilac/tedavi yonetimi."],
    },
  },
  {
    sourceId: "TR-P71-013",
    priority: "P1",
    kind: "legal_ethics_source",
    officialAuthority: "T.C. Cumhurbaskanligi Mevzuat Bilgi Sistemi / TBMM",
    title: "6698 sayili Kisisel Verilerin Korunmasi Kanunu",
    jurisdiction: "Turkiye",
    publicationDate: "2016-04-07 Resmi Gazete; kabul 2016-03-24",
    versionNote: "Guncel konsolide metin uygulama tarihinde tekrar dogrulanmali.",
    sourceUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf",
    suggestedFileName: "TR_013_6698_kvkk_current.pdf",
    phase71Role: "Saglik verisi ozel nitelikli kisisel veri oldugu icin temel privacy hukuku kaynagi.",
    criticalSections: ["Ozel nitelikli kisisel veri", "Acik riza", "Aydinlatma", "Aktarim", "Veri guvenligi"],
    impact: {
      green: ["Onayli privacy metninden genel izin/aydinlatma hatirlatmasi."],
      yellow: ["DSAR, silme, aktarim, acik riza, yurtdisi aktarim ve provider/vendor sorulari."],
      red: ["Izinsiz hassas veri isleme/aktarim, raw client health data egress ve secret ifsasi."],
    },
  },
  {
    sourceId: "TR-P71-014",
    priority: "P2",
    kind: "legal_ethics_source",
    officialAuthority: "T.C. Cumhurbaskanligi Mevzuat Bilgi Sistemi / Bakanlar Kurulu",
    title: "Tibbi Deontoloji Nizamnamesi",
    jurisdiction: "Turkiye",
    publicationDate: "1960-02-19 Resmi Gazete, Sayi 10436; kabul 1960-01-13",
    versionNote: "Guncel konsolide metin uygulama tarihinde tekrar dogrulanmali.",
    sourceUrl: "https://www.mevzuat.gov.tr/MevzuatMetin/2.3.412578.pdf",
    suggestedFileName: "TR_014_tibbi_deontoloji_nizamnamesi_current.pdf",
    phase71Role: "Mahremiyet, meslek sirri, reklam/tanitim ve acil durum etik sinirlari icin destekleyici kaynak.",
    criticalSections: ["Madde 2", "Madde 3", "Madde 4", "Reklam/tanitim sinirlari"],
    impact: {
      green: ["Client-facing klinik cevap icin birincil kaynak degil; etik policy/covenant destek kaynagi."],
      yellow: ["Mahremiyet, meslek sirri, tanitim/reklam ve acil olmayan etik belirsizlikler."],
      red: ["Acil vaka, meslek sirri ihlali, hasta kimligi ifsasi ve yetkisiz klinik iddia."],
    },
  },
];

export function evaluatePhase71TurkiyeSourcePackReadiness(
  sources: Phase71TurkiyeOfficialSource[] = PHASE_71_TURKIYE_OFFICIAL_SOURCES,
): Phase71SourcePackReadiness {
  const blockingReasons = new Set<string>();
  const seenSourceIds = new Set<string>();
  const suppliedSourceIds = new Set(sources.map((source) => source.sourceId));

  for (const sourceId of PHASE_71_REQUIRED_P0_SOURCE_IDS) {
    if (!suppliedSourceIds.has(sourceId)) blockingReasons.add(`missing P0 source: ${sourceId}`);
  }

  for (const source of sources) {
    if (seenSourceIds.has(source.sourceId)) blockingReasons.add(`duplicate source id: ${source.sourceId}`);
    seenSourceIds.add(source.sourceId);
    if (!source.sourceId.trim()) blockingReasons.add("source is missing id");
    if (!source.officialAuthority.trim()) blockingReasons.add(`source ${source.sourceId} is missing authority`);
    if (!source.title.trim()) blockingReasons.add(`source ${source.sourceId} is missing title`);
    if (!source.sourceUrl.trim()) blockingReasons.add(`source ${source.sourceId} is missing source URL`);
    if (!source.suggestedFileName.trim()) blockingReasons.add(`source ${source.sourceId} is missing file name`);
    if (source.criticalSections.length === 0) {
      blockingReasons.add(`source ${source.sourceId} is missing critical sections`);
    }
  }

  return {
    status: blockingReasons.size === 0 ? "pass" : "fail",
    sourcePackVersion: PHASE_71_TURKIYE_SOURCE_PACK_VERSION,
    blockingReasons: [...blockingReasons],
    sourceCount: sources.length,
    p0SourceCount: sources.filter((source) => source.priority === "P0").length,
    p1SourceCount: sources.filter((source) => source.priority === "P1").length,
    p2SourceCount: sources.filter((source) => source.priority === "P2").length,
    missingP0SourceIds: PHASE_71_REQUIRED_P0_SOURCE_IDS.filter((sourceId) => !suppliedSourceIds.has(sourceId)),
  };
}

export function buildPhase71TurkiyeCorpusQaInput(input: {
  corpusVersion?: string;
  sources?: Phase71TurkiyeOfficialSource[];
  artifacts: Phase71PdfArtifactEvidence[];
  sectionRefs: OfficialRegulationSectionRef[];
  derivedRuleDrafts: OfficialRegulationDerivedRuleDraft[];
  goldenCases: OfficialRegulationGoldenCaseRecord[];
}): OfficialRegulationCorpusQaInput {
  const sources = input.sources || PHASE_71_TURKIYE_OFFICIAL_SOURCES;
  const sourceById = new Map(sources.map((source) => [source.sourceId, source]));
  const pdfSources: OfficialRegulationPdfSourceRecord[] = [];

  for (const artifact of input.artifacts) {
    const source = sourceById.get(artifact.sourceId);
    if (!source) continue;
    pdfSources.push({
      id: source.sourceId,
      title: source.title,
      jurisdiction: source.jurisdiction,
      publisher: source.officialAuthority,
      sourceUrl: source.pdfUrl || source.sourceUrl,
      fileName: source.suggestedFileName,
      sha256: artifact.sha256,
      byteSize: artifact.byteSize,
      pageCount: artifact.pageCount,
      receivedAt: artifact.receivedAt,
    });
  }

  return {
    corpusVersion:
      input.corpusVersion ||
      `${PHASE_71_TURKIYE_SOURCE_PACK_VERSION}+${OFFICIAL_REGULATION_CORPUS_VERSION}`,
    sources: pdfSources,
    pageExtractions: input.artifacts.flatMap((artifact) => artifact.pageExtractions),
    sectionRefs: input.sectionRefs,
    derivedRuleDrafts: input.derivedRuleDrafts,
    goldenCases: input.goldenCases,
  };
}

export function evaluatePhase71TurkiyeCorpusIntake(input: {
  sources?: Phase71TurkiyeOfficialSource[];
  artifacts: Phase71PdfArtifactEvidence[];
  sectionRefs: OfficialRegulationSectionRef[];
  derivedRuleDrafts: OfficialRegulationDerivedRuleDraft[];
  goldenCases: OfficialRegulationGoldenCaseRecord[];
}): Phase71CorpusIntakeEvaluation {
  const sources = input.sources || PHASE_71_TURKIYE_OFFICIAL_SOURCES;
  const sourceIds = new Set(sources.map((source) => source.sourceId));
  const unknownArtifactSourceIds = Array.from(
    new Set(input.artifacts.map((artifact) => artifact.sourceId).filter((sourceId) => !sourceIds.has(sourceId))),
  );
  const qaInput = buildPhase71TurkiyeCorpusQaInput({ ...input, sources });
  const qaEvaluation = evaluateOfficialRegulationCorpusQa(qaInput);

  return {
    sourcePackReadiness: evaluatePhase71TurkiyeSourcePackReadiness(sources),
    qaEvaluation:
      unknownArtifactSourceIds.length === 0
        ? qaEvaluation
        : {
            ...qaEvaluation,
            status: "fail",
            blockingReasons: [
              ...qaEvaluation.blockingReasons,
              ...unknownArtifactSourceIds.map((sourceId) => `artifact references unknown Phase 71 source ${sourceId}`),
            ],
          },
    unknownArtifactSourceIds,
    artifactSourceCount: new Set(input.artifacts.map((artifact) => artifact.sourceId)).size,
  };
}
