import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import request from "supertest";

import { createApp } from "../src/index.js";
import { prisma } from "../src/db.js";
import { stripeConfig } from "../src/config.js";
import { constructEvent } from "../src/stripe.js";
import { makeUser, resetDb } from "./setup.js";

/**
 * Webhook İMZA doğrulaması — Stripe'ın belgelediği algoritma birebir
 * uygulanır: imza = HMAC-SHA256(gizli, "<zamanDamgası>.<hamGövde>").
 *
 * Burada Stripe API'sine gidilmez; amaç sunucunun imzayı gerçekten
 * doğrulamasıdır. Stripe test anahtarı olmadan da anlamlıdır: yanlış
 * imza, bozuk gövde ve oynanmış zaman damgası reddedilmeli; doğru imza
 * kabul edilmeli.
 */

const SECRET = "whsec_test_deneme_sifresi_1234567890";

/** Stripe'ın `stripe-signature` başlığındaki imzayı üretir. */
function imzaUret(govde, zamanDamgasi = Math.floor(Date.now() / 1000)) {
  const imza = crypto
    .createHmac("sha256", SECRET)
    .update(`${zamanDamgasi}.${govde}`)
    .digest("hex");
  return `t=${zamanDamgasi},v1=${imza}`;
}

const odemeOlayi = (userId) => ({
  id: "evt_test_" + crypto.randomBytes(6).toString("hex"),
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_" + crypto.randomBytes(8).toString("hex"),
      mode: "payment",
      status: "complete",
      payment_status: "paid",
      amount_total: 100,
      currency: "usd",
      customer: "cus_test_123",
      metadata: { userId }
    }
  }
});

let app;
let uye;
let oncekiGizli;
let oncekiAnahtar;

before(async () => {
  await resetDb();
  uye = await makeUser();
  // stripe.js yapılandırmayı import anında okur; testte elle eklıyoruz.
  oncekiGizli = stripeConfig.webhookSecret;
  oncekiAnahtar = stripeConfig.secretKey;
  stripeConfig.webhookSecret = SECRET;
  stripeConfig.secretKey = "sk_test_yerel_deneme";
  app = createApp();
});

after(async () => {
  stripeConfig.webhookSecret = oncekiGizli;
  stripeConfig.secretKey = oncekiAnahtar;
  await prisma.$disconnect();
});

const post = (govde, imza) =>
  request(app)
    .post("/api/webhooks/stripe")
    .set("Content-Type", "application/json")
    .set("stripe-signature", imza || "")
    .send(govde);

test("DOĞRU imzalı checkout.session.completed üyelik verir", async () => {
  const olay = odemeOlayi(uye.id);
  const govde = JSON.stringify(olay);
  const res = await post(govde, imzaUret(govde));
  assert.equal(res.status, 200);
  assert.equal(res.body.received, true);

  const uyelik = await prisma.membership.findUnique({ where: { userId: uye.id } });
  assert.ok(uyelik, "üyelik oluşmalı");
  assert.equal(uyelik.plan, "LIFETIME");
  assert.equal(uyelik.status, "ACTIVE");

  const odeme = await prisma.payment.findFirst({ where: { userId: uye.id } });
  assert.ok(odeme, "ödeme kaydı oluşmalı");
  assert.equal(odeme.amountCents, 100);
  assert.equal(odeme.kind, "LIFETIME");
});

test("YANLIŞ imza reddedilir ve üyelik OLUŞMAZ", async () => {
  const diger = await makeUser();
  const olay = odemeOlayi(diger.id);
  const govde = JSON.stringify(olay);

  const yanlis = await post(govde, "t=1700000000,v1=0000000000000000000000000000000000000000000000000000000000000000");
  assert.equal(yanlis.status, 400);
  assert.equal(yanlis.body.error, "invalid_signature");

  // Gövde değiştirilmiş ama imza eski kalmış → reddedilmeli.
  const imzali = imzaUret(JSON.stringify({ ...olay, id: "evt_test_degistirilmis" }));
  const oynanmis = await post(govde, imzali);
  assert.equal(oynanmis.status, 400, "değiştirilmiş gövde kabul edilmemeli");

  const uyelik = await prisma.membership.findUnique({ where: { userId: diger.id } });
  assert.equal(uyelik, null, "geçersiz imza üyelik vermemeli");
  assert.equal(await prisma.payment.count({ where: { userId: diger.id } }), 0);
});

test("imza başlığı yoksa reddedilir", async () => {
  const diger = await makeUser();
  const res = await post(JSON.stringify(odemeOlayi(diger.id)), "");
  assert.equal(res.status, 400);
  assert.equal(await prisma.membership.count({ where: { userId: diger.id } }), 0);
});

test("DOĞRU imza tekrar gelirse üyelik ve ödeme KİMEZ (idempotency)", async () => {
  const diger = await makeUser();
  const olay = odemeOlayi(diger.id);
  const govde = JSON.stringify(olay);
  const imza = imzaUret(govde);

  const ilk = await post(govde, imza);
  assert.equal(ilk.status, 200);
  const ikinci = await post(govde, imza);
  assert.equal(ikinci.status, 200);

  assert.equal(await prisma.payment.count({ where: { userId: diger.id } }), 1,
    "aynı olay iki ödeme kaydı oluşturmamalı");
  const uyelikler = await prisma.membership.count({ where: { userId: diger.id } });
  assert.equal(uyelikler, 1);
});

test("abonelik olayı aylık üyelik verir", async () => {
  const diger = await makeUser();
  const olay = {
    ...odemeOlayi(diger.id),
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_abonelik_" + crypto.randomBytes(6).toString("hex"),
        mode: "subscription",
        status: "complete",
        payment_status: "paid",
        amount_total: 100,
        currency: "usd",
        customer: "cus_test_456",
        subscription: "sub_test_456",
        metadata: { userId: diger.id }
      }
    }
  };
  const govde = JSON.stringify(olay);
  const res = await post(govde, imzaUret(govde));
  assert.equal(res.status, 200);

  const uyelik = await prisma.membership.findUnique({ where: { userId: diger.id } });
  assert.equal(uyelik.plan, "MONTHLY");
  assert.equal(uyelik.stripeSubscriptionId, "sub_test_456");
});

test("abonelik iptali üyeliği CANCELED yapar", async () => {
  const diger = await makeUser();
  const abonelikId = "sub_test_iptal_" + crypto.randomBytes(4).toString("hex");
  await prisma.membership.create({
    data: {
      userId: diger.id,
      plan: "MONTHLY",
      status: "ACTIVE",
      priceCents: 100,
      stripeSubscriptionId: abonelikId,
      currentPeriodEnd: new Date(Date.now() + 86400000)
    }
  });
  const olay = {
    id: "evt_test_iptal_" + crypto.randomBytes(6).toString("hex"),
    type: "customer.subscription.deleted",
    data: { object: { id: abonelikId, status: "canceled" } }
  };
  const govde = JSON.stringify(olay);
  const res = await post(govde, imzaUret(govde));
  assert.equal(res.status, 200);

  const uyelik = await prisma.membership.findUnique({ where: { userId: diger.id } });
  assert.equal(uyelik.status, "CANCELED", "iptal edilen abonelik üyeliği düşürmeli");
});

test("bilinmeyen olay tipi 200 döner ama üyelik vermez", async () => {
  const diger = await makeUser();
  const olay = { ...odemeOlayi(diger.id), type: "customer.created" };
  const govde = JSON.stringify(olay);
  const res = await post(govde, imzaUret(govde));
  assert.equal(res.status, 200);
  assert.equal(res.body.received, true);
  assert.equal(await prisma.membership.count({ where: { userId: diger.id } }), 0);
});

test("webhook sırrı tanımlı değilse constructEvent reddeder", () => {
  const eski = stripeConfig.webhookSecret;
  stripeConfig.webhookSecret = "";
  try {
    const govde = JSON.stringify(odemeOlayi(uye.id));
    assert.throws(() => constructEvent(govde, imzaUret(govde)), /stripe_webhook_secret_missing/);
  } finally {
    stripeConfig.webhookSecret = eski;
  }
});

test("constructEvent doğru imzayı çözer, yanlış imzayı reddeder", () => {
  const olay = odemeOlayi(uye.id);
  const govde = JSON.stringify(olay);
  const cozulmus = constructEvent(govde, imzaUret(govde));
  assert.equal(cozulmus.type, "checkout.session.completed", "Stripe imzası çözülmeli");
  assert.equal(cozulmus.id, olay.id);

  assert.throws(
    () => constructEvent(govde, "t=1700000000,v1=" + "0".repeat(64)),
    /signature|signature verification/i,
    "yanlış imza hata vermeli"
  );
});