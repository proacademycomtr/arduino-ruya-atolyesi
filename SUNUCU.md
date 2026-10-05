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

### Fiyat kuralı

`config.js` → `PRICING_LIFETIME_LIMIT=1000`. Aktif ömür boyu üye sayısı 1000'den
küçükse Checkout `mode=payment` (tek seferlik $1), değilse `mode=subscription`.
**Fiyat ve plan yalnızca sunucudan gelir**; istemciden gelen tutar yok sayılır.

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
**beğeni ve yorum**, runtime yapılandırma.

**Henüz olmayanlar:**
- Arama, sıralama, moderasyon, raporlama yok.
- Profil yüklemesi (avatar) sunucuda alan olarak var (`User.avatarKey`) ama yükleme arayüzü yok.
- E-posta doğrulama ve parola sıfırlama yok.

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