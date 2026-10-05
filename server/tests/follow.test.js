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

test("zaman akışı sözleşmesi /api/wall ile aynı: viewer, followingCount, cursor", async () => {
  await prisma.follow.deleteMany();
  await prisma.project.deleteMany();
  const takip = await makeUser({ member: true });
  const kaynak = await makeUser({ member: true });
  for (let i = 0; i < 5; i += 1) {
    await makeProject(kaynak.id, { title: `Sayfalama ${i}` });
  }
  const token = await login(takip.email);
  await request(app).post(`/api/users/${kaynak.handle}/follow`).set("Authorization", `Bearer ${token}`);

  const ilk = await request(app).get("/api/feed/timeline?limit=2").set("Authorization", `Bearer ${token}`);
  assert.equal(ilk.status, 200);
  assert.equal(ilk.body.items.length, 2);
  assert.equal(ilk.body.nextCursor, ilk.body.items[1].id);
  assert.equal(ilk.body.viewer.isMember, true);
  assert.equal(ilk.body.viewer.handle, takip.handle);
  assert.equal(ilk.body.followingCount, 1);

  const ikinci = await request(app)
    .get(`/api/feed/timeline?limit=2&cursor=${ilk.body.nextCursor}`)
    .set("Authorization", `Bearer ${token}`);
  const ilkKarmasik = ilk.body.items.map((p) => p.id).sort().join(",");
  const ikinciKarmasik = ikinci.body.items.map((p) => p.id).sort().join(",");
  assert.notEqual(ilkKarmasik, ikinciKarmasik, "sayfa 2, sayfa 1 ile aynı kayıtları dönmemeli");

  // Kalan sayfaları gez: hiçbir kayıt iki kez görünmemeli.
  const gorulen = new Set([...ilk.body.items, ...ikinci.body.items].map((p) => p.id));
  let cursor = ikinci.body.nextCursor;
  while (cursor) {
    const sayfa = await request(app)
      .get(`/api/feed/timeline?limit=2&cursor=${cursor}`)
      .set("Authorization", `Bearer ${token}`);
    for (const p of sayfa.body.items) {
      assert.ok(!gorulen.has(p.id), `kayıt iki kez döndü: ${p.id}`);
      gorulen.add(p.id);
    }
    cursor = sayfa.body.nextCursor;
  }
  assert.equal(gorulen.size, 5, "beş kayıt da tam olarak bir kez gelmeli");
});

test("hiç kimseyi takip etmeyen üyede followingCount 0 ve cursor yok", async () => {
  const yalniz = await makeUser({ member: true });
  const token = await login(yalniz.email);
  const akis = await request(app).get("/api/feed/timeline").set("Authorization", `Bearer ${token}`);
  assert.equal(akis.status, 200);
  assert.deepEqual(akis.body.items, []);
  assert.equal(akis.body.nextCursor, null);
  assert.equal(akis.body.followingCount, 0);
});

test("üye olmayan kullanıcının zaman akışına erişimi reddedilir", async () => {
  const uyeDegil = await makeUser();
  const token = await login(uyeDegil.email);
  const akis = await request(app).get("/api/feed/timeline").set("Authorization", `Bearer ${token}`);
  assert.equal(akis.status, 403);
});