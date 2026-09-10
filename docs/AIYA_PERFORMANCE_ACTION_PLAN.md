# AIya Uctan Uca Performans Denetimi ve Iyilestirme Eylem Plani - Revizyon 2

## Amac

Bu plan, kullanicinin desktop web, mobile web ve kurulu PWA icinde bildirdigi ciddi takilma, gec acilma ve tiklama gecikmelerini once gecerliligi kanitli olcumlerle yakalamak, sonra yalniz kanitlanan kok nedenleri duzeltmek ve son olarak ayni cihaz/oturum kosullarinda kalici kabul dogrulamasi yapmaktir.

Production karari bu planla degismez: `NO-GO`.

## Guncel Durum Kilidi

- Aktif branch: `codex/production-readiness-stage-1`.
- Revizyon 2 planlama baslangic HEAD'i: `b1747af9b2b470d32a242e4207733c1b2c579f0e`.
- Baslangic commit ozeti: `perf: add phase 1.2 performance diagnosis`.
- Branch `origin/codex/production-readiness-stage-1` uzerinden iki commit ileridedir; push ayrica onay gerektirir.
- Faz 1 kaniti: `docs/AIYA_PERFORMANCE_PHASE_1_EVIDENCE.json`.
- Faz 1.2 kaniti: `docs/AIYA_PERFORMANCE_PHASE_1_2_EVIDENCE.json`.
- Faz 1 + Faz 1.2 bulgu birlesimi: `docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json`.
- Faz 1.2'de fiziksel Android icin kanitlanan durum `READY_FOR_CDP_CAPTURE` seviyesindedir. Bu durum cihaz/ADB/Chrome DevTools hazirligini gosterir; gercek fiziksel Chrome veya kurulu PWA performans trace'i PASS sayilmaz.
- Live customer ve admin release-health endpoint'leri son okunan durumda release `hs-1c9756046b01-b55ed4ff550f`, commit `1c9756046b01cb1bd224fb601ec9094a7f471606`, migration fingerprint `b55ed4ff550f7e9ba8fc25957774341a19b7b05c1a35a891633369b4aff95f25` dondurur. Live commit ile guncel branch HEAD farklidir; bu beklenen live/HEAD drift durumudur.

## Faz 1 ve Faz 1.2 Kapanis Yorumu

Faz 1 ve Faz 1.2 tarihsel kanit olarak korunur. Bu belgeler yeniden yazilarak guncel HEAD uzerinde calistirilmis gibi gosterilmez.

Faz 1, fallback verili yerel lab olcumleri ve statik mimari riskleri kaydetmistir. Bu olcumler genis kullanici sikayetini tek basina yeniden uretmemistir.

Faz 1.2, post-login canonical rota sozlesmesini, daha guclu selector'lari, gercek click aksiyonlarini, body-finish request timing'i ve desktop plus Android-emulation warm-session kosullarini eklemistir. Ancak Faz 1.2 harness'i halen asagidaki nedenlerle runtime duzeltmesi icin tek basina yeterli degildir:

- Local diagnostic demo/fallback store ve demo session kosullarini kullanmistir; gercek Supabase authenticated store yolu temsil edilmemistir.
- Warm transition olcumleri her senaryoda tekrar `page.goto()` kullandigi icin surekli SPA oturumundaki birikimli state etkisini tam olcmemistir.
- Fiziksel cihaz icin gercek Chrome/PWA trace alinmamistir; yalniz CDP hazirligi kanitlanmistir.
- AI Chat hatasi, local fallback ortamda Supabase konfiguru yokken beklenen `401` davranisiyla karisabilir; bu live authenticated runtime hatasi olarak kabul edilmeden once gercek auth/store kosulunda ayrilmalidir.
- Bazi Phase 1 static bulgulari kanitli risk seviyesindedir; kok neden kabul edilebilmesi icin request, render, auth, store ve cihaz trace zinciriyle dogrulanmalidir.

## Faz Kapanis Kurali

Her faz icinde listelenen asamalar sirasiyla tamamlanir. Bir asama kendi tamamlanma kriterini karsilamadan sonraki asamaya gecilmez.

Bir fazin kapanmasi icin iki kosul birlikte zorunludur:

1. Faz icindeki tum asamalar tarif edildigi sirayla ve tarif edilen yontemle tamamlanmis olacak.
2. Faz sonu kontrolleri ve testleri PASS olacak.

Failed, skipped, simulated, stale, environment-blocked veya eksik kanit sonucu PASS sayilmaz. Bir testin gecmesi, planlanan asamalardan biri eksikse fazi kapatmaz.

## Ortak Kanit Defteri Sozlesmesi

Faz 2 ve Faz 3, her asama icin ayni defter alanlarini uretir:

- `stageId`: Faz ve asama kimligi.
- `status`: `PENDING`, `IN_PROGRESS`, `COMPLETE`, `NO_CHANGE_JUSTIFIED`, `FAILED`, veya `BLOCKED`.
- `startedAt` ve `finishedAt`: ISO zaman.
- `sourceIdentity`: branch, HEAD, upstream SHA, live release kimligi, migration fingerprint, harness hash, fixture hash.
- `prerequisiteEvidence`: Onceki asama kanit referanslari.
- `performedActions`: Gercek komutlar, araclar ve islem sirasi.
- `verificationResults`: Test, olcum ve manuel olmayan dogrulama sonucu.
- `outputEvidence`: Uretilen evidence dosyasi, sanitized summary ve bulgu referanslari.
- `blockingReason`: Sadece `FAILED` veya `BLOCKED` durumunda dolu olur.

`NO_CHANGE_JUSTIFIED`, asamanin atlandigi anlamina gelmez. Ilgili kosul arastirilir, kanitla degisiklik gerektirmedigi gosterilir ve gerekce deftere yazilir.

Bir onceki asamadaki veri degisirse, ona bagli tum sonraki asamalar stale kabul edilir ve tekrar edilir.

## Ortak Veri Yapilari

### PerformanceRunIdentity

Her olcum kosusu su alanlari kaydeder:

- `branch`
- `head`
- `worktreeStatus`
- `runtimeSourceHash`
- `harnessHash`
- `fixtureHash`
- `releaseId`
- `releaseCommitSha`
- `migrationFingerprint`
- `environmentKind`: `local_real_supabase`, `hosted_test_account`, `owner_pc_hosted`, `physical_android_hosted`, veya `installed_pwa_hosted`.
- `deviceProfile`: OS, browser, browser version, viewport, CPU throttle yoksa `none`, network profile.
- `cacheState`: cold, warm, bypassed, service-worker-controlled.
- `profilerState`: trace on/off, screencast on/off, DevTools attached yes/no.

### PerformanceScenario

Her senaryo su alanlari tanimlar:

- `scenarioId`
- `startRoute`
- `preconditions`
- `userAction`
- `expectedRoute`
- `requiredReadySelector`
- `requiredReads`
- `allowedMutations`
- `forbiddenMutations`
- `expectedEmptyState`
- `expectedDeniedState`
- `budget`
- `sampleCount`
- `dataFixtureClass`: small synthetic, normal synthetic, or scale synthetic.

Navigation testi icin veri mutasyonu yapan butonlar kullanilmaz. Menu olcumunde template olusturma, save, activate veya export gibi mutation aksiyonlari performans navigasyonu yerine domain mutation testi olarak ayrilir.

### PerformanceSample

Her ornek su alanlari kaydeder:

- `sampleId`
- `functionalStatus`
- `validityStatus`
- `budgetStatus`
- `eventToNextPaintMs`
- `taskReadyMs`
- `lcpMs`
- `cls`
- `longTaskTotalMs`
- `maxLongTaskMs`
- `requiredRequestTimings`
- `allRequestSummary`
- `failedRequests`
- `unexpectedRequests`
- `jsBytesGzip`
- `routeTransitionKind`
- `observedMutations`

Eksik bir metrik `null` kalir; baska bir metrikle doldurulmaz. Failed sample kayittan silinmez.

### PerformanceFinding

Her bulgu su alanlarla kapanir:

- `id`
- `class`: `AUTH_FAILURE`, `STORE_FANOUT`, `POLL_CONTENTION`, `BUNDLE_RENDER`, `SERVICE_WORKER`, `HOSTED_INFRA`, `MEASUREMENT_GAP`, veya `NOT_REPRODUCED`.
- `severity`
- `sourceSamples`
- `reproductionSteps`
- `affectedFiles`
- `affectedFunctions`
- `cause`
- `requiredFix`
- `requiredTests`
- `closureEvidence`
- `duplicateOf`

Hassas veri kurali: raw trace, HAR, cookie, token, secret, raw request/response body, raw prompt, real client health data veya dosya icerigi evidence icine yazilmaz. Kanitlar allowlist alanlarla ve sanitized pathlerle tutulur.

## Performans Butceleri

Bu butceler hedef kabul kriteridir; onceki fazlarda PASS oldugu anlamina gelmez.

- Login submit ile kullanilabilir dashboard arasi p75 en fazla `3000 ms`.
- Warm authenticated work-area navigation p75 en fazla `1000 ms`, p95 en fazla `2000 ms`.
- Olculen event-to-next-paint p75 en fazla `200 ms`, p95 en fazla `500 ms`. Bu field INP degildir; lab event-to-paint metrigi olarak yorumlanir.
- Required read endpoint body-finish p75 en fazla `900 ms`.
- Initial dashboard LCP p75 en fazla `2500 ms`.
- CLS en fazla `0.1`.
- Foreground max long task en fazla `500 ms`.
- Beklenmeyen auth/API/chunk/transport hata sayisi `0`.
- Regression kapisi: once/sonra ayni kosulda p75 hem yuzde `10`dan fazla hem `100 ms`den fazla kotulesemez.

## Faz 2 - Gecerli Olcum, Kok Neden ve Lokal Remediasyon

### Amac

Faz 1 ve Faz 1.2'deki olcum aciklarini kapatmak, kullanicinin gercek post-login yavaslik sikayetini gercek authenticated data path uzerinde yakalamak, kok nedeni ayirmak ve yalniz kanitlanan lokal kod duzeltmelerini uygulamak.

### Kapsam

- `docs/AIYA_PERFORMANCE_ACTION_PLAN.md`
- `docs/AIYA_PERFORMANCE_PHASE_2_EXECUTION_SCOPE.md`
- Yeni Faz 2 evidence dosyasi: `docs/AIYA_PERFORMANCE_PHASE_2_EVIDENCE.json`
- `docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json`
- Performans harness dosyalari: `app/scripts/measure-aiya-performance.mjs`, `app/scripts/measure-aiya-performance-phase-1-2.mjs`, yeni veya guncellenen Faz 2 harness/test dosyalari.
- Gerektigi kanitlanirsa runtime dosyalari: dashboard shell, app-state store, shell bootstrap, Stage 6 workspace hook'lari, inbox/messaging/AI chat refresh hook'lari, AI Chat page/route, dynamic import uygulanacak dashboard panel dosyalari.
- `HANDOFF_FOR_NEXT_CODEX.md`
- `docs/RISK_REGISTER.md`

### Kapsam Disi

- Production GO karari.
- Deploy, push, PR, merge, remote migration.
- Gercek Z.ai egress, WhatsApp egress, live billing, production worker.
- Service-role ile son kullanici yetkisi ikamesi.
- Offline health-data cache veya offline mutation queue.
- Tenant, account, actor, role, capability, RLS veya expected-revision gevsetmesi.
- Kanitlanmamis bundle/poll/store optimizasyonlari.
- Gercek hasta/veri icerigi yakalama veya evidence'a yazma.

### On Kosullar

- Calisma agaci temiz olacak.
- Aktif branch `codex/production-readiness-stage-1` olacak.
- Faz 1 ve Faz 1.2 evidence dosyalari tarihsel kaynak olarak korunacak.
- Synthetic hosted test hesabi gerekiyorsa ayri dis sistem onayi alinacak.
- Next.js davranisi degistirilecekse once ilgili yerel Next.js dokumani okunacak.

### Etkilenecek Bilesenler ve Dosyalar

Ilk asamalarda yalniz plan/evidence/harness/test dosyalari etkilenir. Runtime degisikligi ancak Asama 2.6 kok neden kanitladiktan sonra Asama 2.7'de uygulanabilir.

Muhtemel runtime dosyalari:

- `app/src/components/dashboard-app.tsx`
- `app/src/components/dashboard/**`
- `app/src/app/dashboard/**`
- `app/src/lib/use-aiya-state.ts`
- `app/src/app/api/app-state/route.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/lib/use-stage-4b-inbox.ts`
- `app/src/lib/use-stage-4b2-messaging.ts`
- `app/src/lib/use-ai-chat.ts`
- `app/src/app/dashboard/ai-chat/page.tsx`
- `app/src/lib/phase-85-stage-4c-route.ts`
- `app/public/sw.js` yalniz PWA/service-worker kok neden kanitlanirsa.

### Mimari Kararlar

- Ilk hedef hizli gorunen ama yetkisiz/fallback bir akisa dusmek degildir; hedef, gercek authenticated tenant/account/actor path'ini hizlandirmaktir.
- Genis `ManuAppState` bagimliligi ancak consumer map cikarildiktan sonra daraltilir.
- Eksik DTO, full state olarak cast edilmez.
- Polling, badge ve klinik alert tazeligini bozmadan route/visibility/owner/inflight kurallariyla sinirlanir.
- Dynamic import yalniz olcumle agir oldugu kanitlanan paneller icin kullanilir.
- Her mutation expected revision, dirty-state, conflict ve idempotency davranisini korur.

### Veri Akisi

Kullanici login olur, dashboard shell server auth ile tenant/account/actor baglamini cozer, shell bootstrap safe DTO dondurur, dashboard client aktif route/task'e gore yalniz gerekli read kaynaklarini cagirir, task ready selector gorunur hale gelir, background refresh yalniz aktif/gorunur/owner uyumlu kosulda calisir. AI Chat ayri capability ve entitlement kontrolunden gecer; 401/403 hata ise performans PASS sayilmaz.

### Bagimliliklar

- Node/Next mevcut repo bagimliliklari.
- Local real Supabase icin mevcut migrationlar ve sentetik fixture.
- Playwright/CDP mevcut araclari.
- Hosted test hesabi icin ayri owner onayi ve sentetik veri.
- Yeni dependency eklenmez; zorunlu olursa ayri onay gerekir.

### Hata ve Sinir Durumlari

- Supabase konfiguru yoksa AI Chat 401 sonucu auth/store ayrim bulgusu olarak kaydedilir; live bug sayilmaz.
- Fiziksel cihaz bagli ama CDP target dogrulanamiyorsa Faz 2 physical capture asamasi BLOCKED olur.
- Kullanici hesabi gercek veya icerigi belirsiz veriler iceriyorsa olcumde kullanilmaz.
- Hosted rate limit veya auth expiry olursa sample fail olarak saklanir; PASS'e cevrilmez.
- Slow sample outlier ise silinmez; ayni kosulda tekrar ve trace ile siniflandirilir.

### Asama 2.1 - Kaynak ve Bulgulari Yeniden Kilitle

Uygulama sirasi:

1. `git status --short --branch`, `git rev-parse HEAD`, `git log -5 --oneline --decorate`, `git diff --check` calistir.
2. Iki live release-health endpoint'ini read-only oku.
3. Faz 1 ve Faz 1.2 evidence dosyalarindaki source HEAD, harness, cihaz, environment ve sonuc alanlarini ozetle.
4. `READY_FOR_CDP_CAPTURE` durumunu fiziksel performans PASS olarak degil, capture hazirligi olarak siniflandir.
5. Combined manifestteki `PERF-F2-*` ve `PERF-F12-*` bulgularini Revizyon 2 siniflandirmasina cevir: static risk, measurement gap, measured candidate, duplicate, not reproduced.
6. `docs/AIYA_PERFORMANCE_PHASE_2_EXECUTION_SCOPE.md` dosyasini bu planin Faz 2 kurallarina gore guncelle.

Tamamlanma kriteri: Faz 2 kaniti, hangi onceki bulgunun hangi statude oldugunu ve hangi bulgunun runtime degisikligi icin henuz yetersiz oldugunu acikca gosterir.

### Asama 2.2 - Harness Gecerlilik Tamiri ve Negatif Testler

Uygulama sirasi:

1. Warm SPA olcumunde her senaryo icin `page.goto()` tekrarini kaldir; login sonrasi ayni browser context ve ayni app instance icinde click/route transition olc.
2. Her scenario icin `requiredReadySelector`, expected route/state ve gerekli 2xx read listesi tanimla.
3. `main` gibi genel selector'lari success selector olarak kullanma; forms, nutrition, menu, AI Chat, messages, alerts, notifications icin domain selector zorunlu kil.
4. Click feedback olcumunu sadece `locator.click()` suresi degil, click sonrasi ilk paint ve task-ready zamani olarak kaydet.
5. Response header timing ile body-finish timing'i ayri alanlarda tut; body bitmeden header suresini request tamamlandi diye yazma.
6. `requestfailed` listener ekle ve response handler promise'larini drain et; listener'lari sabit 1200 ms yerine scenario quiescence ve 30 sn ust limit ile kapat.
7. Tum requestlerden endpoint yuzdeleri hesapla; yalniz slowest top 12 subsetinden percentile uretme.
8. `finalUrl` ve pathlerde dynamic id, query, token benzeri alanlari sanitize et.
9. Background stability penceresini gercek 60 sn gozlem olarak uygula.
10. Menu navigation icin create/save/activate/export gibi mutation butonlarini kullanma; mutation testlerini ayrica isimlendir.
11. Negatif testlerde kontrollu 401, 403, 500, delayed header, delayed body, network failure, timeout, wrong panel, missing metric, over-budget, missing target ve redaction vakalarini fail olarak dogrula.

Teknik yontem: Mevcut Playwright harness korunur; yeni helper fonksiyonlari yalniz tekrar eden measurement sozlesmesini sadelestirmek icin eklenir.

Tamamlanma kriteri: Harness testleri yalniz sabit stringleri degil, gercek hata enjeksiyonu ve outcome dogrulamayi kapsar.

### Asama 2.3 - Local Real Supabase Sentetik Baseline

Uygulama sirasi:

1. Kullanici veritabanini resetlemeyen izole local Supabase hedefi sec.
2. Mevcut migrationlari uygula.
3. Iki tenant, en az iki dietitian rol, viewer/assistant/auditor negatif rolleri ve sentetik client verisi olustur.
4. Small fixture: 3 client, temel form/nutrition/menu/messages/alerts/notifications.
5. Normal fixture: 50 client, en az 20 mesajli conversation ve 200 mesajli buyuk conversation.
6. Fixture hash'i evidence'a yaz; raw mesaj veya klinik icerik yazma.
7. Demo cookie ve fallback store kullanmadan real password login ile dashboard ve AI Chat 2xx read gereksinimlerini dogrula.
8. Standalone production build ve local real DB ile 20 sample baseline al.

Tamamlanma kriteri: Baseline, real auth/store/RLS path uzerinde uretilir ve fallback/demo path PASS olarak kullanilmaz.

### Asama 2.4 - Hosted Sentetik Test Hesabi Hazirligi

Uygulama sirasi:

1. Ayri owner onayi olmadan dis sistemde hesap, invite, seed veya email aksiyonu yapma.
2. Onay varsa mevcut commercial admin invite ve onboarding akislariyla sentetik dietitian hesabi olustur.
3. Test hesabi yalniz sentetik veri icerir; gercek danisan veya saglik verisi kullanilmaz.
4. Test tenant normal dietitian yetkileriyle calisir; admin/service-role bypass kullanilmaz.
5. Hosted olcumde izinli yazma yan etkilerini sinirla: session activity, preferences, read receipt gibi mevcut normal uygulama davranislari disinda mutation yapma.
6. Login bilgileri, magic link, token, cookie veya email icerigi evidence'a yazilmaz.

Tamamlanma kriteri: Hosted test hesabi hazirsa kimlik ve fixture yalniz sanitized olarak kaydedilir; hazir degilse Faz 2 hosted physical/live kismi BLOCKED kalir ve lokal remediasyon kaniti ile sinirli ilerlenir.

### Asama 2.5 - Gecerli Baseline Yakalama

Uygulama sirasi:

1. Local real DB desktop baseline: login, dashboard, clients, forms, nutrition, menu, AI Chat, messages, alerts, notifications.
2. Owner PC hosted baseline: ayni senaryolar, test hesabi ile.
3. Fiziksel Android Chrome hosted baseline: `Browser.getVersion`, target URL ve device metadata dogrulanmadan PASS verme.
4. Kurulu PWA hosted baseline: display mode ve service-worker control durumunu dogrula.
5. Her required scenario icin en az 20 sample al.
6. Warm transitionlarda ayni oturum ve ayni app instance kullan.
7. Profiler/trace kosulari ile normal kosulari ayir; trace overhead'i kabul metrici yapma.
8. Broad issue yeniden uretilemezse `NOT_REPRODUCED` yaz ve speculative runtime optimizasyonuna gecme.

Tamamlanma kriteri: Kullanici sikayeti en az bir gecerliligi kanitli ortamda yeniden uretilir veya kanitli sekilde yeniden uretilemedigi kaydedilir.

### Asama 2.6 - Nedensel Ayrim

Uygulama sirasi:

1. DNS/TLS/TTFB, auth/session, RPC/store, response body, JSON parse, React render/layout/paint, poll/mount ve service-worker/release katmanlarini ayri ayri siniflandir.
2. Server TTFB tek basina DB kok nedeni sayilmaz; store/RPC request timing ve query davranisi ayrica kanitlanir.
3. A/B tek degisken deneyleri yap: data volume, poll pause, service-worker bypass, network profile, profiler on/off.
4. Her kok neden icin en az 3 ayni path trace veya sample referansi zorunludur.
5. Duzeltme onerisi, tenant/auth/security davranisini bozmadan beklenen performans degisimini dosya/fonksiyon/test seviyesinde tarif eder.

Tamamlanma kriteri: Her runtime degisikligi icin `cause -> affected file/function -> expected change -> required test` zinciri kanitlanir.

### Asama 2.7 - Kanitla Sinirli Lokal Duzeltmeler

Duzeltmeler asagidaki sabit oncelikle uygulanir; bir madde icin kanit yoksa `NO_CHANGE_JUSTIFIED` yazilir.

1. AI Chat measurement gate: AI Chat performans-ready sayilmak icin authenticated 2xx conversation-list read ve `ai-chat-workspace` ready selector zorunlu olur. Local missing-Supabase 401 live auth bug olarak siniflandirilmez.
2. Auth/session duplicate work: ayni render icinde tekrar eden server auth cozumu kanitlanirsa request-scoped paylasim uygulanir; role/capability/entitlement assert davranisi korunur.
3. Broad app-state: kritik tasklar icin consumer map cikarilir; shell bootstrap ve Stage 6 bounded DTO'lari kullanilir; eksik DTO full `ManuAppState` olarak cast edilmez.
4. Pagination: SQL/loader paging tenant/filter/order once, range sonra olacak sekilde dogrulanir; 100 uzeri client dogruluk testi eklenir.
5. Poll/background refresh: route, visibility, owner key, inflight dedupe, abort/sequence ve post-readiness scheduling uygulanir; badge/clinical alert freshness korunur.
6. Bundle/render split: yalniz olcumle agir panel kanitlanirsa yerel Next.js lazy-loading dokumani okunarak top-level `next/dynamic` uygulanir; ilk gorunen dashboard/shell eager kalir.
7. PWA/service-worker: yalniz SW kaynakli stale/static problem kanitlanirsa network-only/fail-closed kurallari bozulmadan duzeltilir.
8. Hosted infra/proxy/DB: kod disi kok neden kanitlanirsa dosya degisikligi yapmadan Faz 3 icin ayri dis sistem aksiyon plani yazilir.

Tamamlanma kriteri: Her uygulanan degisiklik icin hedefli test ve once/sonra olcum vardir; uygulanmayan her aday icin kanitli `NO_CHANGE_JUSTIFIED` vardir.

### Asama 2.8 - Eslesmis Once/Sonra Dogrulama

Uygulama sirasi:

1. Local real DB once/sonra ayni fixture ile 20 sample tekrar edilir.
2. Fiziksel Android veya hosted test hesabi hazirsa ayni ortamda once/sonra 20 sample tekrar edilir.
3. Live eski commit ile local yeni commit ayni kabul karsilastirmasi gibi sunulmaz; sadece ayni environment icindeki once/sonra karsilastirilir.
4. Rapid client switch, late replies, dirty-state cancel/save, conflict, double-click, expired session testleri calistirilir.
5. Slow lab profili 150 ms RTT, 1.6 Mbps down, 750 Kbps up hedefinde task p75 en fazla `4000 ms` olacak sekilde ayri raporlanir.

Tamamlanma kriteri: Kapatilan her bulgu eslesmis before/after kanitla kapanir veya acik kalir.

### Asama 2.9 - Faz 2 Kapanis Kontrolleri

Calistirilacak kontroller:

- Faz 2 harness negatif/pozitif testleri.
- Degisen runtime dosyalarina hedefli unit/integration testleri.
- Gerekiyorsa RLS/cross-tenant/cross-account suite; destructive wrapper yerine izole raw local hedef.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Degisikligin blast radius'una gore `npm test`
- UI degistiyse desktop/mobile Playwright visual ve accessibility testleri.
- PWA degistiyse service-worker, manifest, network-only ve privacy-lock testleri.
- `git diff --check`
- Secret ve hassas veri taramasi.
- Stale belge ve handoff celiskisi taramasi.
- `git status --short --branch`

Tamamlanma kriteri: Faz 2 evidence `LOCAL_REMEDIATION_VERIFIED` veya `PERFORMANCE_BLOCKED` statulerinden birini verir. `LOCAL_REMEDIATION_VERIFIED`, production GO anlamina gelmez; live kabul Faz 3 onayi gerektirir.

## Faz 3 - Canli Aday Kabul, Regresyon ve Owner Gate

### Amac

Faz 2 adayi commitlendikten ve ayrica onaylandiktan sonra, resmi release/deploy yolu uzerinden hosted kabul olcumlerini, fiziksel cihaz/PWA kabulunu, endurance kosularini ve rollback/failure kurallarini tamamlamak.

### Kapsam

- Release artifact ve identity.
- Existing hosted deploy wrapper.
- Synthetic hosted test tenant/account.
- Desktop hosted, physical Android Chrome hosted ve installed PWA hosted performance acceptance.
- CI/regression test entegrasyonu.
- Faz 3 evidence, handoff ve risk register.

### Kapsam Disi

- Production GO karari.
- Gercek Z.ai/WhatsApp/live billing/production worker.
- Gercek saglik verisi.
- Remote migration apply; gerekiyorsa ayri onay ve ayri migration fazi gerekir.
- Deploy onayi olmadan hosted apply.

### On Kosullar

- Faz 2 `LOCAL_REMEDIATION_VERIFIED` veya acik bloklari net `PERFORMANCE_BLOCKED` olarak kaydetmis olacak.
- Candidate commit, artifact ve rollback hedefi net olacak.
- Hosted deploy icin kullanici ayri acik onay verecek.
- Hosted test hesabi sentetik veriyle hazir olacak.

### Asama 3.1 - Candidate Freeze

Uygulama sirasi:

1. Candidate HEAD, branch, worktree, artifact target ve migration fingerprint kaydedilir.
2. Faz 2 kapanis evidence'i stale degil diye dogrulanir.
3. Her kapanacak bulgu icin kabul senaryosu, butce ve test listesi yazilir.
4. Migration veya env/config ihtiyaci varsa deploydan once ayri onay gerektiren blok olarak kaydedilir.

Tamamlanma kriteri: Candidate identity ve rollback hedefi tek anlamlidir.

### Asama 3.2 - CI ve Regresyon Korumasi

Uygulama sirasi:

1. Faz 2 harness negatif testleri CI icinde calisacak uygun npm scriptine baglanir.
2. Her fix icin anlamli davranis testi eklenir: auth/session, request fanout, polling, pagination, selector, AI Chat gate, dirty/conflict veya SW.
3. CI fiziksel cihaz PASS iddiasi yapmaz; fiziksel cihaz kaniti ayri evidence'ta tutulur.
4. Windows lokal ve Linux CI karsilastirmalari ayni kabul metrici olarak karistirilmaz.

Tamamlanma kriteri: CI, gelecekte ayni measurement gap veya runtime regresyonunu yakalayacak somut testlere sahiptir.

### Asama 3.3 - Release Artifact ve Local Smoke

Uygulama sirasi:

1. `npm run release:verify` calistirilir.
2. Release artifact uretilir ve SHA-256 kaydedilir.
3. Local real DB normal fixture ile smoke tekrar edilir.
4. 100 uzeri pagination dogruluk fixture'i calisir.
5. 100x50/5000 rehearsal yalniz kapasite/regresyon sinyali olarak ayrilir; fiziksel kullanici sikayeti PASS kaniti sayilmaz.

Tamamlanma kriteri: Artifact, release identity ve local smoke tutarlidir.

### Asama 3.4 - Onayli Hosted Apply

Uygulama sirasi:

1. Kullanici acik deploy onayi vermeden dur.
2. Onay varsa existing official hosted apply wrapper kullanilir.
3. SSH, PM2, archive, release identity ve rollback kanitlari sanitized kaydedilir.
4. Migration gerekiyorsa append-only local tested migration icin ayri remote migration onayi olmadan apply yapilmaz.
5. Deploy sonrasi customer/admin release-health, domain, TLS, login route, manifest ve fail-closed unauth API smoke calisir.

Tamamlanma kriteri: Hosted release exact candidate commit'i servis eder veya apply fail/rollback durumu acik yazilir.

### Asama 3.5 - Hosted Kabul Olcumu

Uygulama sirasi:

1. Owner PC hosted test hesabi ile 20 sample.
2. Fiziksel Android Chrome hosted test hesabi ile 20 sample.
3. Kurulu PWA hosted test hesabi ile 20 sample.
4. Profiler off kabul kosusu, profiler on tanisal kosudan ayri tutulur.
5. Local/local ve hosted/hosted karsilastirmalari ayri yapilir; eski live ile yeni local karsilastirmasi PASS sayilmaz.

Tamamlanma kriteri: Hedef butceler hosted kabul kosullarinda saglanir veya hangi platformun neden blocked/failed oldugu netlesir.

### Asama 3.6 - Endurance ve Stabilite

Uygulama sirasi:

1. Owner PC, physical Android Chrome ve installed PWA icin uygun olan her platformda 30 dakikalik loop calistir.
2. Warm all panels, repeated navigation, scroll/back/client switch, foreground/background ve dirty cancel/save akislari tekrarlanir.
3. Ilk 5 dakika ve son 5 dakika timing, request sayisi, error sayisi ve memory floor karsilastirilir.
4. Memory floor ardisik 3 pencerede artar, toplam artis `20%` ve `20 MiB` uzerindeyse leak supheli blok acilir; otomatik "leak kapandi" denmez.
5. Timer/request artisi, stale response veya late freeze aciklanamazsa Faz 3 kapanmaz.

Tamamlanma kriteri: 30 dakikalik stabilite kaniti budget ve hata kapilarini karsilar.

### Asama 3.7 - Failure ve Rollback Karari

Uygulama sirasi:

1. Missing device, auth error, budget miss, persistent freeze, release mismatch, security/session/dirty/mutation regresyonu veya endurance failure tek tek siniflandirilir.
2. Rollback yalniz deploy scope icinde onceden onaylandiysa uygulanir; aksi halde rollback onerisi raporlanir.
3. DB rollback gerekiyorsa ayri onay ve ayri plan olmadan yapilmaz.
4. Failure cozulmeden Asama 3.8'e gecilmez.

Tamamlanma kriteri: Hosted aday `PERFORMANCE_ACCEPTED` veya `PERFORMANCE_BLOCKED` olmaya hazirdir.

### Asama 3.8 - Faz 3 Kapanis

Uygulama sirasi:

1. Her bulgu `CLOSED_VERIFIED`, `MEASUREMENT_GAP_RESOLVED`, `DUPLICATE`, `NOT_REPRODUCED`, veya `OPEN_BLOCKED` statulerinden birini alir.
2. Kullanici algisi icin owner tekrar dogrulamasi kaydedilir; bu tek basina teknik PASS degildir ama kabul sinyalidir.
3. Secret/hassas veri/history/stale-doc taramalari calisir.
4. `git diff --check` ve `git status --short --branch` kaydedilir.
5. Production karari `NO-GO` kalir; bu faz yalniz performance acceptance sonucunu yazar.
6. Commit, push, PR, merge, production GO ve sonraki faz icin ayri onay beklenir.

Tamamlanma kriteri: Faz 3 evidence `PERFORMANCE_ACCEPTED` veya `PERFORMANCE_BLOCKED` kararini verir ve tum asamalar sirayla tamamlanmistir.

## Dokuman Guncelleme Kurali

Her uygulama fazinda:

- Ilgili action plan/evidence dosyasi guncellenir.
- `HANDOFF_FOR_NEXT_CODEX.md` mevcut durum ve sonraki tek adimla guncellenir.
- `docs/RISK_REGISTER.md` yalniz risk durumu degisirse guncellenir.
- Historical evidence ve closure dosyalari yeni HEAD'de yeniden calismis gibi yazilmaz.
- `README.md`, `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md` ve `docs/NEXT_PHASE_EXECUTION_PLAN.md` yalniz roadmap veya urun karari degisirse guncellenir.

## Sonraki Tek Uygulanabilir Faz

Sonraki uygulanabilir faz: **Faz 2 - Gecerli Olcum, Kok Neden ve Lokal Remediasyon**.

Faz 2, once olcum gecerliligini ve gercek authenticated path'i kanitlamadan runtime optimizasyonuna gecmez. Faz 2 icinde broad dashboard freeze yeniden uretilmezse spekulatif performans duzeltmesi yapilmaz; bu durumda bulgular `NOT_REPRODUCED` veya `OPEN_BLOCKED` olarak kalir ve Faz 3'e gecilmez.
