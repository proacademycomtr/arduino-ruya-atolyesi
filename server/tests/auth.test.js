import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/index.js";
import { prisma } from "../src/db.js";
import { slugify } from "../src/routes/auth.js";
import { resetDb } from "./setup.js";

const app = createApp();

before(resetDb);
after(() => prisma.$disconnect());

test("sağlık kontrolü veritabanı ve yapılandırmayı raporlar", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.db, true);
  assert.equal(res.body.version, "4.4.0");
  assert.equal(res.body.pricing.lifetimeCents, 100);
  // v4.4.0: iki kademeli kontenjan + anlık doluluk (doluluk barı bunu okur).
  assert.equal(res.body.pricing.freeLimit, 1000);
  assert.equal(res.body.pricing.paidLimit, 2000);
  assert.equal(res.body.pricing.total, 2000);
  assert.equal(typeof res.body.pricing.used, "number");
  assert.equal(res.body.pricing.tier, "FREE");
});

test("kayıt token döndürür ve kullanıcıyı oluşturur", async () => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email: "yeni@example.com", password: "gizli1234", displayName: "Yeni Kullanıcı" });
  assert.equal(res.status, 201);
  assert.ok(res.body.token, "token dönmeli");
  assert.equal(res.body.user.email, "yeni@example.com");
  // v4.4.0: Ücretsiz kontenjan açıkken kayıt OLUR OLMAZ ücretsiz üye olunur
  // (Stripe'a uğramadan). Koltuk dolunca burası false döner ve $1 Checkout açılır.
  assert.equal(res.body.user.isMember, true, "ücretsiz kontenjan üyelik vermeli");
  assert.equal(res.body.membership.plan, "LIFETIME");
  assert.equal(res.body.membership.priceCents, 0, "ücretsiz üyelik 0 $ olmalı");
  assert.equal(res.body.freePasses, 1);
  assert.ok(res.body.handle, " profil adresi üretilmeli");
});

test("aynı e-posta ikinci kez kaydedilemez", async () => {
  await request(app).post("/api/auth/register").send({ email: "tekrar@example.com", password: "gizli1234", displayName: "Tekrar" });
  const res = await request(app).post("/api/auth/register").send({ email: "tekrar@example.com", password: "gizli1234", displayName: "Tekrar" });
  assert.equal(res.status, 409);
});

test("zayıf parola ve bozuk e-posta reddedilir", async () => {
  const zayif = await request(app).post("/api/auth/register").send({ email: "a@b.com", password: "kisa", displayName: "X" });
  assert.equal(zayif.status, 400);
  assert.equal(zayif.body.error, "weak_password");
  const bozuk = await request(app).post("/api/auth/register").send({ email: "e-posta-degil", password: "gizli1234", displayName: "X" });
  assert.equal(bozuk.status, 400);
  assert.equal(bozuk.body.error, "invalid_email");
});

test("giriş doğru parolayla çalışır, yanlış parola 401 verir", async () => {
  await request(app).post("/api/auth/register").send({ email: "giris@example.com", password: "dogru1234", displayName: "Giriş" });
  const ok = await request(app).post("/api/auth/login").send({ email: "giris@example.com", password: "dogru1234" });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  const kotu = await request(app).post("/api/auth/login").send({ email: "giris@example.com", password: "yanlis1234" });
  assert.equal(kotu.status, 401);
});

test("/me giriş yapmadan boş döner, token ile kullanıcıyı verir", async () => {
  const bos = await request(app).get("/api/auth/me");
  assert.equal(bos.status, 200);
  assert.equal(bos.body.user, null);

  const kayit = await request(app).post("/api/auth/register").send({ email: "me@example.com", password: "deneme1234", displayName: "Me Testi" });
  const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${kayit.body.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, "me@example.com");
  // Ücretsiz kontenjan sayesinde kayıt anında üyelik oluşur (v4.4.0).
  assert.equal(res.body.membership.plan, "LIFETIME");
  assert.equal(res.body.membership.status, "ACTIVE");
});

test("çıkış jetonu geçersiz kılar", async () => {
  const kayit = await request(app).post("/api/auth/register").send({ email: "cikis@example.com", password: "deneme1234", displayName: "Çıkış" });
  const token = kayit.body.token;
  const out = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);
  assert.equal(out.status, 200);
  const sonra = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  assert.equal(sonra.body.user, null);
});

test("jetonsuz korumalı rota 401 döner", async () => {
  const res = await request(app).post("/api/ai/pass");
  assert.equal(res.status, 401);
});

test("Türkçe karakterli görünen ad geçerli profil adresi üretir", () => {
  assert.equal(slugify("Ayşe Mühendis"), "ayse-muhendis");
  assert.equal(slugify("Çağrı Şahin"), "cagri-sahin");
  assert.equal(slugify("Öğrenci 1"), "ogrenci-1");
});

test("bilinmeyen API yolu 404 döner", async () => {
  const res = await request(app).get("/api/olmayan-yol");
  assert.equal(res.status, 404);
});