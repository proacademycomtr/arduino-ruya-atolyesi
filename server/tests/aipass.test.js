import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/index.js";
import { prisma } from "../src/db.js";
import { makeProject, makeUser, resetDb } from "./setup.js";

const app = createApp();
let guest;
let member;

before(async () => {
  await resetDb();
  guest = await makeUser({ freePasses: 1 });
  member = await makeUser({ member: true, freePasses: 0 });
});
after(() => prisma.$disconnect());

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "test1234" });
  return res.body.token;
}

test("ücretsiz hak bir kez kullanılır, sonra 402 döner", async () => {
  const token = await login(guest.email);
  const ilk = await request(app).post("/api/ai/pass").set("Authorization", `Bearer ${token}`);
  assert.equal(ilk.status, 200);
  assert.equal(ilk.body.allowed, true);
  assert.equal(ilk.body.unlimited, false);
  assert.equal(ilk.body.freePasses, 0);

  const ikinci = await request(app).post("/api/ai/pass").set("Authorization", `Bearer ${token}`);
  assert.equal(ikinci.status, 402);
  assert.equal(ikinci.body.upgrade, true);
});

test("sayaç eksiye düşmez (atomik azaltma)", async () => {
  const user = await makeUser({ freePasses: 0 });
  const token = await login(user.email);
  const res = await request(app).post("/api/ai/pass").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 402);
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { freePasses: true } });
  assert.equal(row.freePasses, 0);
});

test("üye kullanıcı sınırsız hak alır", async () => {
  const token = await login(member.email);
  const res = await request(app).post("/api/ai/pass").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.unlimited, true);
});

test("üye olmayan kullanıcı duvara paylaşamaz", async () => {
  const token = await login(guest.email);
  const res = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Deneme", summary: "Özet", promptBody: "Bu bir prompt metnidir." });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "member_only");
});

test("üye projeyi paylaşır ve duvarda görünür", async () => {
  const token = await login(member.email);
  const olustur = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Sesli Komut Robotu", summary: "Mikrofonla yön verilen araç.", promptBody: "Sesli komutla yön verilen bir robot istiyorum." });
  assert.equal(olustur.status, 201);
  assert.equal(olustur.body.project.title, "Sesli Komut Robotu");

  const duvar = await request(app).get("/api/wall");
  assert.ok(duvar.body.items.some((p) => p.title === "Sesli Komut Robotu"), "paylaşılan proje herkese açık duvarda olmalı");
});

test("başkasına ait kullanıcı klasöründeki görsel anahtarı reddedilir", async () => {
  const token = await login(member.email);
  const digeri = await makeUser({ member: true });
  const res = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Görsel Hırsızlığı",
      summary: "Özet",
      promptBody: "Yeterince uzun bir prompt metni.",
      images: [{ objectKey: `u/${digeri.id}/sahte.jpg` }]
    });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "invalid_image_key");
});

test("başlığı çok kısa olan proje reddedilir", async () => {
  const token = await login(member.email);
  const res = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "ab", summary: "Özet", promptBody: "Yeterince uzun bir prompt metni." });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "invalid_title");
});

test("başka bir üyenin projesine görsel URL'si istenemez", async () => {
  const diger = await makeUser({ member: true });
  const proj = await makeProject(diger.id);
  const token = await login(member.email);
  const res = await request(app)
    .post(`/api/projects/${proj.id}/images/presign`)
    .set("Authorization", `Bearer ${token}`)
    .send({ contentType: "image/png" });
  assert.equal(res.status, 404);
});