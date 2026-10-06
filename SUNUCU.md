# Sunucu — Yerel Çalıştırma ve VDS Dağıtımı

Üyelik, ödeme (Stripe), profil, takip ve topluluk duvarı bu klasördeki API'de yaşar.
Statik site (`dist/index.html`) GitHub Pages'te durmaya devam eder; arayüzün yeni
bölümleri (giriş, duvar, profil) bu API'ye bağlanır.

---

## 1. Yapı

```
server/
  src/
    index.js        Express uygulaması, /api/health, rotalar
    config.js       Tüm ortam değişkenleri + PRICING (fiyat burada)
    auth.js         argon2id parola, Bearer jeton, requireAuth/requireMember
    projectSelect.js  PROMPT SIZINTISININ TEK KAPISI
    storage.js      S3/MinIO presigned yükleme
    stripe.js       Stripe istemcisi + planFor() fiyat kararı
    routes/         auth · aipass · wall · projects · users · billing
  prisma/schema.prisma + migrations/ + seed.js
  tests/            node --test + supertest (49 test)
docker-compose.yml
docker-compose.s3mock.yml   (yalnız Docker Hub'da MinIO yoksa)
```

## 2. Bilinen kısıtlar (bilerek seçildi)

- **Yapay zekâ çağrıları sunucudan yapılmaz.** Kullanıcı kendi API anahtarını
  kullanmaya devam eder; sunucu anahtarı hiçbir zaman tutmaz.
- `POST /api/ai/pass` bir **maliyet kontrolü değil, dönüşüm kapısıdır.** Site saf
  istemci olduğu için bu kural %100 zorunlu kılınamaz (curl ile atlanabilir).
  $1'lik bir üründe kabul edilen bilinçli sınırdır.
- Oturum çerezi yerine **Bearer token** kullanılır: statik site GitHub Pages'te
  (farklı origin), üçüncü taraf çerezi engellemesi oturumu bozmasın diye.
- **E-posta doğrulaması yok.** Doğrulama e-postası için harici SMTP gerekir;
  şimdilik gerekmiyor.

---

## 3. İlk çalıştırma (bilgisayarında)

```bash
cp server/.env.example server/.env      # parolaları değiştir (dosya gitignore'lu)
docker compose -p arlo up -d --build
docker compose -p arlo logs -f api
curl -s http://127.0.0.1:4021/api/health
```

Beklenen: `{"ok":true,"db":true,"storage":true,...}`

Prisma Studio (yalnız localhost:5555):

```bash
docker compose -p arlo --profile dev up -d studio
```

Örnek veri:

```bash
docker compose -p arlo exec api node prisma/seed.js
# deniz@example.com / demo1234  → üye
# merhaba@example.com / demo1234 → üye değil
```

Testler:

```bash
docker compose -p arlo --profile dev run --rm test
```

> Docker Hub'da `minio/minio` imajına erişimin yoksa (kurumsuz ağ gibi):
> `docker compose -p arlo -f docker-compose.yml -f docker-compose.s3mock.yml up -d`
> S3 API'si aynıdır; yalnız konsol ve kalıcılık farklıdır.
> Not: S3Mock **9090** portunu dinler (MinIO 9000); override `S3_ENDPOINT`'i buna göre
> düzeltir. GitHub Actions'ta da aynı S3Mock kullanılır, `arlo-ci-gorseller` bucket
> adıyla — S3 bucket adları alt çizgi içeremez (`InvalidBucketName`).

## 4. Stripe kurulumu

1. Stripe Dashboard (ABD şirketi) → Products → Prices:
   - **Lifetime:** one-time payment, 1.00 USD → `price_...`
   - **Monthly:** recurring, 1.00 USD / month → `price_...`
2. `server/.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PRICE_LIFETIME=price_...
   STRIPE_PRICE_MONTHLY=price_...
   ```
3. Webhook (local): `stripe listen --forward-to localhost:4021/api/webhooks/stripe`
   → çıkan `whsec_...` değerini `STRIPE_WEBHOOK_SECRET` yap.
4. Üretimde webhook adresi: `https://<DOMAIN>/api/webhooks/stripe`
   → events: `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`.

Webhook ulaşmazsa istemci `POST /api/billing/verify` çağırır; sunucu oturumu
gerçekten ödenmiş mi diye kontrol eder.

### Test anahtarıyla uçtan uca deneme

`.env` dolduktan ve `docker compose ... up -d --build api` çalıştıktan sonra:

```bash
node scripts/checkout-smoke.mjs
```

Script: yapılandırmanın yüklü olup olmadığını, fiyatın sunucudan geldiğini, gerçek
bir Checkout oturumunun açılıp açılmadığını, ödeme öncesi üyeliğin **oluşmadığını**
ve üye hesabın ikinci kez ödeme açamadığını kontrol eder. Kart bilgisi
girmeni istemez; açılan Checkout adresini **sen** tarayıcıda açıp Stripe'ın test
kartıyla (`4242 4242 4242 4242`, herhangi bir son kullanma tarihi ve CVC) ödersin.

Ödeme sonrası iki yol vardır ve ikisi de çalışmalıdır:

- **Webhook:** `stripe listen --forward-to localhost:4021/api/webhooks/stripe`
  çalışırken ödeme yap → `checkout.session.completed` otomatik işlenir.
- **Doğrulama uçtan uca (webhook yoksa):** dönüş adresindeki `session_id` ile
  ```bash
  curl -X POST http://127.0.0.1:4021/api/billing/verify \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <token>' \
    -d '{"sessionId":"cs_test_..."}'
  ```

Her iki yoldan sonra `GET /api/auth/me` çalıştırınca `isMember: true` ve
üyelik planı `LIFETIME` görünmelidir. Aynı `verify` isteğini ikinci kez
göndermek **ikinci ödeme kaydı oluşturmamalıdır** (`Payment.providerRef` tekil).

### Fiyat kuralı (v4.4.0 — iki kademeli kontenjan)

| Kademe | Kişi | Ücret |
|---|---|---|
| 1 | ilk `PRICING_FREE_LIMIT` (1000) | **Ücretsiz** ömür boyu — Stripe'a uğramaz |
| 2 | sonraki `PRICING_PAID_LIMIT − PRICING_FREE_LIMIT` (1000) | tek seferlik `PRICING_LIFETIME_CENTS` ($1) |
| 3 | sonrası | `PRICING_MONTHLY_CENTS` ($1/ay) abonelik |

- Kademe kararı **tek yerde** verilir: `server/src/stripe.js` → `planFor(used)`.
  `used` = `LIFETIME` + `ACTIVE` üyelik sayısı (`server/src/seats.js` → `countLifetimeSeats`).
  Ücretsiz üyelik de `LIFETIME` yazıldığı için koltuğu doldurur.
- **Kademe 1'de `POST /api/auth/register` anında üyelik verir**; kullanıcı
  Stripe'a hiç uğramaz ve üyelik `priceCents: 0` olarak kaydedilir.
  `POST /api/billing/checkout` de aynı kademede `free: true` döner.
- Ücretsiz koltuk dolunca kademe 2'ye geçilir: normal Checkout (`mode=payment`).
  Ücretli koltuk da dolunca kademe 3 (`mode=subscription`) açılır — **kapı hiçbir
  kademede kapanmaz** (`launch_sold_out` artık kullanılmıyor).
- **Fiyat ve plan yalnızca sunucudan gelir**; istemciden gelen tutar yok sayılır.
- `GET /api/health` → `pricing.freeLimit / paidLimit / total / used / tier / remaining`.
  İstemci bu alanlarla lansman CTA'sındaki **doluluk barını** ve kademeye göre
  değişen fiyat/rozet/düğme metinlerini çizer.

> Bilinen sınır: ücretsiz koltuk sayımı ile ekleme iki ayrı adımdır; tam 1000.
> sınırdaki eşzamanlı kayıtlarda kontenjan 1 kişi aşabilir. Kritikleşirse
> koltuk için ayrı tablo + `SELECT … FOR UPDATE` gerekir.

---

## 5. VDS'e dağıtım (çoklu proje dostu)

Aynı VDS'te başka projeler de çalışacaksa bu kurallar zorunludur.

**Tek seferlik, host'ta:**

```bash
docker run -d --name traefik --restart always \
  -p 80:80 -p 443:443 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v traefik_certs:/letsencrypt \
  traefik:v3 \
  --providers.docker=true --providers.docker.exposedbydefault=false \
  --entrypoints.web.address=:80 \
  --entrypoints.websecure.address=:443 \
  --entrypoints.web.http.redirections.entrypoint.to=websecure \
  --certificatesresolvers.letsencrypt.acme.tlschallenge=true \
  --certificatesresolvers.letsencrypt.acme.email=senin@ornek.com \
  --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
```

**Her proje için:**

```bash
# 1) bu repoyu /opt/arlo dizinine klonala
# 2) server/.env içinde: DOMAIN, POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD (yeni ve güçlü)
# 3) ayağa kaldır
docker compose -p arlo up -d --build
```

Çakışma olmaz çünkü:
- `container_name` hiç kullanılmaz → adlar `arlo-*` olur
- host portları yalnız `127.0.0.1:4021` (kendi projeninki) — API_PORT değiştirilebilir
- volume'lar `arlo_pgdata`, `arlo_minio` — proje önekli
- veritabanı adı `arlo_db`
- Traefik kuralı yalnız `DOMAIN`'e bağlı

İkinci bir proje = yeni klasör + yeni `DOMAIN` + yeni `API_PORT` + `docker compose -p <ad> up -d`.
Traefik'e, nginx'e veya host yapılandırmasına dokunulmaz.

**Güvenlik notları:**
- `db` ve `storage` portları host'a açılmaz.
- Prisma Studio `dev` profilinde; VDS'te çalıştırma.
- `SEcrets: sırları .env'de tut, .env asla commit edilmez (gitignore'lu).`

### Yedekleme

```bash
docker compose -p arlo exec db pg_dump -U arlo arlo_db > arlo-$(date +%F).sql
```

---

## 6. API Sözleşmesi (özet)

| Yöntem | Yol | Yetki | Not |
|---|---|---|---|
| GET | `/api/health` | herkese açık | sürüm + db/stripe/storage durumu |
| POST | `/api/auth/register` | — | token + kullanıcı; `freePasses: 1` |
| POST | `/api/auth/login` | — | token |
| POST | `/api/auth/logout` | üye | |
| GET | `/api/auth/me` | — | jetonsuz da çağrılabilir |
| POST | `/api/ai/pass` | üye | hak varsa `allowed:true`, yoksa `402 upgrade_required` |
| GET | `/api/wall?cursor=&limit=` | **herkese açık** | `promptBody` üye değilse **yok** |
| GET | `/api/feed/timeline` | üye | takip edilenler; `/api/wall` ile aynı sözleşme (cursor, viewer, followingCount) |
| GET | `/api/projects/:id` | herkese açık | `promptBody` üye değilse yok |
| POST | `/api/projects` | üye | duvara paylaşım |
| POST | `/api/projects/:id/images/presign` | üye (sahip) | MinIO presigned PUT |
| GET | `/api/users/:handle` | herkese açık | profil + paylaşımlar |
| POST/DELETE | `/api/users/:handle/follow` | üye | |
| POST | `/api/billing/checkout` | üye | Stripe Checkout url'si |
| POST | `/api/billing/portal` | üye | Stripe müşteri portalı |
| POST | `/api/billing/verify` | üye | webhook kaçırıldıysa |
| POST | `/api/webhooks/stripe` | imza | ham gövde + `stripe-signature` |

## 7. Prompt gizliliği

`server/src/projectSelect.js` tek kapıdır. Üye olmayan istekte Prisma'ya giden
`select` listesinde `promptBody` **bulunmaz** — UI'da gizlemek yerine veri hiç
gönderilmez. `server/tests/prompt-leak.test.js` ham yanıt metnini tarayarak
hem alan adını hem prompt içeriğini denetler.

## 8. İstemciyi API'ye bağlama

```bash
# API adresini vererek derle (dist/config.js ve gömülü varsayılan yazılır)
API_BASE=https://arduino.proacademy.com.tr python3 build.py 4.0.0

# Canlı doğrulama (API ayakta, dist yerel sunucuda)
cd dist && python3 -m http.server 8000 &
SITE=http://localhost:8000/index.html node scripts/verify-member.mjs
```

`verify-member.mjs` gerçek tarayıcıda 19 kontrol yapar: düğmeler, health, ücretsiz kayıt,
kalan hak, duvarın üye olmayana **kilitli** açılması, profil açılması, kendi profilde takip
düğmesi olmaması, hak bitince paywall, sunucudan gelen fiyat, çıkış, **takip et / takipten çık**
ve sayfa hatası olmaması. `CI`'a bağlı değildir (çalışan API + tarayıcı ister), elle koşulur.

`config.js` dosyası olmayan tek dosya dağıtımda uygulama gömülü `API_BASE_DEFAULT`'a düşer.
**Tarayıcının origin'i `APP_ORIGIN` beyaz listesinde olmalıdır** (`http://localhost:8000`
gibi) — aksi hâlde CORS engeller ve düğmeler "sunucuya ulaşılamıyor" der.

## 9. İstemci özellikleri ve neler yapılmadı

Hazır olanlar: üyelik penceresi, üyelik kapısı + paywall, herkese açık duvar (prompt kilitli),
paylaşım (fotoğraf + prompt), profil sayfası, takip/takipten çık, **takip akışı sekmesi**,
**beğeni ve yorum**, **duvar/arşiv araması ve sıralaması**, **moderasyon (yorum gizleme,
paylaşım kaldırma) ve şikâyet/raporlama**, **profil avatarı yükleme**, **hamburger menü +
lansman doluluk barı**, runtime yapılandırma.

> v4.4.0: başlıktaki menü artık ☰ panelinde ve **ziyaretçi menüyü göremez**
> (yalnız Demo Modu rozeti + Giriş Yap + Kaydol görünür). Rozet giriş yapınca gizlenir.
> Kayıt, ücretsiz kontenjan açıkken **anında üye yapar** — "üye olmayan" davranışları
> `verify-member.mjs` içinde seed'deki `merhaba@example.com` ile denenir.

**Henüz olmayanlar:**
- E-posta doğrulama ve parola sıfırlama yok.
- Moderasyon paneli (yönetici için tek ekranda rapor listesi) yok: raporlar API ile
  alınıp işlenebiliyor ama arayüzde yönetici ekranı henüz yok.

### Yeni uçlar (v4.3.0)

| Yöntem | Yol | Yetki | Not |
|---|---|---|---|
| GET | `/api/wall?q=&sort=` | herkese açık | `sort`: `new` (varsayılan), `top`, `discussed` |
| GET | `/api/feed/timeline?q=&sort=` | üye | takip akışı, `/api/wall` ile aynı sözleşme |
| PATCH | `/api/comments/:id` | yazar, proje sahibi veya yönetici | `{hidden}` |
| DELETE | `/api/projects/:id/share` | proje sahibi veya yönetici | paylaşımı duvardan kaldırır |
| PATCH | `/api/projects/:id/moderation` | yönetici | `{hidden}` |
| POST | `/api/reports` | üye | `targetType`: `project`, `comment`, `user` |
| GET | `/api/reports` | yönetici | `requireAuth` + `isAdmin`; duruma göre süzme |
| PATCH | `/api/reports/:id` | yönetici | `{status}`: `RESOLVED` / `DISMISSED` |
| POST | `/api/users/me/avatar/presign` | giriş yapmış | görsel presign, `image/*` |
| POST | `/api/users/me/avatar` | giriş yapmış | `objectKey` bağlar (`newAvatarKey` ile üretilmiş olmalı) |
| DELETE | `/api/users/me/avatar` | giriş yapmış | avatarı siler |

Arama Türkçe duyarlıdır: metin kayıt anında `server/src/str.js` → `foldTR` ile
katlanıp `Project.searchText` içine yazılır, sorgu da aynı katlamayla karşılaştırılır
(büyük/küçük harf ve aksan farkı aramayı bozmaz). Moderasyon alanları
`Project.hiddenAt`, `Comment.hiddenAt`/`hiddenById`; raporlar `Report` tablosunda.

> Not: avatar rotaları `GET /api/users/:handle`'ten **önce** tanımlı olmalıdır, aksi
> hâlde `me/avatar` isteği bir kullanıcı handle'ı sanılır.

### Yeni uçlar (v4.1.0)

| Yöntem | Yol | Yetki | Not |
|---|---|---|---|
| GET | `/api/projects/:id/comments` | herkese açık | `canComment` yalnız üye için true |
| POST | `/api/projects/:id/comments` | üye | gövde 2–1000 karakter |
| DELETE | `/api/comments/:id` | yazar veya proje sahibi | |
| POST | `/api/projects/:id/like` | üye | aynı kullanıcı iki kez beğenemez |
| DELETE | `/api/projects/:id/like` | üye | |

`shapeProject` artık herkese açık `likeCount` / `commentCount` döner; kartlardaki
`likedByViewer` yalnız gerçekten üye olan görüntüleyiciye `true` gider.
- Giriş kapısı **yalnız gerçek yapay zekâ çağrısında** devreye girer (API anahtarı varken). Demo şablonu ücretsiz kalır; aksi hâlde GitHub Pages'teki "kurulum yok, aç ve kullan" vaadi bozulurdu.