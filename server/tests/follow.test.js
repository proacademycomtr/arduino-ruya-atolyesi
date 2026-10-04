import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/index.js";
import { prisma } from "../src/db.js";
import { makeProject, makeUser, resetDb } from "./setup.js";

const app = createApp();
let takipci;
let hedef;

before(async () => {
  await resetDb();
  takipci = await makeUser({ member: true, displayName: "Takipçi" });
  hedef = await makeUser({ member: true, displayName: "Hedef" });
});
after(() => prisma.$disconnect());

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "test1234" });
  return res.body.token;
}

test("olmayan profil 404 döner", async () => {
  const res = await request(app).get("/api/users/boyle-biri-yok");
  assert.equal(res.status, 404);
});

test("jetonsuz takip isteği 401 döner", async () => {
  const res = await request(app).post(`/api/users/${hedef.handle}/follow`);
  assert.equal(res.status, 401);
});

test("kendini takip etmek reddedilir", async () => {
  const token = await login(takipci.email);
  const res = await request(app).post(`/api/users/${takipci.handle}/follow`).set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "cannot_follow_self");
});

test("takip et ve bırak sayaçları günceller", async () => {
  const token = await login(takipci.email);
  const ekle = await request(app).post(`/api/users/${hedef.handle}/follow`).set("Authorization", `Bearer ${token}`);
  assert.equal(ekle.status, 200);
  assert.equal(ekle.body.isFollowing, true);

  const profil = await request(app).get(`/api/users/${hedef.handle}`);
  assert.equal(profil.body.user.followerCount, 1);
  assert.equal(profil.body.isFollowing, false, "anonim görüntüleyici için takip durumu bilinmez");

  const kendiGorunumu = await request(app).get(`/api/users/${hedef.handle}`).set("Authorization", `Bearer ${token}`);
  assert.equal(kendiGorunumu.body.isFollowing, true, "görüntüleyen takipçiyse isFollowing doğru olmalı");

  // Aynı takip isteği ikinci kez çalışır (upsert) — sayaç ikiye çıkmaz.
  await request(app).post(`/api/users/${hedef.handle}/follow`).set("Authorization", `Bearer ${token}`);
  const tekrar = await request(app).get(`/api/users/${hedef.handle}`);
  assert.equal(tekrar.body.user.followerCount, 1);

  const bırak = await request(app).delete(`/api/users/${hedef.handle}/follow`).set("Authorization", `Bearer ${token}`);
  assert.equal(bırak.body.isFollowing, false);
  const sonra = await request(app).get(`/api/users/${hedef.handle}`);
  assert.equal(sonra.body.user.followerCount, 0);
});

test("zaman akışı yalnız takip edilenlerin paylaşımlarını gösterir", async () => {
  await makeProject(hedef.id, { title: "Takip Edilen Proje" });
  const yabanci = await makeUser({ member: true });
  await makeProject(yabanci.id, { title: "Takip Edilmeyen Proje" });

  const token = await login(takipci.email);
  await request(app).post(`/api/users/${hedef.handle}/follow`).set("Authorization", `Bearer ${token}`);

  const akis = await request(app).get("/api/feed/timeline").set("Authorization", `Bearer ${token}`);
  assert.equal(akis.status, 200);
  const basliklar = akis.body.items.map((p) => p.title);
  assert.ok(basliklar.includes("Takip Edilen Proje"));
  assert.ok(!basliklar.includes("Takip Edilmeyen Proje"));
});

test("hiç kimseyi takip etmeyen üyenin akışı boştur", async () => {
  const yalniz = await makeUser({ member: true });
  const token = await login(yalniz.email);
  const akis = await request(app).get("/api/feed/timeline").set("Authorization", `Bearer ${token}`);
  assert.equal(akis.status, 200);
  assert.deepEqual(akis.body.items, []);
});

test("üye olmayan kullanıcının zaman akışına erişimi reddedilir", async () => {
  const uyeDegil = await makeUser();
  const token = await login(uyeDegil.email);
  const akis = await request(app).get("/api/feed/timeline").set("Authorization", `Bearer ${token}`);
  assert.equal(akis.status, 403);
});