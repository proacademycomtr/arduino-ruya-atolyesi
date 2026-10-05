import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/index.js";
import { prisma } from "../src/db.js";
import { makeUser, resetDb } from "./setup.js";
import { isOwnAvatarKey, newAvatarKey } from "../src/storage.js";

const app = createApp();
let user;
let diger;

const login = async (u) => {
  const res = await request(app).post("/api/auth/login").send({ email: u.email, password: "test1234" });
  return res.body.token;
};
// Token'ı bir kez alıp saklıyoruz: `login` async olduğu için senkron bir
// yardımcıda çağrılırsa başlığa "[object Promise]" yazılır ve her istek 401
// döner — sessiz ve çok yanıltıcı bir hata.
const TOKENS = new Map();
const auth = (u) => ({ Authorization: `Bearer ${TOKENS.get(u.handle)}` });

before(async () => {
  await resetDb();
  user = await makeUser({ member: true, displayName: "Avatar Sahibi" });
  diger = await makeUser({ member: true, displayName: "Başka Kişi" });
  for (const u of [user, diger]) TOKENS.set(u.handle, await login(u));
});
after(() => prisma.$disconnect());

/* ── anahtar kuralları ────────────────────────────────────── */

test("avatar anahtarı kullanıcı klasörünün altında ve rastgele", () => {
  const a = newAvatarKey("u1", "image/png");
  const b = newAvatarKey("u1", "image/png");
  assert.match(a, /^u\/u1\/avatar\/.+\.png$/);
  assert.notEqual(a, b);
  assert.equal(isOwnAvatarKey(a, "u1"), true);
  // Başkasının anahtarı kabul edilmez.
  assert.equal(isOwnAvatarKey(a, "u2"), false);
  assert.equal(isOwnAvatarKey("", "u1"), false);
});

test("avatar anahtarı proje anahtarı gibi kullanıcı klasörüne bağlı", () => {
  assert.equal(isOwnAvatarKey(`u/u1/avatar/2026-01-01-abc.png`, "u1"), true);
  assert.equal(isOwnAvatarKey(`u/u1/proj1/2026-01-01-abc.png`, "u1"), false);
});

/* ── uçlar ────────────────────────────────────────────────── */

test("presign giriş ister", async () => {
  const res = await request(app).post("/api/users/me/avatar/presign").send({ contentType: "image/png" });
  assert.equal(res.status, 401);
});

test("geçersiz içerik tipi 400 — depo yapılandırılmamış olsa bile", async () => {
  // projects.js'te düzelttiğimiz sıralamanın aynısı: içerik tipi ÖNCE
  // denetlenir, yoksa her istek 503 alıp gerçek hatayı gizler.
  const kotu = await request(app)
    .post("/api/users/me/avatar/presign")
    .set(auth(user))
    .send({ contentType: "application/pdf" });
  assert.equal(kotu.status, 400);
  assert.equal(kotu.body.error, "unsupported_type");
});

test("presign doğru tipte anahtar verir (depo yapılandırılmışsa)", async () => {
  const res = await request(app)
    .post("/api/users/me/avatar/presign")
    .set(auth(user))
    .send({ contentType: "image/png" });
  // Depo yoksa 503, varsa 200 + kendi klasöründe anahtar.
  if (res.status === 200) {
    assert.equal(isOwnAvatarKey(res.body.objectKey, user.id), true);
    assert.ok(res.body.url.startsWith("http"));
  } else {
    assert.equal(res.status, 503);
    assert.equal(res.body.error, "storage_not_configured");
  }
});

test("avatar bağlama yalnız kendi anahtarını kabul eder", async () => {
  const yabanci = await request(app)
    .post("/api/users/me/avatar")
    .set(auth(user))
    .send({ objectKey: `u/${diger.id}/avatar/sahte.png` });
  assert.equal(yabanci.status, 400);
  assert.equal(yabanci.body.error, "invalid_object_key");

  const proje = await request(app)
    .post("/api/users/me/avatar")
    .set(auth(user))
    .send({ objectKey: `u/${user.id}/proje1/sahte.png` });
  assert.equal(proje.status, 400);
});

test("avatar bağlanır, profilde görünür ve kaldırılabilir", async () => {
  const key = newAvatarKey(user.id, "image/png");
  const ekle = await request(app).post("/api/users/me/avatar").set(auth(user)).send({ objectKey: key });
  assert.equal(ekle.status, 200);
  assert.equal(ekle.body.user.handle, user.handle);

  const profil = await request(app).get(`/api/users/${user.handle}`);
  assert.equal(profil.body.user.avatarKey, key);
  assert.equal(profil.body.canEditAvatar, false); // jetonsuz izleyici

  const kendi = await request(app).get(`/api/users/${user.handle}`).set(auth(user));
  assert.equal(kendi.body.canEditAvatar, true);

  const kaldir = await request(app).delete("/api/users/me/avatar").set(auth(user));
  assert.equal(kaldir.status, 200);
  assert.equal(kaldir.body.user.avatarUrl, null);
  const sonra = await request(app).get(`/api/users/${user.handle}`);
  assert.equal(sonra.body.user.avatarKey, null);
});

test("avatar kaldırma giriş ister", async () => {
  assert.equal((await request(app).delete("/api/users/me/avatar")).status, 401);
  assert.equal((await request(app).post("/api/users/me/avatar").send({ objectKey: "x" })).status, 401);
});

test("avatar rotaları /:handle rotasını gölgelemez", async () => {
  // "me/avatar" bir kullanıcı handle'ı DEĞİL; profil rotası hâlâ çalışır.
  const profil = await request(app).get(`/api/users/${user.handle}`);
  assert.equal(profil.status, 200);
  assert.equal(profil.body.user.handle, user.handle);
});
