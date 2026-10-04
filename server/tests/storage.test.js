import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/index.js";
import { prisma } from "../src/db.js";
import { ensureBucket, imageContentTypeOk, newObjectKey, presignUpload, storageConfigured } from "../src/storage.js";
import { makeProject, makeUser, resetDb } from "./setup.js";

const app = createApp();
let member;

before(async () => {
  await resetDb();
  member = await makeUser({ member: true });
});
after(() => prisma.$disconnect());

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "test1234" });
  return res.body.token;
}

test("yalnız görsel içerik türleri kabul edilir", () => {
  assert.equal(imageContentTypeOk("image/png"), true);
  assert.equal(imageContentTypeOk("image/jpeg"), true);
  assert.equal(imageContentTypeOk("image/webp"), true);
  assert.equal(imageContentTypeOk("application/pdf"), false);
  assert.equal(imageContentTypeOk("text/html"), false);
  assert.equal(imageContentTypeOk(""), false);
});

test("nesne anahtarı kullanıcı klasörüyle başlar ve gün içinde benzersizdir", () => {
  const bir = newObjectKey("user-1", "proj-1", "image/png");
  const iki = newObjectKey("user-1", "proj-1", "image/png");
  assert.ok(bir.startsWith("u/user-1/proj-1/"), `anahtar yanlış: ${bir}`);
  assert.ok(bir.endsWith(".png"));
  assert.notEqual(bir, iki);
});

test("depolama yapılandırılmışsa presigned URL üretilir", async (t) => {
  if (!storageConfigured()) return t.skip("S3 değişkenleri yok");
  const bucket = await ensureBucket();
  assert.equal(bucket.ok, true, `bucket hazır olmalı: ${JSON.stringify(bucket)}`);
  const url = await presignUpload(newObjectKey(member.id, "p1", "image/webp"), "image/webp", 600);
  assert.ok(url, "presigned URL dönmeli");
  assert.match(url, /X-Amz-Signature=/);
});

test("presigned URL yalnız proje sahibine verilir ve png dışı reddedilir", async () => {
  const token = await login(member.email);
  const proje = await makeProject(member.id);

  const kotu = await request(app)
    .post(`/api/projects/${proje.id}/images/presign`)
    .set("Authorization", `Bearer ${token}`)
    .send({ contentType: "application/pdf" });
  assert.equal(kotu.status, 400);
  assert.equal(kotu.body.error, "unsupported_type");

  const jetonsuz = await request(app).post(`/api/projects/${proje.id}/images/presign`).send({ contentType: "image/png" });
  assert.equal(jetonsuz.status, 401);
});

test("paylaşılan proje görselleri herkese açık URL olarak döner", async (t) => {
  if (!storageConfigured()) return t.skip("S3 değişkenleri yok");
  const token = await login(member.email);
  const proje = await makeProject(member.id);
  const presign = await presignUpload(newObjectKey(member.id, proje.id, "image/png"), "image/png", 600);
  const objectKey = new URL(presign).pathname.split("/").slice(2).join("/");

  const olustur = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Görselli Proje",
      summary: "Özet",
      promptBody: "Bu prompt en az on karakter uzununda olmalı.",
      images: [{ objectKey, width: 800, height: 600 }]
    });
  assert.equal(olustur.status, 201);
  assert.equal(olustur.body.project.images.length, 1);
  assert.equal(olustur.body.project.images[0].width, 800);

  const duvar = await request(app).get("/api/wall");
  const item = duvar.body.items.find((p) => p.id === olustur.body.project.id);
  assert.ok(item, "görselli proje duvarda görünmeli");
  assert.ok(item.images[0].url, "görsel URL'i üretilmeli");
  assert.ok(item.images[0].url.includes(objectKey));
});
test("oluşturulmuş projeye görsel sonradan bağlanır", async (t) => {
  if (!storageConfigured()) return t.skip("S3 değişkenleri yok");
  const token = await login(member.email);
  const olustur = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Önce Görselsiz", summary: "Özet", promptBody: "Bu prompt en az on karakter uzununda olmalı.", images: [] });
  assert.equal(olustur.status, 201);
  const id = olustur.body.project.id;

  const presign = await request(app)
    .post(`/api/projects/${id}/images/presign`)
    .set("Authorization", `Bearer ${token}`)
    .send({ contentType: "image/png" });
  assert.equal(presign.status, 200);

  const put = await fetch(presign.body.url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: "sahte" });
  assert.ok(put.ok, `görsel yüklenmeliydi: HTTP ${put.status}`);

  const ekle = await request(app)
    .post(`/api/projects/${id}/images`)
    .set("Authorization", `Bearer ${token}`)
    .send({ objectKey: presign.body.objectKey });
  assert.equal(ekle.status, 201);
  assert.equal(ekle.body.project.images.length, 1);
  assert.ok(ekle.body.project.images[0].url.includes(presign.body.objectKey));
});

test("başkasının projesine görsel bağlanamaz", async () => {
  const diger = await makeUser({ member: true });
  const proje = await makeProject(diger.id);
  const token = await login(member.email);
  const res = await request(app)
    .post(`/api/projects/${proje.id}/images`)
    .set("Authorization", `Bearer ${token}`)
    .send({ objectKey: `u/${member.id}/sahte.png` });
  assert.equal(res.status, 404);
});
