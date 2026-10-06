# Changelog

Bu dosya `build.py` tarafından otomatik güncellenir.
## [4.4.1] - 2026-10-06

- Düzeltme: **Tanımsız CSS değişkenleri yüzünden şeffaf arayüz** — `--card`, `--accent`, `--brand`, `--code-bg`, `--shadow-sm` hiçbir yerde tanımlanmamıştı; tarayıcı geçersiz bildirimi tüm kuralı yok sayıyordu. Etkilenen: **doluluk barının dolgusu** (`linear-gradient` `none`'a düşüyordu), 8 özellik kartı, hero değer şeridi çipleri, topluluk duvarı kartları/sekmeleri ve **hamburger menü paneli** (hero metni panelin içinden görünüyordu). Değişkenler karanlık ve açık temada `:root`'a tanımlandı
- Test: **`tests/cssVars.test.js`** eklendi — `style.css` içindeki her `var(--x)` için tanımlama ya da fallback zorunlu; eski dosyayı gerçekten yakalıyor (135 → 138)
- Düzeltme: **İngilizce modda karışık dil** — hero çipleri (`#heroTrust li`), özellik kartı başlıkları/paragrafları, giriş metni ve butonlar (`🎁 Ücretsiz Üye Ol`, `💎 Üye Ol`, fikir çipleri) Türkçe kalıyordu. `translateStatic` seçicisi genişletildi, çok satırlı HTML için normalize edilmiş anahtar araması eklendi, `I18N.en`'e 30+ yeni anahtar girdi; sayaçlı menü öğeleri (Arşiv/Başarımlar) metin düğümü üzerinden çevriliyor
- Düzeltme: **Dil değişiminde fiyat kutusu güncellenmiyordu** — rozet/tutar/kademe metni ve Üye Ol düğmesi Türkçe kalıyordu; dil düğmesi artık `renderLaunchPrice()` çağırıyor (kademe bilgisiyle çizim sözlükten güvenilir)
- Sürüm 4.4.1 olarak derlendi.

## [4.4.0] - 2026-10-05

- Yeni: 🎁 **İki kademeli lansman kontenjanı** — ilk **1000 kişi ÜCRETSİZ** ömür boyu üye olur (kayıt anında, Stripe'a uğramadan), sonraki **1000 kişi tek seferlik $1**, sonrası **$1/ay aylık abonelik**. `planFor` artık `FREE` / `LIFETIME` / `MONTHLY` kademeleri döner; kapı hiçbir kademede kapanmaz
- Yeni: 📊 **Doluluk barı ve sayaç** — lansman CTA'sında `used/total` çubuğu ve kalan kontenjan metni (`🔥 437/2.000 kontenjan doldu — 563 ücretsiz yer kaldı`). `/api/health` artık `pricing.freeLimit`/`paidLimit`/`used`/`tier`/`remaining` döner; fiyat satırı, rozet ve Üye Ol düğmesi kademeye göre değişir
- Yeni: ☰ **Hamburger menü** — başlıktaki 12 düğme tek satıra sığmıyordu; Kütüphane/Arşiv/Başarımlar/Sınıf Modu/Ayarlar ayrı bir panele alındı, panel dışında tıklayınca ve Esc ile kapanır
- Değişti: **Ziyaretçi başlığı sadeleşti** — 🌍 Duvar ve hamburger menü girişten **önce görünmez**, kalan: tema, dil, Demo Modu rozeti, Giriş Yap, Kaydol. Bileşen kütüphanesi (`#kutuphane`) de girişe bağlandı. Menünün GÖRÜNÜRLÜĞÜ `isSignedIn()`, erişim izni ise `canUseApp()` ile ayrıldı (demo modda kapı yine açık kalır, testler paneli açabiliyor)
- Düzeltme: **Üye Ol / Giriş Yap `disabled` geliyordu** (sunucu yokken) — tıklanamayınca kullanıcı ne yapacağını anlamıyordu. Artık her zaman tıklanabilir; sunucu yoksa düğme açılıp nedenini anlatıyor
- Düzeltme: fiyat kutusundaki uzun kademeler açıklaması ve Stripe ince yazısı kaldırıldı (`launchNote`, `launchFine`, `occupancyFine`). Doluluk metni yalnız GERÇEK veri varken yazıyor — sunucuya bağlı değilken bar hiç görünmüyor (uydurma sayı yok)
- Değişti: **Pazarlama ekranı** — başlık `3.4rem → 2.9rem` ile 2 satıra indi (CTA ilk ekranda kalıyor), devre arka planı ince + teal tonlu + yuvarlak uçlu hâle getirildi ve arkasına yumuşak teal ışıma eklendi
- Değişti: **Demo Modu rozeti ziyaretçide görünür, giriş yapınca gizlenir** (giriş yapana "demo" denmez)
- Düzeltme: **Adım Adım Yapım tik kutusu yazının üstüne biniyordu** — kutu `left: 3.55rem`'de, metin ise `3.4rem`'de başlıyordu. Artık adım numarasının HEMEN ALTINDA (`left: 1.175rem; top: 2.97rem`) ve kart için `min-height` eklendi
- Değişti: **Pazarlama ekranı güçlendirildi** — hero'ya ziyaretçiye özel değer şeridi (`#heroTrust`: 🧩 Wokwi + .zip · 📄 PDF sertifika · 🎙️ Sesli rehber · 🏫 Sınıf modu), başlık degradesi yavaşça kayıyor, fiyat kutusu teal ışımalı, kontenjan rozeti nabız atıyor ve özellik kartları hover'da kalkıyor (`prefers-reduced-motion` ile kapanır)
- Düzeltme: `scripts/verify-member.mjs` varsayılan adresi `127.0.0.1:8000` idi; CORS beyaz listesinde (`APP_ORIGIN`) yalnız `localhost:8000` olduğu için health isteği düşüyor ve 3 kontrol sahte FAIL veriyordu. Varsayılan `http://localhost:8000/` oldu — 89/89 yeşil
- Test: sunucu testleri 109→114 (yeni `pricing.test.js` kademe sınırlarını `PRICING_FREE_LIMIT=2`/`PRICING_PAID_LIMIT=3` ile GERÇEK uçtan uca doğrular). `verify-member.mjs` üye-olmayan senaryolarını artık seed'deki `merhaba@example.com` ile koşar — çünkü yeni kayıt artık anında üye
- Sürüm 4.4.0 olarak derlendi.
## [4.3.0] - 2026-10-05

- Yeni: 🔎 **Duvar ve arşiv araması** — başlık, açıklama ve etiketlerde arama kutusu; Türkçe duyarlı (büyük/küçük harf, `ç ğ ı ö ş ü` ve aksan farkı sonucu değiştirmiyor). Metin kayıt anında katlanıp `Project.searchText` içine yazılıyor, sorgu da aynı katlamayla karşılaştırılıyor
- Yeni: ↕️ **Duvar sıralaması** — "En yeni / En çok beğenilen / En çok konuşulan". `new` imleç (id) sayfalıyor, sayısal sıralamalar offset sayfalıyor. `GET /api/wall?q=&sort=` ve `GET /api/feed/timeline` aynı sözleşmeyi kullanıyor
- Yeni: 🚩 **Şikâyet/raporlama** — duvar kartından, yorumdan ve profilinden gerekçeli şikâyet gönderimi (`POST /api/reports`); aynı kişi aynı hedefi iki kez şikâyet edemiyor, kullanıcıya anlaşılır bir mesaj dönüyor
- Yeni: 🙈 **Yorum gizleme** ve 🗑️ **paylaşım kaldırma** — yazar/proje sahibi (yorum gizleme) ve proje sahibi (paylaşım kaldırma) kendi içeriğini geri alabiliyor; gizli içerik herkese açık sayaçlardan düşülüyor
- Yeni: 👤 **Profil avatarı** — kendi profilinden görsel yükleme/silme. Yükleme iki adımlı: `POST /api/users/me/avatar/presign` → `POST /api/users/me/avatar`
- Yeni: `isAdmin` istemciye de gönderiliyor; yönetici olan için yorum gizleme ve şikâyet yönetimi açılıyor
- Düzeltme: `.modal` yükseklik sınırı yoktu — duvar penceresi 955px'e çıkıp 800px ekranda "yorum gönder" düğmesi erişilemez oluyordu. Artık `max-height: calc(100vh - 2.5rem)` + kendi kaydırma
- Düzeltme: **Test ortamı `app.js`'i satır 6776'da öldürüyordu** ama testler yeşil görünüyordu. `build.py` `const API_BASE_DEFAULT = "";` satırını enjekte ediyor, kaynakta yoktu; sandbox'ta TDZ hatası veriyordu. Sabit artık kaynakta tanımlı. Ayrıca sandbox'a `MutationObserver`, `IntersectionObserver`, `window.addEventListener/scrollTo`, `history.replaceState` stub'ları eklendi
- Düzeltme: `scripts/verify-member.mjs` arama kontrolü **her zaman yeşildi** — düz `/irmak/i` kontrolü sorgu metnini kendisi arıyordu. Artık duvardaki gerçek bir başlıktan kelime seçiliyor ve dönen kart gerçekten eşleşiyor mu diye bakılıyor (Türkçe katlama ile karşılaştırılıyor; Türkçe harfleri silmek "kişilik"→"kilik" yapıp eşleşme varken kontrolü düşürüyordu)
- Test: `node --test tests/` 125→135. Sunucu testleri 72→109: yeni `search.test.js`, `moderation.test.js`, `avatar.test.js`. `scripts/verify-member.mjs` 74→76 kontrol (arama gerçekten eşleşiyor mu)
- Sürüm 4.3.0 olarak derlendi.

## [4.2.1] - 2026-10-05

- Düzeltme: **Menü kilidi bölümü gizlemiyordu.** Kütüphane, Arşiv, Başarımlar, Sınıf Modu ve Ayarlar kilitli görünüyordu ama sayfadaki gerçek bölüm (ör. Bileşen Kütüphanesi `<section id="kutuphane">`) **sayfayı aşağı kaydırarak erişilebilir** durumdaydı. Artık kilitle birlikte bölümün içeriği de gizleniyor
- Düzeltme: Adres çubuğuna elle `#kutuphane` yazan ziyaretçi bölüme kaydırılabiliyordu. Artık giriş yoksa giriş penceresi açılıyor, hedef engelleniyor ve adres temizleniyor. `hashchange` yalnız sonradan değişen hash'lerde çalıştığı için ilk yüklemede de kontrol ediliyor
- Düzeltme: `scripts/e2e.mjs` mevcut `dist/` derlemesini kullanıyordu, yani testler bunun `API_BASE` ile mi derlendiğine bağlıydı (kilitli menüyle kırılıyordu). Artık test **kendi derlemesini** yapıyor
- Düzeltme: `scripts/verify-member.mjs` beğeni testi mutlak sayıya bakıyordu; veritabanında beğeni birikince (1 → 0) yanlış alarm veriyordu. Artık tıklamanın **yönünü** ölçüyor, durumu geri alıp testi bırakmadan önce doğruluyor
- Test: `scripts/verify-member.mjs` 54→55 kontrol

## [4.2.0] - 2026-10-05

- Yeni: 🔒 **Giriş kapısı** — Kütüphane, Arşiv, Başarımlar, Sınıf Modu ve Ayarlar menüleri giriş yapana kadar **kilitlidir**: görünür ama 🔒 işaretlidir, tıklanınca içeri açılmaz ve giriş penceresi açılır. Kilit kararı TEK yerde toplanır (`GATED_MENU_IDS` + `requireLogin`); topluluk duvarı herkese açık kalmaya devam eder
- Yeni: 💎 **Lansman sayfası (ziyaretçi)** — giriş yapmamış kullanıcıya ekranı saran tek sayfalık tanıtım: **8 özellik kartı** (yapay zekâ rehberi, Wokwi + .zip, Göz Serbest sesli rehber, gerçek malzeme fiyatı, alışveriş listesi, başarı sertifikaları, sınıf modu, portfolyo arşivi) ve güçlü **$1 ömür boyu** CTA'sı. Giriş yapılınca landing gizlenir ve uygulama açılır
- Yeni: 🎟️ **Header'da ayrı “💎 Üye Ol — $1” ve “👤 Giriş Yap” düğmeleri** (ziyaretçide görünür, giriş yapınca yerini profil düğmesine bırakır). Üye Ol düğmesi doğrudan kayıt penceresini kampanya metniyle açar
- Yeni: 💵 **Tek fiyat** — ilk 1000 kişi için $1 ömür boyu. Sınır dolunca üyelik **satışı kapanır** (`launch_sold_out`); daha önce aylık aboneliğe geçiliyordu. Kullanıcıya sonradan geri çekilecek bir abonelik vaadi yerine kapı açıkça kapatılıyor
- Değişti: **“Demo Modu” rozeti artık tıklanamaz.** Daha önce Ayarlar'ı (API anahtarı) açıyordu; artık `aria-disabled` + `pointer-events: none` ile yalnız bilgi veriyor. Üyelik akışı üyelik düğmelerinden yürür
- Düzeltme: `renderAuthBtn` içindeki erken dönüşlerde menü kilitleri hiç güncellenmiyordu (sunucu yokken ve kullanıcı yokken). `renderMenuLocks` artık HER yolda çalışıyor
- Düzeltme: `bootstrapApi` API adresi boşken hiçbir şey çağırmadan dönüyordu; bu yüzden demo modunda landing CTA'sı hiç gösterilmiyor, “Üye Ol” düğmeleri başlıksız kalıyordu. Demo durumu da artık arayüzü hazırlıyor (kilitler açık — demo bozulmaz, üyelik düğmeleri pasif)
- Test: `node --test tests/` 122→125, sunucu testleri 70→72 (tek fiyat kuralı: `soldOut`, `remaining`, her durumda LIFETIME). `scripts/verify-member.mjs` 34→54 kontrol: ziyaretçi CTA'ları, $1 metni, demo rozeti tıklanamazlığı, kilitli menünün **içeri açılmaması**, giriş/çıkış sonrası kilit durumunun değişmesi
- Test altyapısı: `tests/extract.js` ikinci turda `LIB_DATA`/`ALL_LIB`'i yeniden tanımlayıp "Identifier has already been declared" hatası veriyordu. Bu hata yeni bir isim `missing` düştüğünde ortaya çıkıyordu; artık yalnız gerçekten tanımsız olanlar ekleniyor
- Sürüm 4.2.0 olarak derlendi.

## [4.1.0] - 2026-10-05

- Yeni: 👥 **Takip akışı sekmesi** — duvarın üstünde "🌍 Tümü / 👥 Takip Ettiklerim" sekmeleri. Takip sekmesi yalnız takip edilenlerin paylaşımlarını gösterir (`GET /api/feed/timeline`), üyeye açıktır; giriş yoksa giriş penceresi, üyelik yoksa paywall açılır. `/api/feed/timeline` artık `/api/wall` ile **aynı sözleşmeyi** dönerdi (cursor sayfalaması, `viewer`, `followingCount`); "Daha fazla göster" her iki sekmede de çalışır
- Yeni: ❤️ **Beğeni** — duvar kartlarında beğeni düğmesi ve sayaç. Beğeni yazmak üyeye açıktır (herkese açık beğeni spam'e açık olurdu); sayaç herkese açık, "bunu beğendim" bilgisi yalnız kendi görüntüleyene gider. Aynı kullanıcı iki kez beğenemez (`@@id([userId, projectId])`)
- Yeni: 💬 **Yorum** — kartın 💬 düğmesi yorum panelini açar; okumak herkese açık, yazmak üyeye açık. Yorumu **yazan veya projenin sahibi** silebilir. Gövde 1000 karakterle sınırlı
- Yeni: 🗃️ `Like` ve `Comment` tabloları (`migrations/20261005120000_likes_comments`); beğeni/yorum sayıları `shapeProject` ile herkese açık sayaç olarak döner (içerik değil)
- Düzeltme: **paywall duvarın altında kalıyordu** — duvar açıkken "Takip" sekmesine ya da beğeniye tıklayınca paywall açılıyor ama tıklanamıyordu (duvar modalı üstteydi). Modal yığını artık son açılan pencere en üstte olacak şekilde `watchModalStack()` ile yönetiliyor; DOM sırası önemsiz
- Düzeltme: duvar sekmeleri yeniden çizildiğinde her seferinde **ikinci bir çubuk** ekleniyordu (kimlik eksikti). `wallTabsHTML` artık `id="wallTabs"` taşıyor ve `renderWallTabs` eskisini değiştiriyor
- Düzeltme: **görsel presign rotasında depo kontrolü yanlış sırada idi.** Yapılandırma kontrolü yetki ve içerik tipi denetiminden önce geliyordu; görsel deposu olmayan bir sunucuda her istek 503 alıyor, gerçek hata (404 yetkisiz proje / 400 geçersiz dosya tipi) gizleniyor ve depo durumu yetkisiz kullanıcıya sızıyordu. Sıra düzeltildi: sahiplik → içerik tipi → depo yapılandırması
- Test/CI: api işinde **görsel deposu (S3Mock) eklendi**; presigned URL ve görsel bağlama testleri artık CI'da da gerçekten koşuyor (daha önce `S3_ENDPOINT` boş bırakılmıştı, bu testler 503 alıyordu). S3Mock imajında ne curl ne node bulunduğu için hazır olma beklemesi job'ın kendi Node'uyla yapılıyor. CI bucket adı `arlo-ci-gorseller`: S3 bucket adları **alt çizgi içeremez** (`InvalidBucketName`)
- Test: `node --test tests/` 110→122 (7 yeni birim: wallTabsHTML etkin sekme, aria-selected, bilinmeyen sekme, wallEmptyText, beğeni düğmesi/sayaç, likeBtnFace, commentsHTML yazma yetkisi + HTML kaçışı + silme yetkisi + tek çubuk regresyonu), sunucu testleri 51→70 (10 yeni: takip akışı sözleşmesi/cursor sayfalaması, beğeni sayaç-kimlik, yorum yetkileri, **Stripe webhook imzası uçtan uca**, **dönüş adresi güvenliği**). `scripts/verify-member.mjs` 19→34 kontrol: sekmeler, üye olmayan için yorum kutusu ve beğeni paywall'ı, üye olarak beğeni/yorum gönderme
- Test: `safeReturnUrl` (ödeme dönüş adresi) hiç test edilmemişti; beyaz liste dışı origin, `javascript:` ve `*.evil.com` gibi adreslerin varsayılan siteye çevrildiği artık doğrulanıyor
- Yeni: 🧪 `scripts/checkout-smoke.mjs` — Stripe test anahtarıyla $1 ödeme akışını uçtan uca dener (yapılandırma, fiyat kaynağı, gerçek Checkout oturumu, ödeme öncesi üyelik oluşmaması, üyenin tekrar ödeme açamaması). Kart bilgisi girmez; açılan Checkout adresini sen test kartıyla ödersin. Adımlar: SUNUCU.md §4
- Test: webhook imzası artık **gerçekten üretilip doğrulanıyor** (Stripe'ın belgelediği HMAC-SHA256 algoritması): doğru imza üyelik verir, değiştirilmiş gövde/yanlış imza/başlıksız istek reddedilir, aynı olay iki kez gelince tek ödeme kaydı oluşur
- Sürüm 4.1.0 olarak derlendi.

## [4.0.0] - 2026-10-05

- Yeni: 👤 **Üyelik arayüzü** — header'da 👤 düğmesi; giriş/ücretsiz kayıt penceresi, üye rozeti (⭐), kalan ücretsiz proje hakkı, "Profilim", çıkış. Parola sunucuda argon2id ile saklanır
- Yeni: 🎟️ **Üyelik kapısı** — gerçek yapay zekâ çağrısından önce `POST /api/ai/pass`: giriş yoksa giriş penceresi, hak bittiyse **paywall** (fiyat `/api/health`'den okunur, istemciden tutar gelmez). Demo şablonu (API anahtarı yokken) ücretsiz kalır; kapı sunucu hatasında **açılır**, proje üretimi durmaz
- Yeni: 🌍 **Topluluk duvarı** — `🌍 Duvar` düğmesi herkese açık listeyi açar: görsel, başlık, yazar ve açıklama herkese, **prompt yalnız üyelere** (kilitli kart). Sayfalama "Daha fazla göster" düğmesiyle
- Yeni: 🧑‍🚀 **Profil ve takip** — duvar kartındaki yazara ya da "Profilim"e tıklayınca profil açılır: avatar, görünen ad, biyografi, proje/takipçi/takip sayaçları ve paylaşılan projeler. **Takip Et / Takip Ediliyor** durumu sunucudan gelen `isFollowing` ile sürülür; kendi profilinde takip düğmesi yerine "Bu senin profilin" yazar
- Yeni: 🌍 **Paylaşım akışı** — rehberde "🌍 Duvarı Paylaş" düğmesi; başlık/açıklama/prompt hazır gelir, fotoğraf **presigned PUT ile doğrudan depoya** yüklenir ve projeye bağlanır. Üye olmayanlar paywall'a düşer
- Yeni: ⚙️ **Runtime yapılandırma** — `API_BASE` ortam değişkeni `dist/config.js`'e yazılır ve JS'e gömülür; `sw.js` de dosyayı uygulama kabuğuna ekler. Adres boşsa **hiçbir ağ isteği atılmaz**, uygulama eskisi gibi yalnız demo modda çalışır (GitHub Pages dağıtımı bozulmaz)
- Yeni: 🗄️ `server/` altında üyelik/ödeme/duvar API'si — Node 20 + Express 4 + Prisma 6 + PostgreSQL; Docker Compose ile ayağa kalkar (çoklu proje izolasyonu, Traefik etiketleri)
- Yeni: 🔒 **Prompt gizliliği sunucu tarafında zorlanır** — `src/projectSelect.js` tek kapı: üye olmayan istekte Prisma `select` listesine `promptBody` hiç girmez (UI gizlemesi değil). `server/tests/prompt-leak.test.js` ham yanıtı tarar; istemcide `wallCardHTML` de prompt yoksa kilitli kart basar
- Yeni: 💳 Stripe Checkout + webhook (imzalı, `providerRef` ile idempotent) — ilk 1000 kişi tek seferlik $1 ömür boyu, sonrası aylık; **fiyat ve plan yalnız sunucudan** (`config.js` → PRICING)
- Yeni: 🖼️ Görsel deposu S3/MinIO uyumlu; tarayıcı presigned PUT ile yükler, dosya API'den geçmez
- Yeni: 🧪 51 sunucu testi + `wallCardHTML`/`fmtUsd` birim testleri; CI'a Postgres servisiyle ayrı `api` işi eklendi. `scripts/verify-member.mjs` gerçek tarayıcıda 19 kontrol yapar (üye olmayana prompt kilitli, hak bitince paywall, profil + takip/takipten çık)
- Not: `dist/` hâlâ tek dosya + `config.js`; GitHub Pages dağıtımı aynen korunuyor. Kurulum/Stripe/VDS belgeleri: SUNUCU.md
- Düzeltme: `weeklyProgressSVG` testi `Date.now()`'a bağlıydı ve **pazartesi 00:00'den sonra** kırılıyordu ("dün aynı hafta" varsayımı yalnız salı–pazar arasında doğru). Test sabit bir referans haftasına (15 Haziran 2026 Pazartesi) bağlandı; kaynak kod değişmedi
- Sürüm 4.0.0 olarak derlendi.

## [3.1.0] - 2026-10-04

- Yeni: 📊 **Sınıf karşılaştırma grafiği** — paneldeki ⚖️ kartın altında çift çubuklu SVG: 5 metrik (öğrenci, ort. ilerleme, tamamlanan adım, tahmini bütçe, en aktif hafta) iki sınıf için yan yana çubuk; her metrik iki sınıfın büyüğüne göre ölçeklenir, kazanan taraf teal vurgulu. Bütçede az harcamak iyi sayılır
- Yeni: 🖨️ **Raporda karşılaştırma** — PDF sınıf raporuna "⚖️ Sınıf Karşılaştırması" bölümü ve aynı grafik basılır (yalnız ≥2 sınıf kodu varsa; tek sınıf seçiliyken anlamsız olurdu)
- Yeni: 📱 **Mobil uyumluluk** — header 375px'te 824px genişlikte taşıyordu (logo + 6 düğme tek satıra sığmıyor, sayfa yatay kayıyordu). Header artık 640px ve 900px eşiklerinde sarıyor; dokunma hedefleri 34-40px'e büyütüldü. 375/390/768px'te yatay taşma sıfır
- Test: 86→90 birim (4 yeni: compareBarsHTML, bütçede kazanan yönü, classMetricValue, raporda grafik), E2E 31→34 kontrol (10d, 10e, 13c)
- Test altyapısı: E2E senaryoları `tests/e2e.test.mjs` ile `node --test` içine alındı — birim + tarayıcı testleri tek komut (`node --test tests/`). Senaryo tanımları `scripts/e2e.mjs` modülünde kaldı; CLI (`--only`, `--list`) aynen çalışıyor
- CI: iki ayrı job yerine tek job — bağımlılıkları kurar, chromium indirir, derler ve `node --test tests/` koşar
- Düzeltme: `node --test` altında tarayıcı süreci kapatılmadığı için koşu hiç sonlanmıyordu; `after()` kancası eklendi

## [3.1.0] - 2026-10-04

- Sürüm 3.1.0 olarak derlendi.

## [3.0.0] - 2026-10-03

- Yeni: ⚖️ **Sınıf karşılaştırma** — panelde iki sınıf seçici (A vs B); öğrenci sayısı, ortalama ilerleme, tamamlanan adım, tahmini bütçe ve en aktif hafta yan yana tabloda, daha iyi değer vurgulu; ≥2 sınıf kodu varsa görünür
- Yeni: ⏱️ **Öğrenci zaman çizelgesi** — panelde öğrenci kartında ⏱️ düğmesiyle açılır: adım zaman damgaları + gönderim günü kronolojik (gün/saat); PDF raporda her öğrenci için gün bazlı özet satırı ("01 Eki (2 adım) · 03 Eki (gönderim)")
- Yeni: 📄 **Arşiv mini önizleme** — kartta Önizleme düğmesi kartı açar: rehber özeti + ilk 3 adım + ilk ipucu; tekrar tıklayınca kapanır, arama/sıralama odak kaybettirmez
- Yeni: 🎓 **Rapor sınıf turları** — "Tüm sınıflar" görünümünde PDF raporu her sınıfı kendi 🎓 bölüm başlığıyla ayrı tabloda dizer; tablo satırlarına sınıf kodu rozeti (cls-tag) eklenir
- Düzeltme: sınıf seçiliyken PDF raporu açmak `esc2` tanımlanmadan erişim (TDZ) nedeniyle hataya düşüyordu — tanım başa alındı
- Test: 86 birim (7 yeni: compareClasses, compareTableHTML, studentTimeline, timelineSummary, groupSubsByClass, rapor turu, archivePreviewData), E2E 21→31 kontrol (10 yeni: 10a-10c, 11a-11c, 12a-12b, 13a-13b)
- Test altyapısı: E2E senaryoları 13 bağımsız bloğa ayrıldı — her senaryo kendi browser context'inde, temiz localStorage ve sıfır modül durumuyla koşar; sıralamaya bağımlılık ve "senaryo N kalıntısı" kırılmaları bitti
- Test altyapısı: Senaryo seçici eklendi — `node scripts/e2e.mjs --only 12`, `--only 9-12`, `--only 6,12`, `--list` (bilinmeyen kimlik `exit 2`). Senaryolar bir kayıt defterine alındı, seçim dışı senaryolar hiç açılmıyor
- Düzeltme: `6d` kontrolü yanlış hedefi arıyordu (`[data-act="cart"]` gönderi listesinde değil, ana rehberde var; 1. senaryodan kalma rehbere bakıyordu). Artık satırdaki gerçek aksiyonları doğruluyor: geri bildirim + ⏱️ + sil
- Düzeltme: Sertifika adı (`#certNameInput`) yazıldıktan sonra rehber yeniden render olduğunda (canlı maliyet ipucu ~400 ms) kayboluyordu — input değeri yalnızca sertifika oluşturulunca saklanıyordu. Artık her tuş vuruşunda saklanıyor; öğrenci "🏅 Sertifika Oluştur"a basınca ad yerinde duruyor

## [2.22.0] - 2026-10-02

- Yeni: 🏫 **Çoklu sınıf desteği** — panelde sınıf seçici (gönderi dosyalarındaki classCode'lardan otomatik); CSV indirmesi ve PDF raporu seçili sınıfa göre süzülür, seçim korunur; "Tüm sınıflar" görünümü de var. Rapor başlığında aktif sınıf etiketi (🎓) yazar
- Yeni: 📈 **Panelde canlı haftalık grafik** — rapor açmadan son 8 haftanın adım toplamları sağ kartta görünür; CSS değişkenleriyle koyu/açık temaya uyar (rapordaki grafikle aynı veri kaynağı)
- Yeni: 🔃 **Arşiv sıralama + son açılış** — 🆕 En yeni / ⭐ Favoriler önce / 🔤 A→Z seçici; kartlar en son açıldıkları günü (🔓) gösterir

## [2.21.0] - 2026-10-02

- Yeni: 🔍 **Arşiv arama** — arşiv penceresinde başlık, fikir ve etiketlerde Türkçe harf duyarsız (foldTR) anlık süzme; yazarken odak kaybolmaz (grid ayrı çizilir), ⭐/🏷️ çipleriyle birlikte çalışır
- Yeni: 📅 **Haftalık katılım detayı** — sınıf raporunda grafik altında en güncel 4 haftanın her biri için kim kaç adım tamamladı (hafta toplamıyla, en çok 6 isim + "+n")
- Yeni: 🕒 **CSV "Son Etkinlik" sütunu** — öğrenci başına en son adım işaretlendiği gün (adım yoksa gönderim günü); dönem sonu Excel takibinde risk analizi kolaylaşır

## [2.20.0] - 2026-10-01

- Yeni: 📅 **CSV tarih filtresi** — öğretmen panelinde başlangıç/bitiş tarihi seç; CSV indirimi ve gönderi listesi bu aralığa göre süzülür, aralık korunur. Rapor başlığında "CSV tarih aralığı: … (n/total)" yazar; temizle düğmesi tek tıkla tüm gönderilere döner
- Yeni: ⭐ **Arşiv favori/etiket sistemi** — ⭐ ile favorile, 🏷️ ile virgülle ayırarak (en çok 5) etiket ver; ⭐ Favoriler / 🏷️ etiket çipleriyle filtrele. Favoriler Portfolyo.zip'te öne alınır, zip'e favoriler + etiket özetli RAPOR.md girer
- Yeni: 👁️ **Göz serbest modu** — "Bana Anlat" artık adım adım okur: her adım bitince 2 sn bekler, adımı otomatik işaretler ve sonrakine geçer; işaretli adımlardan kaldığı yerden devam eder. Durdur/Yeniden üret modu güvenle keser

## [2.19.0] - 2026-10-01

- Sürüm 2.19.0 olarak derlendi.
- Yeni: 🛒 **Alışveriş listesi** — rehber aksiyonlarına "Alışveriş Listesi" düğmesi; malzemeleri "parça × adet — satır toplamı" biçiminde WhatsApp'a hazır metne döker, sonda proje toplamı var. Adet geçersiz kılmaları (−/+ kutuları) metne yansır; popup engellenirse liste panoya kopyalanır
- Yeni: 🔍 **Gönderi arama + sayfalama** — öğretmen panelinde öğrenci/proje adında Türkçe harf duyarsız (foldTR) arama; 6'şarlı sayfalama, odak kaybı olmadan anlık filtreleme
- Yeni: 🔥 **En aktif hafta** — sınıf raporunda haftalık grafiğin altında "En aktif hafta: tarih — N adım" özeti ( Pazartesi kümeleri ortak mondayOf yardımcısıyla)
- Test: 63→67 birim (4 yeni: shoppingListText, filterSubmissions, paginate, mostActiveWeek), E2E 11→15 kontrol (6a-6d: sayfalama, arama, alışveriş düğmesi)

## [2.18.0] - 2026-10-01

- Sürüm 2.18.0 olarak derlendi.
- Yeni: 🏷️ **Katalog öneri çipleri** — öğretmen paneli, depo fiyat kataloğunda (fiyat-katalogu.json) olup henüz özel fiyatı olmayan parçaları çip olarak önerir; tıklayınca parça öğretmenin özel fiyat listesine depo fiyatıyla eklenir ve Ayarlar'daki editörle senkron kalır
- Yeni: 🚨 **Risk Altındaki Öğrenciler** — son 10 gündür yeni adım göndermemiş ve projesini bitirmemiş öğrenciler panelde en eski tarihli önce listelenir (kırmızı vurgulu kart)
- Yeni: ❓ **Fiyatlanamayan Malzemeler** — özel/depoyu/gömülü katalogların hiçbirinde karşılığı olmayan parça adları sınıf genelinde toplanır (büyük/küçük harf farkı birleştirilir, adet sayılır) ve çip olarak gösterilir; öğretmene hangi fiyatları ekleyeceği söylenir
- Yeni: 📊 **CSV dışa aktarma** — sınıf gönderileri Excel uyumlu .csv olarak iner (UTF-8 BOM, ';' ayırıcı, tırnak kaçış), sütunlar: öğrenci, proje, tamamlanan/toplam adım, ilerleme %, tahmini maliyet USD, geri bildirim, tarih
- Test: 58→63 birim test (5 yeni: catalogSuggestions, atRiskStudents, unknownMaterials, classSubsToCSV, downloadClassCSV); E2E 11/11 aynı

## [2.17.0] - 2026-09-30

- Sürüm 2.17.0 olarak derlendi.
- Yeni: 📈 **Sınıf raporunda haftalık ilerleme grafiği** — gönderimlerin tamamlanan adımları haftaya kümelendirilir, son 8 haftanın çubuk grafiği lider tablosunun altına basılır
- Yeni: 🎯 **Sınıf bütçe planlayıcısı** — Ayarlar'a "Sınıf mevcudu" girdisi; sınıf raporu mevcut × ortalama proje maliyetiyle tüm sınıfın bütçe ihtiyacını hesaplar ve öğretmen bütçe sınırıyla karşılaştırır
- Not: mevcut/bütçe cihaz tercihleri sayılır, veri yedeğine girmez (BACKUP_SKIP)
- Ek: README'ye canlı uygulama ekran görüntüsü (docs/screenshot.png); CI'ya E2E job'ı (Playwright, file:// dist üzerinde 11 kontrol)

## [2.16.0] - 2026-09-30

- Sürüm 2.16.0 olarak derlendi.
- Yeni: ✨ **AI'lı canlı maliyet tahmini** — API anahtarı varsa yazdığın fikir AI'a kısa bir istemle gönderilir, AI gerçek parça listesi döndürür ve o liste fiyatlanır ("✨ AI tahmini ≈ …"). Anahtar yoksa/istek başarısızsa demo şablon ipucusuna sessizce düşer; sonuç 10 dk önbelleklenir, yarış koşulu korumalı (yalnız en yeni girişin cevabı basılır)
- Yeni: 💱 **Otomatik kur tazeleme** — uygulama açılışında saklanan kur 24 saatten eskiyse çevrimiçi sessizce güncellenir; başarılıysa açık rehber yeni kurla yeniden çizilir
- Temizlik: sw.js sürüm yorumu netleştirildi (CACHE_NAME build.py ile güncellenmeye devam eder); PWA dosyaları canlı sitede doğrulandı (manifest/icon/sw 200)
- Not: v2.16.0 testlerle 56/56; AI tahmini için 3 yeni test (istem şeması, gemini yanıtı ayrıştırma/hata yolları, AI/demo fallback + önbellek)

## [2.15.0] - 2026-09-30

- Sürüm 2.15.0 olarak derlendi.
- Yeni: 💱 **Çevrimiçi kur** — Ayarlar'da "1 USD = X₺ (zaman önce güncellendi)" durumu + 🌐 Çevrimiçi Güncelle düğmesi; exchangerate.host/er-api'den çekilir, localStorage'da saklanır, hata anında saklanan/varsayılan kur (34) kullanılır. Tüm ₺ gösterimleri (tablo, PDF, rapor, sertifika, Portfolyo, kart) bu kurdan hesaplanır
- Yeni: 🚀 **publish.sh** — test + sürümlü derleme + gh-pages yenileme + push'u tek komutta birleştiren yayın script'i (./publish.sh veya ./publish.sh 2.16.0)
- Yeni: 🤝 **CONTRIBUTING.md** + 🐛/💡 issue şablonları + PR şablonu
- Not: Proje ~/Documents/GitHub/arduino-ruya-atolyesi'ye taşındı; GitHub Pages canlı: proacademycomtr.github.io/arduino-ruya-atolyesi

## [2.14.0] - 2026-09-30

- Sürüm 2.14.0 olarak derlendi.
- Yeni: 📁 **Depoda varsayılan katalog** — `fiyat-katalogu.json` artık projenin kökünde; build.py onu hem dist'e kopyalar hem FILE_CATALOG olarak JS'e gömer. Fiyat önceliği: öğretmen özel (localStorage) → depo → gömülü PRICE_CATALOG; Ayarlar'daki bütçe alanı depo sınırını placeholder olarak gösterir
- Yeni: 💡 **Bütçe aşımı önerisi** — toplam sınırı aşarsa tabloda "Bütçe önerisi: Arduino Uno yerine Arduino Nano kullan ($10.00 → $6.00)" satırı (özel fiyatlar da hesaba katılır)
- Yeni: ⌨️ **Canlı maliyet ipucu** — fikir yazarken 30+ karakterde demo rehber üzerinden anlık tahmin: "💡 Bu fikre benzer proje ≈ 646.00₺ ($19.00)" (400ms gecikmeli)
- Yeni: 📋 **SÜRÜM_NOTLARI.md** — v2.10→v2.14 fiyat modülünün tamamını özetleyen sürüm notları sayfası

## [2.13.0] - 2026-09-30

- Sürüm 2.13.0 olarak derlendi.
- Yeni: 🔽 **Fiyata göre sıralama** — malzeme tablosunun Tutar başlığındaki düğme pahalıdan ucuza (↓) → ucuza pahalıya (↑) → orijinal sıra (⇅) döngüsü yapar; fiyatlanamayan parçalar her zaman sonda, tercih hatırlanır
- Yeni: 📎 **Portfolyo.zip'e fiyat katalogu** — öğretmen özel fiyatları + bütçe sınırı `fiyat-katalogu.json` olarak arşive girer; PORTFOLYO.txt'te veliler/okul idaresi için açıklama notu taşır (katalog boşsa dosya üretilmez)
- Yeni: 💰 **Sınıf raporunda toplam bütçe** — tüm öğrencilerin projelerinin tahmini maliyeti toplanır ve raporun üstünde "Sınıf toplam bütçesi" satırında gösterilir; bütçe sınırı aşılırsa ⚠️ "bütçe aşımı" işaretiyle
- Gelişti: 🏅 **Sertifikada bütçe aşımı işareti** — proje maliyeti öğretmen sınırını aşarsa sertifika şeridi (PDF + Portfolyo SVG'si) kırmızıya döner: "⚠️ BÜTÇE AŞIMI"; sınır içindeyse altın şerit + normal not

## [2.12.0] - 2026-09-30

- Sürüm 2.12.0 olarak derlendi.
- Değişti: 💱 **TL ana para birimi** — tüm fiyat gösterimlerinde ₺ öncelikli, $ parantez içinde ikincil: `612.00₺ ($18.00)`; tablo, PDF, sınıf raporu, WhatsApp, sertifika kartı ve Portfolyo özetinde tek biçim
- Yeni: 🎯 **Bütçe sınırı uyarısı** — Ayarlar'dan USD cinsinden üst sınır girilir; proje toplamı aşarsa malzeme tablosunda ⚠️ kırmızı "Bütçe aşımı (Sınır: …)" satırı ve PDF'te "bütçe aşımı" etiketi; 0/boş = kapalı, cihaz tercihi (yedeğe girmez)
- Yeni: 🏅 **Sertifikada fiyat şeridi** — PDF (canvas) ve Portfolyo SVG sertifikasında altın yuvarlak köşeli şerit: "Tahmini proje maliyeti: 612.00₺ ($18.00) · ortalama perakende tahmini"
- Yeni: 📤 **Katalog JSON paylaşımı** — öğretmen özel fiyatlarını + bütçe sınırını `fiyat-katalogu.json` olarak dışa aktarır; diğer öğretmen aynı dosyayı içe aktararak katalogu devralır (sayı olmayan fiyatlar sessizce atlanır)

## [2.11.0] - 2026-09-29

- Sürüm 2.11.0 olarak derlendi.
- Yeni: 🏷️ **Öğretmen fiyat kataloğu** — Ayarlar'a "Parça adı: fiyat (USD)" satırları yazılır (noktalı/virgüllü ondalık ikisi de olur), localStorage'da kalıcıdır ve fiyat tahmininde katalog fiyatının YERİNE geçer; en uzun eşleşen ad kazanır, ✏️ işaretiyle tabloda belli olur
- Yeni: 🔢 **Canlı adet düzenleyici** — malzeme tablosunda her satırda −/+ düğmeleri ve yazılabilir adet kutusu; toplam anında güncellenir, adetler proje başına localStorage'da saklanır
- Yeni: 📊 **Sınıf raporunda Maliyet sütunu** — gönderim dosyası artık proje malzemelerini taşır; öğretmen her öğrencinin projesinin tahmini maliyetini raporda görür
- Yeni: 💰 **Portfolyo.zip'e bütçe özeti** — PORTFOLYO.txt'te proje başına tahmini maliyet + portfolyo toplamı ("alışveriş listesi değildir" notuyla)

## [2.10.0] - 2026-09-29

- Sürüm 2.10.0 olarak derlendi.
- Yeni: 💰 **Malzeme fiyat tahmini** — her rehberin malzeme tablosunda Birim Fiyat ve Tutar sütunları; yaklaşık Türkiye perakende fiyatları 39 parçalık katalogdan ($ + ₺ çift gösterim, kur bilgi amaçlı ~34)
- Yeni: **Ortalama Proje Fiyatı** satırı — adet × birim hesabıyla proje toplamı; katalogda olmayan parçalar "—" ile işaretlenir ve toplama katılmaz
- PDF çıktısı ve WhatsApp paylaşımı da fiyat toplamını taşır; sertifika projesi kartına 4. istatistik kutusu (≈ fiyat) eklendi
- AI rehberlerinde de çalışır: AI malzeme adlarını aynı katalogla fiyatlar, bilinmeyenler dürüstçe "fiyatlanmadı" olarak gösterilir

## [2.9.0] - 2026-09-28

- Sürüm 2.9.0 olarak derlendi.
- Yeni: 🌙🎲📏 **3 yeni demo rehber** — otomatik gece lambası (LDR + histeresis), butonla atılan dijital zar (randomSeed gürültü tohumu, 6 LED'li zar yüzleri), OLED mesafe ölçer (HC-SR04 + SSD1306 ikili kütüphane); üçü de wokwiValidate'ten 0 uyarıyla geçer ve 🚀 İleri Seviye bölümü taşır. Demo sayısı 11 → 14; altın rozet eşiği artık demo sayısından otomatik türetilir
- Yeni: 📜 **Portfolyo.zip'e sertifikalar** — her proje klasörüne baskı-dostu SERTIFIKA.svg eklenir (certificateSVG, certCanvas ile aynı görsel dil)
- Yeni: ⚡ **Toplu geri bildirim** — öğretmen panelinde yorumu bekleyen tüm gönderiler tek listede; "Hepsini İndir" her öğrenciye kişisel .geribildirim.json dosyası indirir ve gönderileri işaretler
- Yeni: 💾 **Veri yedeği** — Ayarlar'dan tüm uygulama verisi (arşiv, adımlar, sınıf, gönderiler, rozetler, geri bildirimler, özel bileşenler) tek .yedek.json dosyasına dışa aktarılır / başka bilgisayarda geri yüklenir; dil/tema gibi cihaz yerel tercihleri hariçtir
- Çözücü iyileştirmeleri: satır sahibi parça tespiti ("OLED GND → GND" satırındaki GND, satırdaki OLED parçasınındır), çoklu örnek parça bağlantıları (LED1/LED2… ayrı ayrı çözülür), OLED'de LCD'ye yanlış eşleşme engellendi, wokwi-7segment DP pini, RGB/OLED'de boşta düz LED parçası üretilmez

## [2.8.0] - 2026-09-28

- Sürüm 2.8.0 olarak derlendi.
- Yeni: 🎨🔧🕐 **3 yeni demo rehber** — LCD'li dijital saat (I2C, millis() sayaç), RGB LED mood lambası (0-767 ton haritası, PWM karıştırma), servo kapı kilidi (kenar algılama, durum makinesi); üçü de wokwiValidate'ten 0 uyarıyla geçer ve 🚀 İleri Seviye bölümü taşır
- Yeni: 📄 **Sınıf raporuna Geri Bildirim sütunu** — her gönderimde "Verildi ✓ / Bekliyor" durumu + varsa öğretmen yorumunun 80 karakterlik özeti
- Yeni: 🥉🥈🥇 **Rozet kademeleri** — Başarımlar modalında bronz (3 sertifika) / gümüş (5) / altın (tüm 11 demo) ilerleme kartı + "sonraki hedef" metni
- Yeni: 📦 **Portfolyo.zip** — sertifikalı tüm rehberlerin Wokwi paketleri (sketch.ino + diagram.json + öğretmen notları) numaralı klasörler hâlinde tek arşivde; kökte PORTFOLYO.txt özeti. Sertifikalar artık rehber snapshot'ı saklar; eski guide'sız kayıtlar atlanır
- Düzeltme: RGB projesinde "RGB LED" metni ayrıca boşta bir wokwi-led parçası üretiyordu — RGB varken düz LED eklenmez

## [2.7.0] - 2026-09-25

- Sürüm 2.7.0 olarak derlendi.
- Yeni: 🏫 **Öğretmen paneli** — Sınıf Modu artık iki sütunlu geniş panel: solda sınıf kodu + içe aktarma + rapor, sağda ilerleme yüzdeli gönderi kartları ve geri bildirim yazma (tek ekranda)
- Yeni: 🏅 **Öğrenci başarımları** — header'da sayaçlı yeni düğme; kazanılan sertifikalar + okunan öğretmen geri bildirimleri kart görünümünde listelenir (mükerrer kayıt engellenir)
- Yeni: 🚀 **İleri Seviye bölümü** — 7 segment (ikinci display ile 0-99 multiplexing, butonla durdur/başlat) ve piyano (kayıt/çalma, pot ile oktav) demo rehberlerine katlanabilir gelişmiş kutu: ek wiring satırları + kod parçaları
- Yeni: 📦 **Zip kişiselleştirme** — Wokwi paketi öğrenci adı + sınıf kodunu bilir: sketch.ino'ya başlık yorumu, öğretmen notlarına "Öğrenci / Sınıf kodu" satırları (ad: gönderim/sertifika girişlerinden)

## [2.6.0] - 2026-09-25

- Sürüm 2.6.0 olarak derlendi.
- Yeni: 💬 **Öğretmen geri bildirimi** — öğretmen içe aktarılan gönderiye yorum yazar, `.geribildirim.json` indirir; öğrenci "Geri Bildirimi Göster" ile açıp rehberde okur (yorumlar tarayıcıda saklanır)
- Yeni: ⚡ **Wokwi'de Aç güçlendirildi** — sketch kodu + tüm bağlantılar çözülmüşse diagram.json tek kopyada panoya; Wokwi şablonu yeni sekmede açılır
- Yeni: 🏆 **Lider tablosu** — sınıf raporuna ilerlemeye göre sıralı SVG çubuk grafik (ilk 10, print-to-PDF dostu, bağımlılıksız)
- Yeni: 🔢🚗🎹 **3 yeni demo rehber** — 7 segment display sayacı (wokwi-7segment, ortak katot), ultrasonik park sensörü, buzzer'lı mini piyano (INPUT_PULLUP, 4 buton); üçü de wokwiValidate'ten 0 uyarıyla geçer
- Düzeltme: sınıf gönderim içe aktarma tek-nesne `.klasor.json` biçimini kabul eder (dizi/sarmalayıcı yanına)
- Düzeltme: çözücüde tek harfli pin kelimeleri ("Display A") sahip parça adına gömülü olduğu için yutuluyordu — 3+ harf sınırıyla pinler doğru çözülür

## [2.5.0] - 2026-09-25

- Sürüm 2.5.0 olarak derlendi.
- Yeni: 🏫 **Sınıf Modu** — öğretmen sınıf kodu üretir, öğrenci adımlarını tamamlayıp `.klasor.json` gönderim dosyası indirir; öğretmen gönderimleri içe aktarıp PDF sınıf raporu alır (sunucusuz, dosya tabanlı)
- Yeni: 📦 **Wokwi Paketi (.zip)** — rehberden sketch.ino + diagram.json + öğretmen notları içeren gerçek proje arşivi; bağımlılıksız zip yazıcı (STORE yöntemi, CRC32 doğrulanmış)
- Yeni: 🛠️ **Adım takibi** — her adımda onay kutusu + ilerleme çubuğu; tüm adımlar bitince sertifika ve gönderim satırları açılır
- Yeni: 🧪 birim testler — `node --test tests/`; çözücü, wokwiValidate, zip yazıcı, sınıf gönderimi ve özel set normalize senaryoları (16 test, app.js sanal ortamda değerlendirilir)

## [2.4.0] - 2026-09-25

- Sürüm 2.4.0 olarak derlendi.
- Yeni: 5 demo rehbere `wokwiHints` — demo modunda bile gerçek röle/motor/servo kablolaması çıkar (L298N/DC motor Wokwi'de olmadığı için potansiyometre ile simüle edilir, satır notuyla açıklanır)
- Yeni: `wokwiValidate` taslak doğrulaması — pin çakışması (aynı pine iki kablo) + eksik GND/5V uyarıları, öğretici kontrol kutusunda
- Yeni: sertifika penceresine 1080×1080 paylaşım kartı PNG indirme düğmesi
- Yeni: özel bileşen seti — öğretmenler bileşen ekler, JSON olarak dışa/içe aktarır (localStorage kalıcı, "Özel Set" kategorisi)
- Düzeltme: Wokwi parça tipleri gerçek adlarına güncellendi (relay-module, lcd1602, pir-motion-sensor, photoresistor-sensor, ssd1306)
- Düzeltme: AI prompt'u yalnızca geçerli Wokwi tiplerini listeler; L298N/DC motor uydurma tip yerine NULL döndürür
- İyileştirme: kablo çözücü — ARDUINO öneki, ~10 PWM pini, satır-sahibi parça yönlendirmesi, çoklu aynı-tip parça desteği
- Düzeltme: çözücü büyük/küçük harf duyarsız; "IR sensör SOL — OUT" gibi tireli satırlar çözülür; VCC/GND satırın kendi parçasına bağlanır (yanlış hint-parçası değil)
- Düzeltme: "DC motor" artık yanlışlıkla "Servo Motor" kütüphane parçasına eşleşmez (genel kelimeler eşleştirmede hariç)

## [2.3.0] - 2026-09-24

- Sürüm 2.3.0 olarak derlendi.
- Yeni: AI şemasına `wokwiHints` alanı — her malzeme için Wokwi parça tipi + pin eşlemesi; kablo üretimi bunları öncelikli kullanır
- Yeni: bileşen kütüphanesi kartlarına Wokwi parça tipi/pin eşlemeleri eklendi ve taslak üretiminde kullanılıyor
- Yeni: eşleşmeyen bağlantı satırları için rehberde öğretici yardım kutusu
- Yeni: arşivden tek tıkla sertifika üretimi (🏅, ad sorulur, PDF iner)
- İyileştirme: sertifika adı hatırlanır, sonraki sertifikalarda önerilir

## [2.2.0] - 2026-09-24

- Sürüm 2.2.0 olarak derlendi.
- Yeni: sürüm rozeti + sürüm geçmişi modalı (footer)
- Yeni: paylaşım kartını Web Share API ile doğrudan paylaşma (desteklenmezse indirme)
- Yeni: PWA — manifest + service worker ile çevrimdışı kullanım
- Yeni: Wokwi diagram.json kopyalarken parça/kablo özeti ve eşleşmeyen satır uyarısı

## [2.1.0] - 2026-09-24

- Sürüm 2.1.0 olarak derlendi.
