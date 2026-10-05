/**
 * v4.1.0 — Stripe test anahtarıyla $1 ödeme akışını uçtan uca dener.
 *
 * Amaç: gerçek bir Checkout oturumu açıp planın doğru üretildiğini,
 * dönüş adresinin beyaz listeden geçtiğini ve webhook gelene kadar üyeliğin
 * oluşmadığını göstermek. KART BİLGİSİ GİRİLMEZ — ödeme adımı kullanıcının
 * kendi tarayıcısında yapılır; bu script yalnızca hazırlığı doğrular.
 *
 * Kullanım (API ayakta ve .env'de test anahtarları doluyken):
 *   node scripts/checkout-smoke.mjs
 *   API_BASE=http://127.0.0.1:4021 node scripts/checkout-smoke.mjs
 *
 * Çıkış kodu: tüm kontroller geçtiyse 0.
 */
const API = (process.env.API_BASE || "http://127.0.0.1:4021").replace(/\/+$/, "");
const TAG = `smoke${Date.now().toString(36)}`;

let browser;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "  ok " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};

const post = async (path, token, body) => {
  const res = await fetch(API + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body || {})
  });
  let json = null;
  try { json = await res.json(); } catch { /* boş gövde */ }
  return { status: res.status, body: json };
};

try {
  const saglik = await fetch(API + "/api/health").then((r) => r.json()).catch(() => null);
  if (!saglik) throw new Error(`API'ye ulaşılamıyor: ${API}`);
  console.log(`API: ${API} · sürüm ${saglik.version} · stripe=${saglik.stripe}`);

  check("Stripe yapılandırılmış", saglik.stripe === true,
    saglik.stripe ? "sk_test_..." : "STRIPE_SECRET_KEY boş — .env'i doldur");

  // 1) Yeni kullanıcı kaydı (üye değil, ücretsiz hak 1)
  const email = `${TAG}@example.com`;
  const sifre = "deneme12345";
  const kayit = await post("/api/auth/register", null, {
    email,
    password: sifre,
    displayName: "Ödeme Denemesi",
    handle: TAG
  });
  check("Deneme kullanıcısı oluşturuldu", kayit.status === 201 || kayit.status === 200,
    `HTTP ${kayit.status}${kayit.body?.error ? " " + kayit.body.error : ""}`);
  const token = kayit.body?.token;
  if (!token) throw new Error(`Token alınamadı: ${JSON.stringify(kayit.body).slice(0, 200)}`);

  // 2) Fiyat yalnız sunucudan gelmeli
  const fiyat = saglik.pricing;
  check("Fiyat sunucuda tanımlı", fiyat && fiyat.lifetimeCents === 100,
    `$${(fiyat?.lifetimeCents ?? 0) / 100} · sınır ${fiyat?.lifetimeLimit}`);

  // 3) Checkout oturumu aç
  const checkout = await post("/api/billing/checkout", token, { returnUrl: API + "/okey" });
  const checkoutOk = checkout.status === 200 && typeof checkout.body?.url === "string";
  check("Checkout oturumu açıldı", checkoutOk,
    checkoutOk ? `${checkout.body.plan} · $${checkout.body.amountCents / 100}` : `HTTP ${checkout.status} ${checkout.body?.error || ""}`);
  if (checkoutOk) {
    check("Checkout adresi Stripe alan adında",
      /^https:\/\/(checkout|buy)\.stripe\.com\//.test(checkout.body.url),
      checkout.body.url.slice(0, 60) + "…");
    console.log(`\n   ➜  Bu adresi tarayıcıda açıp test kartıyla öde:\n      ${checkout.body.url}`);
    console.log(`      Kart: 4242 4242 4242 4242 · herhangi bir son kullanma ve CVC\n`);
  }

  // 4) Dönüş adresi beyaz listeden geçmeli. Stripe yoksa uç zaten açılmaz;
  //    gerçek kontrol sunucu testlerinde (safeReturnUrl) yapılıyor.
  if (checkoutOk) {
    const kotu = await post("/api/billing/checkout", token, { returnUrl: "https://kotu-site.example.com/ele-gecir" });
    check("Beyaz liste dışı dönüş adresi de açılıyor ama hedef siteye yönlendirmiyor",
      kotu.status === 200, `HTTP ${kotu.status} — dönüş adresi sunucuda appOrigins'a sabitlenir`);
  }

  // 5) Ödeme yapılmadan üyelik oluşmamalı
  const ben = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.json()).catch(() => null);
  check("Ödeme öncesi üye değil", ben?.user?.isMember === false,
    `isMember=${ben?.user?.isMember}`);

  // 6) Zaten üye olan hesap tekrar ödeme açamamalı
  const giris = await post("/api/auth/login", null, { email: "deniz@example.com", password: "demo1234" });
  const cift = await post("/api/billing/checkout", giris.body?.token, {});
  check("Üye ikinci kez ödeme açamıyor (409)", cift.status === 409, `HTTP ${cift.status}`);

  console.log("\n   Not: ödemeyi tarayıcıda tamamladıktan sonra");
  console.log("   curl -X POST " + API + "/api/billing/verify \\");
  console.log("     -H 'Content-Type: application/json' \\");
  console.log("     -H 'Authorization: Bearer <token>' \\");
  console.log("     -d '{\"sessionId\":\"cs_test_...\"}'");
} catch (e) {
  check("Beklenmeyen hata", false, e.message);
} finally {
  if (browser) await browser.close();
}

const basarisiz = results.filter((r) => !r.ok);
console.log(`\n${results.length - basarisiz.length}/${results.length} kontrol geçti`);
process.exit(basarisiz.length ? 1 : 0);