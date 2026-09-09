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

## Faz 2 - Kanitla Sinirli Performans Duzeltmeleri

Amac: Faz 1 finding manifestinde kilitlenen kok nedenlere gore en kucuk kod degisikliklerini uygulamak.

Kapsam: Yalniz `docs/AIYA_PERFORMANCE_PHASE_1_FINDING_MANIFEST.json` icinde listelenen dosyalar ve onlarin hedefli testleri.

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
