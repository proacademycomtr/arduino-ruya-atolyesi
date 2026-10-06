import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/index.js";
import { prisma } from "../src/db.js";
import { planFor } from "../src/stripe.js";
import { grantMembershipFromCheckout, safeReturnUrl } from "../src/routes/billing.js";
import { config } from "../src/config.js";
import { makeUser, resetDb } from "./setup.js";

const app = createApp();

before(resetDb);
after(() => prisma.$disconnect());

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "test1234" });
  return res.body.token;
}

const opts = { freeLimit: 1000, paidLimit: 2000, lifetimeCents: 100, monthlyCents: 300, currency: "usd" };

test("fiyat kuralı: ilk 1000 kişi ÜCRETSİZ ömür boyu (Stripe'a uğramaz)", () => {
  const a = planFor(0, opts);
  assert.equal(a.tier, "FREE");
  assert.equal(a.plan, "LIFETIME");
  assert.equal(a.mode, "payment");
  assert.equal(a.free, true);
  assert.equal(a.amountCents, 0);
  assert.equal(a.priceId, null, "ücretsiz kademede Stripe fiyatı gerekmez");
  assert.equal(a.currency, "usd");
  assert.equal(a.remaining, 1000);
});

test("fiyat kuralı: 1001–2000 arası tek seferlik $1 ömür boyu", () => {
  const b = planFor(1000, opts);
  assert.equal(b.tier, "LIFETIME");
  assert.equal(b.mode, "payment");
  assert.equal(b.free, false);
  assert.equal(b.amountCents, 100);
  assert.equal(b.remaining, 1000, "1000 kişi ücretsiz doldu, 1000 kişi $1 kaldı");
  assert.equal(planFor(1999, opts).remaining, 1, "son kişiye 1 kalmalı");
});

test("fiyat kuralı: 2000 sonrası AYLIK aboneliğe geçilir, satış kapanmaz", () => {
  const c = planFor(2000, opts);
  assert.equal(c.tier, "MONTHLY");
  assert.equal(c.mode, "subscription");
  assert.equal(c.amountCents, 300, "aylık fiyat uygulanır");
  assert.equal(c.plan, "MONTHLY");
  assert.equal(c.soldOut, false, "kapı kapanmaz — aylık abonelik açıktır");
  assert.equal(c.remaining, 0);
  assert.equal(planFor(5000, opts).plan, "MONTHLY");
});

test("fiyat kuralı: kademe sınırlarında kırılma noktası doğru", () => {
  assert.equal(planFor(999, opts).tier, "FREE", "999. kişi hâlâ ücretsiz");
  assert.equal(planFor(1000, opts).tier, "LIFETIME", "1000. kişi ücretli kademeye düşer");
  assert.equal(planFor(1999, opts).tier, "LIFETIME");
  assert.equal(planFor(2000, opts).tier, "MONTHLY");
  // Ömür boyu kademelerde plan LIFETIME kalmalı.
  for (const n of [0, 1, 500, 999, 1000, 1999]) {
    assert.equal(planFor(n, opts).plan, "LIFETIME");
  }
});

test("Ücretsiz kontenjan açıkken checkout Stripe'sız üyelik verir", async () => {
  // Ücretsiz kademede ödeme adımı YOKTUR; Stripe anahtarı olmasa da
  // üyelik verilir (aksi hâlde lansman kapalı sunucuda kullanılamazdı).
  const user = await makeUser();
  const token = await login(user.email);
  const res = await request(app).post("/api/billing/checkout").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.free, true);
  assert.equal(res.body.amountCents, 0);
  const uye = await prisma.user.findUnique({ where: { id: user.id }, include: { membership: true } });
  assert.equal(uye.membership.plan, "LIFETIME");
  assert.equal(uye.membership.priceCents, 0, "ücretsiz üyelik 0 $ olarak kaydedilmeli");
});

test("Ücretsiz kontenjan varken ikinci kez checkout 409 döner", async () => {
  const user = await makeUser();
  const token = await login(user.email);
  await request(app).post("/api/billing/checkout").set("Authorization", `Bearer ${token}`);
  const ikinci = await request(app).post("/api/billing/checkout").set("Authorization", `Bearer ${token}`);
  assert.equal(ikinci.status, 409);
  assert.equal(ikinci.body.error, "already_member");
});

test("checkout oturumu her zaman sunucudaki fiyatı taşır, istemci fiyatı yok sayılır", async () => {
  // Sahte bir Stripe oturumu üzerinden plan kararını doğrular:
  // istemciden gelen amount kullanılmaz, PRICING ve yaşanan üye sayısı belirler.
  const user = await makeUser();
  const oturum = {
    id: `cs_test_${Date.now()}`,
    mode: "payment",
    payment_status: "paid",
    amount_total: 100,
    currency: "usd",
    customer: "cus_test",
    metadata: { userId: user.id, plan: "LIFETIME" }
  };
  const sonuc = await grantMembershipFromCheckout(oturum);
  assert.equal(sonuc.plan, "LIFETIME");

  const uye = await prisma.user.findUnique({ where: { id: user.id }, include: { membership: true } });
  assert.equal(uye.membership.plan, "LIFETIME");
  assert.equal(uye.membership.priceCents, 100);
  assert.equal(uye.membership.status, "ACTIVE");
});

test("aynı webhook iki kez gelirse tek ödeme kaydı oluşur", async () => {
  const user = await makeUser();
  const oturum = {
    id: `cs_test_idempotent_${Date.now()}`,
    mode: "payment",
    payment_status: "paid",
    amount_total: 100,
    currency: "usd",
    metadata: { userId: user.id, plan: "LIFETIME" }
  };
  await grantMembershipFromCheckout(oturum);
  const ikinci = await grantMembershipFromCheckout(oturum);
  assert.equal(ikinci.skipped, "already_processed");

  const odemeler = await prisma.payment.count({ where: { userId: user.id } });
  assert.equal(odemeler, 1);
  const uyelikler = await prisma.membership.count({ where: { userId: user.id } });
  assert.equal(uyelikler, 1);
});

test("üyelik verilmemiş webhook oturumu reddedilir", async () => {
  const oturum = { id: `cs_test_nouser_${Date.now()}`, mode: "payment", payment_status: "paid", amount_total: 100, currency: "usd", metadata: {} };
  const sonuc = await grantMembershipFromCheckout(oturum);
  assert.equal(sonuc.skipped, "no_user");
});

test("abonelik oturumu aylık üyelik açar", async () => {
  const user = await makeUser();
  const oturum = {
    id: `cs_test_sub_${Date.now()}`,
    mode: "subscription",
    payment_status: "paid",
    amount_total: 300,
    currency: "usd",
    customer: "cus_test_sub",
    subscription: "sub_test_1",
    metadata: { userId: user.id, plan: "MONTHLY" }
  };
  const sonuc = await grantMembershipFromCheckout(oturum);
  assert.equal(sonuc.plan, "MONTHLY");
  const uye = await prisma.user.findUnique({ where: { id: user.id }, include: { membership: true } });
  assert.equal(uye.membership.plan, "MONTHLY");
  assert.equal(uye.membership.stripeSubscriptionId, "sub_test_1");
});

test("üye olan kullanıcı ikinci kez ödeme başlatamaz", async () => {
  const user = await makeUser({ member: true });
  const token = await login(user.email);
  const res = await request(app).post("/api/billing/checkout").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 409);
});

test("ödemeyle üye olan kullanıcı /api/ai/pass sınırsız hak alır", async () => {
  const user = await makeUser({ freePasses: 0 });
  const token = await login(user.email);
  const kapili = await request(app).post("/api/ai/pass").set("Authorization", `Bearer ${token}`);
  assert.equal(kapili.status, 402);

  await grantMembershipFromCheckout({
    id: `cs_test_unlock_${Date.now()}`,
    mode: "payment",
    payment_status: "paid",
    amount_total: 100,
    currency: "usd",
    metadata: { userId: user.id, plan: "LIFETIME" }
  });

  const acik = await request(app).post("/api/ai/pass").set("Authorization", `Bearer ${token}`);
  assert.equal(acik.status, 200);
  assert.equal(acik.body.unlimited, true);
});
/* ── dönüş adresi güvenliği (v4.1.0) ─────────────────────────────────
   Ödeme sonrası kullanıcı Stripe'dan geri yönlendirilir. Bu adres
   istemciden gelir; beyaz listedeki origin'ler dışındaki her şey
   varsayılan siteye çevrilmeli (açık yönlendirme / phishing riski). */
test("dönüş adresi beyaz listedeki origin'e sabitlenir", () => {
  const izinli = config.appOrigins[0];

  // Beyaz listedeki adres aynen korunur.
  assert.equal(safeReturnUrl(izinli + "/?pay=ok"), izinli + "/?pay=ok");
  assert.equal(safeReturnUrl(""), izinli, "adres yoksa varsayılan site");
  assert.equal(safeReturnUrl(null), izinli);
  assert.equal(safeReturnUrl(undefined), izinli);

  // Farklı site: kullanıcının gönderdiği adres değil, varsayılan kullanılır.
  for (const kotu of [
    "https://kotu.example.com/ele-gecir",
    "https://kotu.example.com",
    "http://localhost:8000.evil.com/",
    "javascript:alert(1)",
    "not-a-url"
  ]) {
    assert.equal(safeReturnUrl(kotu), izinli, `reddedilmeliydi: ${kotu}`);
  }

  // Aynı origin, farklı yol: yol korunur (pay=ok sorgusu döner).
  assert.equal(safeReturnUrl(izinli + "/?pay=cancel"), izinli + "/?pay=cancel");

  // Alt origin kabul edilmez (tam eşleşme gerekir).
  assert.equal(safeReturnUrl(izinli + ".evil.com/"), izinli);
});
