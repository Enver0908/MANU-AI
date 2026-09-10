# AIya Performans Plani 1 - Gecerli Olcum ve Kok Neden Kanitlama

## Guncel uygulama durumu

Plan 1 Faz 1 asamalari 1.1-1.5 sirayla tamamlandi ve faz kapanis kontrolu `PASS` oldu. Faz 2 asamalari 2.1-2.5 de sirayla tamamlandi; evidence: `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json`. Faz 3 asamalari 3.1-3.6 da sirayla tamamlandi; evidence: `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json`; sonuc `COMPLETE / SYNTHETIC_AUTH_STORE_READY`. Local fixture, gercek password session ve normal RLS/store sinirlari hazirlandi; gecerli authenticated performans baseline'i, donma yeniden uretimi, kok neden atfi ve runtime degisikligi yapilmadi. Plan 1 Faz 4 bir sonraki tek uygun adimdir; production `NO-GO` kalir.

## Durum

Plan 1, Revizyon 2 performans eylem planinin ilk bes adimini kapsar:

1. Kaynak, bulgu ve kapanis sozlesmesini kilitlemek.
2. Gecerli olcum harness'ini ve negatif kontrolleri hazirlamak.
3. Gercek auth/store kullanan sentetik ortamlar kurmak.
4. Eslesmis baseline olcumlerini almak ve kasmayi yeniden uretmek.
5. Katman bazli kontrollu deneylerle kok nedeni kanitlamak.

Bu belge Plan 1'in uygulama sozlesmesidir. Plan 1 icinde runtime performans optimizasyonu, migration, deploy, production verisi veya production gate degisikligi yapilmaz.

## Degismez uygulama kurali

Plan icindeki fazlar ve asamalar sirayla uygulanir. Bir asamanin tamamlanma kriteri saglanmadan sonraki asama baslatilmaz. Her fazdaki butun asamalar tamamlanmadan faz sonu testlerine gecilmez. Tum testlerin `PASS` olmasi tek basina faz kapanisi sayilmaz; asama ledger'inda tarif edilen islemlerin tamami ve evidence ciktilari da mevcut olmalidir.

Bir asama `FAILED`, `BLOCKED` veya `STALE` olursa sonraki asamalar calistirilmaz. Eksik veya gecersiz bir ornek percentile hesabindan gizlenmez. Runtime kok nedeni kanitlanmayan bulgu Plan 2'ye alinmaz.

## Faz 1 - Kaynak, bulgu ve kapanis sozlesmesinin kilitlenmesi

### Amac

Guncel Git/live kimliklerini, tarihsel evidence butunlugunu, bes performans bulgusunu, dokuz olcum senaryosunu, butceleri ve her bulgunun sonuclanma kosullarini tek bir evidence zincirine baglamak.

### Sirali asamalar

#### 1.1 Git ve live kimlik kilidi

- `git branch --show-current`, `git status --short --branch`, `git rev-parse HEAD`, `git rev-parse 'HEAD@{u}'`, `git log -8 --oneline --decorate`, `git remote -v`, `git branch -vv`, `git diff --check` ve `git ls-remote --symref origin HEAD refs/heads/codex/production-readiness-stage-1` calistirilir.
- Customer ve admin release-health endpoint'leri GET ile okunur.
- Local HEAD, upstream SHA, uzak default branch HEAD'i ve hosted release commit'i ayri alanlarda saklanir.
- Calisma agaci temiz degilse asama `BLOCKED` olur ve dosya degisikligi yapilmaz.

#### 1.2 Tarihsel evidence butunluk kontrolu

- Faz 1, Faz 1.2, Faz 1 finding manifest, combined finding manifest, Faz 2 scope/evidence ve Faz 3 evidence dosyalarinin SHA-256 degerleri hesaplanir.
- Kayitli tarihsel hash ile mevcut hash uyusmazsa farkin kaynagi aciklanmadan ilerlenmez.
- Tarihsel evidence dosyalari yeniden calistirilmis gibi guncellenmez.
- `READY_FOR_CDP_CAPTURE`, fiziksel Android/PWA performans PASS olarak yazilmaz.

#### 1.3 Bulgu disposition matrisi

- `PERF-F2-001`, `PERF-F2-002`, `PERF-F2-003`, `PERF-F12-001` ve `PERF-F12-002` ayri kayitlara ayrilir.
- Her kayit; yeniden uretim senaryosunu, incelenecek katmani, gerekli kontrollu deneyi, etkilenen kod alanini ve Plan 2'ye giris sartini icerir.
- Ilk statuler runtime kok nedeni kanitlamaz: static riskler `PENDING_VALID_AUTHENTICATED_REPRODUCTION`, AI Chat auth sorunu `MEASUREMENT_GAP_CONFIRMED`, warm AI Chat bulgusu `MEASURED_CANDIDATE_PENDING_VALID_AUTHENTICATED_REPRODUCTION` olarak tutulur.

#### 1.4 Senaryo ve butce kilidi

- Login, dashboard, client roster, forms, nutrition, menu, messages, alerts, notifications ve AI Chat senaryolari tekil kimliklerle kaydedilir.
- Her senaryoda expected route, gercek kullanici aksiyonu, alana ozgu ready selector, required authenticated reads, izinli ve yasak mutation'lar, sample count ve butce bulunur.
- `main` veya genel bir layout selector'u basari selector'u olarak kullanilmaz.
- AI Chat ancak `ai-chat-workspace` gorunur ve `/api/ai-chat/conversations` authenticated `2xx` donerse gecerli sayilir.

#### 1.5 Evidence schema ve asama ledger kilidi

- Plan 1 evidence; `sourceIdentity`, `historicalEvidence`, `findingContract`, `scenarioContract`, `stageLedger`, `constraints` ve `nextEligibleAction` alanlarini zorunlu tutar.
- Her stage ledger kaydinda asama kimligi, durum, baslangic/bitis zamani, on kosullar, yapilan komutlar, dogrulama ve cikti referansi bulunur.
- Hassas alan redaction testi gecmeden evidence gecersizdir.

### Faz 1 etkisi

Degisecek alanlar yalniz Plan 1 dokumani, evidence, finding manifesti ve bunlari dogrulayan testlerdir. Uygulama runtime'i, Supabase schema/migration, dependency, deploy ayari, service worker ve production gate degismez.

## Faz 2 - Olcum harness'i ve negatif kontroller

Plan 1 Faz 1 kapandiktan sonra baslatilir. Mevcut Phase 2 harness sozlesmesi korunur; warm SPA gecisleri ayni browser context/app instance icinde gercek tiklamalarla olculur. Header timing ile body-finish ayrilir. `401`, `403`, `5xx`, timeout, request failure, eksik selector, fallback/demo session ve yasak mutation `FAIL` olur. Normal kabul kosusu profiler kapali, tanisal kosu profiler acik tutulur.

### Faz 2 Uygulama Sonucu - 2026-09-10

Asamalar 2.1-2.5 sirayla tamamlandi ve `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json` icinde `COMPLETE / HARNESS_READY_WITH_NEGATIVE_CONTROLS` olarak kaydedildi. Dokuz senaryo ve senaryo basina 20 ornek sozlesmesi; cold login `page.goto`, warm ayni browser context icinde gercek click, 30 saniye required-read timeout, 5 saniye post-ready gozlem ve 60 saniye background gozlem metadata'si ile kilitlendi. 401, 403, 500, timeout, request failure, gecikmeli header/body, eksik read/selector/target/timing, forbidden mutation, fallback/demo ve butce asimi kontrolleri PASS ile siniflandi; 14 siniflandirma vakasi ve 8 kontrollu localhost HTTP vakasi calistirildi.

Bu fazda Supabase fixture/authenticated login, hosted synthetic hesap, fiziksel Android/PWA authenticated capture, gercek performans baseline'i, kok neden atfi ve runtime remediasyonu yapilmadi. Plan 1 Faz 3 daha sonra acik user onayi ile baslatildi ve asagidaki kapanis kaydiyla tamamlandi.

## Faz 3 - Sentetik auth/store ortamlarinin hazirlanmasi

Plan 1 Faz 2 kapandiktan sonra local Docker/Supabase izole hedefi baslatilir, mevcut migrationlar uygulanir ve deterministik sentetik fixture kurulur. Iki tenant, dietitian, assistant, auditor ve viewer assignment senaryolari; small, normal ve scale veri hacimleriyle olusturulur. Olcum gercek password session ve normal RLS yolu uzerinden yapilir. Hosted sentetik hesap, invite/onboarding ve hosted veri kurulumu ayri owner onayi olmadan baslatilmaz. Fiziksel Android ve PWA capture, ADB/CDP/display-mode/service-worker kontrolleriyle hazirlanir.

### Faz 3 Uygulama Sonucu - 2026-09-10

Asamalar 3.1-3.6 sirayla tamamlandi ve `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json` icinde `COMPLETE / SYNTHETIC_AUTH_STORE_READY` olarak kaydedildi. Local migration listesi ve required store schema `PASS` oldu; tam veritabani resetlenmedi. Yalnizca sabit Phase 3 tenant kimlikleri ve `aiya-phase3-local-*` sentetik auth hesaplari temizlenip yeniden olusturuldu.

Fixture iki local tenant ve sekiz local sentetik hesap icerir: her tenantta owner, assistant, viewer-assignment ve auditor; small tenantta 3 client ve 20 mesaj; normal tenantta 50 client, 20 mesajli ve 200 mesajli iki conversation, toplam 220 mesaj. `scale_synthetic`, ayri bir 5000 client yuk testi degil, normal tenanttaki 200 mesajli yogun conversation varyantidir. Fixture hash'i `6bedeba5628b8ea3677dae464143f01d59a2dc0f51e1353dd52767827c642819` olarak kaydedildi.

Tum hesaplar local anon key ile `signInWithPassword` kullanilarak authenticated session aldi; session claim ve local session-activity sozlesmesi dogrulandi. RLS/store matrisi owner cross-tenant gizleme, assistant assigned/unassigned client ve AI Chat siniri, viewer read-only update siniri, auditor ve anonymous raw-data gizleme kontrollerini `PASS` verdi. Service-role yalniz local seed/temizlik ve server-verified local session-activity RPC icin kullanildi; RLS iddialari normal authenticated client ile yapildi. Demo cookie, fallback store, provider/channel egress, hosted hesap, fiziksel cihaz/PWA capture, baseline, kok neden ve runtime remediasyonu bu fazda calistirilmadi. Fixture Phase 4 icin local DB'de birakildi; production karari `NO-GO` kalir.

## Faz 4 - Gecerli baseline ve yeniden uretim

Local desktop, owner-PC hosted, fiziksel Android Chrome ve kurulu PWA icin ayni dokuz senaryo ve her senaryo icin 20 ornek alinir. Cache, service worker, profiler, release ve cihaz kimligi her run'a yazilir. Butce asimi ile auth/network failure ayri siniflandirilir. Gecerli kosullarda yeniden uretilemeyen bulgu `NOT_REPRODUCED` adayi olur; bu durum otomatik runtime optimizasyon izni vermez.

## Faz 5 - Nedensel ayrim ve Plan 2 girisi

Sadece Faz 4'te yeniden uretilen senaryolar incelenir. DNS/TLS/TTFB, auth/session, RPC/store, body-finish, JSON parse, React render/layout/paint, polling/mount, service worker ve release identity ayri katmanlar olarak karsilastirilir. Data volume, polling pause, service-worker bypass, network profile ve profiler durumu tek degiskenli A/B deneyleriyle test edilir.

Bir neden ancak en az uc tekrar eden ornek/trace, belirli dosya/fonksiyon eslesmesi ve tek degiskenli deneyde tekrarlanabilir etki ile `CAUSE_CONFIRMED` olur. Kanitlanan neden, beklenen degisiklik ve test sozlesmesi Plan 2 manifestine aktarilir. Plan 1 runtime duzeltmesi yapmaz.

## Plan 1 kapanis ciktilari

- `docs/AIYA_PERFORMANCE_PLAN_1_EVIDENCE.json`
- `docs/AIYA_PERFORMANCE_PLAN_1_FINDING_MANIFEST.json`
- `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json`
- `docs/AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json`
- `app/scripts/performance-plan-1-phase-2.mjs`
- `app/scripts/performance-plan-1-phase-2.test.mjs`
- `app/scripts/performance-plan-1-phase-3.mjs`
- `app/scripts/performance-plan-1-phase-3.test.mjs`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `docs/RISK_REGISTER.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`

Plan 1 sonucu `ROOT_CAUSE_EVIDENCE_READY`, `NO_RUNTIME_CAUSE_CONFIRMED` veya `DIAGNOSIS_BLOCKED` olabilir. Plan 2 yalniz `ROOT_CAUSE_EVIDENCE_READY` sonucu ve kanitlanmis bulgu girisleriyle hazirlanabilir. Production karari her durumda `NO-GO` kalir.
