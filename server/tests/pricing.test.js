/**
 * v4.4.0 — Kademe sınırlarının GERÇEK davranışta karşılığını doğrular.
 *
 * `PRICING_FREE_LIMIT` / `PRICING_PAID_LIMIT` config import edilmeden ÖNCE
 * kurulmalı; ESM modülleri bildirim sırasına göre değerlendirildiği için env
 * modülü ilk sıraya alındı. Böylece test 2 ücretsiz + 1 ücretli koltukla
 * çalışır — binlerce kayıt üretmeye gerek kalmaz.
 *
 * Node --test her dosyayı ayrı process'te çalıştırır; bu env yalnız bu dosyayı
 * etkiler.
 */
import "./presetPricingEnv.js";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/index.js";
import { prisma } from "../src/db.js";
import { planFor } from "../src/stripe.js";
import { pricing } from "../src/config.js";
import { resetDb } from "./setup.js";

const app = createApp();

before(resetDb);
after(() => prisma.$disconnect());

const kayit = (email) =>
  request(app).post("/api/auth/register").send({ email, password: "gizli1234", displayName: "Kademe Testi" });

const health = async () => (await request(app).get("/api/health")).body;

test("env daraltması devrede: 2 ücretsiz + 1 ücretli koltuk", () => {
  assert.equal(pricing.freeLimit, 2);
  assert.equal(pricing.paidLimit, 3);
  assert.equal(planFor(0).tier, "FREE");
  assert.equal(planFor(2).tier, "LIFETIME");
  assert.equal(planFor(3).tier, "MONTHLY");
});

test("ücretsiz kontenjan dolana kadar kayıt anında üye olunur", async () => {
  const a = await kayit("kademe-a@example.com");
  assert.equal(a.status, 201);
  assert.equal(a.body.user.isMember, true, "1. kişi ücretsiz üye olmalı");
  assert.equal(a.body.membership.priceCents, 0);

  const b = await kayit("kademe-b@example.com");
  assert.equal(b.body.user.isMember, true, "2. kişi de ücretsiz üye olmalı");

  const h = await health();
  assert.equal(h.pricing.used, 2);
  // `tier` her zaman "SONRA Kİ kişinin gireceği kademe"dir: 2 ücretsiz
  // koltuk da alındığı için sıradaki kişi $1 kademesine girer.
  assert.equal(h.pricing.tier, "LIFETIME", "2/2 ücretsiz alındı → sıradaki $1");
  assert.equal(h.pricing.remaining, 1, "1 ücretli koltuk kaldı");
  assert.equal(h.pricing.freeLimit, 2);
});

test("ücretsiz kontenjan dolunca kayıt ÜYE YAPMAZ ve kademe $1'e geçer", async () => {
  const c = await kayit("kademe-c@example.com");
  assert.equal(c.status, 201, "kayıt engellenmez");
  assert.equal(c.body.user.isMember, false, "ücretsiz koltuk kalmadı → üyelik verilmez");
  assert.equal(c.body.membership, null);

  const h = await health();
  assert.equal(h.pricing.tier, "LIFETIME", "1001. kişi $1 kademesine düşer");
  assert.equal(h.pricing.used, 2, "üye olmayan kişi koltuk doldurmaz");
  assert.equal(h.pricing.remaining, 1, "1 ücretli koltuk kaldı");
});

test("ücretsiz kontenjan doluyken checkout 503 döner (Stripe'sız sahte ödeme yok)", async () => {
  const token = (await kayit("kademe-d@example.com")).body.token;
  const res = await request(app).post("/api/billing/checkout").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 503);
  assert.equal(res.body.error, "stripe_not_configured");
});

test("ücretli kontenjan da dolunca kademe aylık aboneliğe geçer", async () => {
  // 3. koltuk: ücretsiz üye olmadığı için elle açılır (ödeme webhook'u gibi).
  const kullanici = await prisma.user.findUnique({ where: { email: "kademe-d@example.com" } });
  await prisma.membership.create({
    data: { userId: kullanici.id, plan: "LIFETIME", status: "ACTIVE", priceCents: 100, currency: "usd", lifetimeAt: new Date() }
  });

  const h = await health();
  assert.equal(h.pricing.used, 3);
  assert.equal(h.pricing.tier, "MONTHLY", "2000. kişiden sonra aylık abonelik");
  assert.equal(h.pricing.remaining, 0);
  assert.equal(h.pricing.paidLimit, 3);

  // Yeni kayıt yine yapılabilir (satış kapanmadı) ama üye yapılmaz.
  const e = await kayit("kademe-e@example.com");
  assert.equal(e.status, 201);
  assert.equal(e.body.user.isMember, false);
});
