# AIya Uctan Uca Performans Denetimi ve Iyilestirme Eylem Plani

## Amac

AIya uygulamasinda kullanicinin bilgisayar ve Android Chrome uzerinde gozlemledigi ciddi takilma, gec acilma ve tiklama gecikmelerini olcume dayali olarak yakalamak, kok nedeni kanitlamak, ardindan sadece kanitla sinirli performans duzeltmelerini uygulamak.

Production karari bu planla degismez: `NO-GO`.

## Faz 1 - Gercek Sorunun Yakalanmasi ve Kok Neden Denetimi

Amac: Urun davranisini degistirmeden git/live kimligini, rota senaryolarini, yerel desktop ve Android Chrome emulasyon baseline'ini, static kritik yol bulgularini, bundle/CPU/request kanitlarini ve Faz 2 icin kesin bulgu manifestini olusturmak.

Kapsam: `app/package.json`, `app/scripts/measure-aiya-performance.mjs`, `app/scripts/performance-audit.test.mjs`, `docs/AIYA_PERFORMANCE_ACTION_PLAN.md`, `docs/AIYA_PERFORMANCE_PHASE_1_EVIDENCE.json`, `docs/AIYA_PERFORMANCE_PHASE_1_FINDING_MANIFEST.json`, `HANDOFF_FOR_NEXT_CODEX.md`, `docs/RISK_REGISTER.md`.

Kapsam disi: Runtime UI/API davranis degisikligi, migration, dependency ekleme, deploy, production gate, canli seed/reset, secret/env degisikligi, gercek provider/channel egress, raw payload/HAR/cookie/token/prompt kaydi.

Asamalar:

1. Git ve live release kimligini kaydet: branch, HEAD, upstream, `git diff --check`, iki release-health endpoint'i.
2. Public, login, dashboard, form, nutrition, menu ve AI Chat senaryolarini `SCENARIOS` listesinde kilitle.
3. Playwright tabanli olcum aracinda ready selector, trial click, LCP/FCP/CLS/long-task, request sayisi, API sayisi, yavas istek ozeti ve hassas veri redaksiyonunu uygula.
4. Yerel production build + `next start` uzerinde desktop Chrome lab ve Android Chrome emulasyon baseline'i calistir.
5. Koddan veri/auth kritik yolunu tara: `/api/app-state`, windowed loader, shell bootstrap, workspace bounded fetch, poll hook'lari.
6. `.next/static` JS gzip buyukluklerini olc ve en buyuk bundle dosyalarini evidence'a yaz.
7. Hosted ortamda sadece release-health oku; canli login, canli seed/reset ve canli klinik veri mutasyonu yapma.
8. Faz 2 bulgu manifestini dosya, fonksiyon/surface, zorunlu degisiklik ve zorunlu testlerle kilitle.

Son kontrol ve testler: `npm run test:performance-audit`, `npm run audit:performance:phase1`, `git diff --check`, `git status --short --branch`. Faz 1 ancak 8 asama evidence icinde temsil edildiginde kapanabilir; testlerin gecmesi tek basina yeterli degildir.

## Faz 1.2 - Olcum Gecerliligi ve Nedensel Kok Neden Teshisi

Amac: Faz 2 runtime degisikligine gecmeden once Faz 1 olcumlerinin kullanicinin bildirdigi gercek post-login sikayetini yakalayip yakalamadigini dogrulamak, eski rota parametreleri ve zayif selector kaynakli yanlis PASS/FAIL riskini gidermek, fiziksel Android hazirligini ayri kanitlamak ve Faz 1 bulgularini Faz 1.2 kanitlariyla birlestirmek.

Kapsam: `app/package.json`, `app/scripts/measure-aiya-performance-phase-1-2.mjs`, `app/scripts/performance-phase-1-2.test.mjs`, `docs/AIYA_PERFORMANCE_PHASE_1_2_PLAN.md`, `docs/AIYA_PERFORMANCE_PHASE_1_2_EVIDENCE.json`, `docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json`, `docs/AIYA_PERFORMANCE_PHASE_2_EXECUTION_SCOPE.md`, `HANDOFF_FOR_NEXT_CODEX.md`, `docs/RISK_REGISTER.md`.

Kapsam disi: Runtime UI/API davranis degisikligi, Supabase schema veya migration degisikligi, dependency ekleme, deploy, production gate degisikligi, canli login/seed/reset, provider/channel egress, live billing, production worker, secret/env degisikligi, raw payload/HAR/cookie/token/prompt/klinik icerik kaydi.

Zorunlu siralama:

1. Branch, HEAD, upstream, `git diff --check`, package scriptleri ve iki live release-health endpoint'ini evidence'a yaz.
2. Faz 1'deki `workspace=` tabanli eski senaryolari canonical post-login rotalarla degistir: `/dashboard`, `section=clients`, `clientId=client-mert`, `clientTask=forms|nutrition|menu`, `/dashboard/ai-chat`, `section=messages|alerts|notifications`.
3. Harness sozlesmesini testle: gercek `click()`, feature-specific success selector, 401/403/500/timeout/missing-action FAIL, body-finish timing, missing LCP'nin `null` kalmasi, hassas veri redaksiyonu.
4. Local production build uret; `output: standalone` oldugu icin `.next/standalone/server.js` sunucusunu standalone calisma dizininden baslat ve `.next/static` ile `public` asset'lerini standalone runtime altinda hazirla.
5. Tek persistent desktop Chrome context ile authenticated warm-session senaryolarini olc.
6. Tek persistent Android Chrome emulation context ile ayni senaryolari ayni local server uzerinde olc.
7. ADB cihaz listesi, model, Android surumu, Chrome surumu ve `devtools_remote` durumunu kaydet; cihaz veya CDP hedefi yoksa bunu PASS degil BLOCKED olarak yaz.
8. Browser/API/body-finish/long-task/click-feedback korelasyonunu her senaryo icin yaz; API fail olan authenticated senaryo PASS sayilamaz.
9. Faz 1 bulgularini Faz 1.2 kanitlariyla yeniden siniflandir ve sadece kanitli finding'leri `docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json` icine tasi.
10. Faz 2 kapsamini yalniz combined manifestteki finding'lere bagla; runtime degisikligi icin dosya ve test sinirlarini `docs/AIYA_PERFORMANCE_PHASE_2_EXECUTION_SCOPE.md` icinde kilitle.

Son kontrol ve testler: `npm run test:performance-phase1.2`, `npm run audit:performance:phase1.2`, `npm run test:performance-audit`, `git diff --check`, `git status --short --branch`. Faz 1.2 yalniz bu asamalar evidence icinde temsil edildiginde ilerleme icin kullanilabilir; fiziksel Android/PWA yakalama yoksa sonuc BLOCKED olarak kalir ve PASS sayilmaz.

## Faz 2 - Kanitla Sinirli Performans Duzeltmeleri

Amac: Faz 1 ve Faz 1.2 combined finding manifestinde kilitlenen kok nedenlere gore en kucuk kod degisikliklerini uygulamak.

Kapsam: Yalniz `docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json` ve `docs/AIYA_PERFORMANCE_PHASE_2_EXECUTION_SCOPE.md` icinde listelenen dosyalar ve onlarin hedefli testleri.

Kapsam disi: Manifestte olmayan performans fikirleri, yeni governance katmani, offline health-data cache, offline mutation queue, yetki/RLS gevsetme, service-role ile son kullanici yetkisi ikamesi, dependency ekleme.

Zorunlu siralama:

1. Her locked finding icin mevcut yavasligi tekrar uret.
2. Once auth/bootstrap bekleme ve request fanout nedenlerini duzelt.
3. Sonra bounded payload ve consumer uyumlulugunu duzelt.
4. Sonra background refresh/poll davranisini rota ve readiness ile hizala.
5. Sadece olcum kanitlarsa bundle/render bolme uygula.
6. PWA/hosted farki kanitlanmissa ayrica hazirla; canliya uygulama icin ayri onay iste.
7. Tenant, account, actor, dirty-state, conflict ve no-store/fail-closed regresyonlarini test et.
8. 20 ornekli closure karsilastirmasini Faz 1 baseline'i ile yap.

## Faz 3 - Canli Aday Kabul ve Owner Gate

Amac: Faz 2 adayi commitlendikten sonra, ayri deploy onayi verilirse resmi hosted release yolu ile canli aday performansini dogrulamak.

Kapsam: Release artifact, release identity, resmi apply wrapper, read-only smoke, safe hosted test account ile desktop/Android Chrome/PWA kabul olcumu.

Kapsam disi: Production GO, remote migration apply, live billing, WhatsApp/Z.ai gercek trafik, production worker start, yeni tenant veya gercek saglik verisi.

Zorunlu siralama:

1. Candidate SHA, artifact, release ID ve rollback hedefini kaydet.
2. Yerel real-Supabase ayrik testte kapasite smoke calistir.
3. Release verify ve artifact integrity kontrolu yap.
4. Ayri deploy onayi olmadan dur; onay varsa resmi wrapper ile deploy et.
5. Canli desktop kabul olcumu yap.
6. Fiziksel Android Chrome ve kurulu PWA kabulunu kullanici cihaziyla dogrula.
7. 30 dakikalik stabilite loop'u calistir.
8. `PERFORMANCE_ACCEPTED` veya `PERFORMANCE_BLOCKED` kararini yaz; genel production `NO-GO` degismez.
