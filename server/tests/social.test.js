import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/index.js";
import { prisma } from "../src/db.js";
import { assertNoPromptLeak, makeProject, makeUser, resetDb } from "./setup.js";

const app = createApp();
let owner;
let fan;
let guest;
let project;

const login = async (email) => {
  const res = await request(app).post("/api/auth/login").send({ email, password: "test1234" });
  return res.body.token;
};

before(async () => {
  await resetDb();
  owner = await makeUser({ member: true, displayName: "Proje Sahibi" });
  fan = await makeUser({ member: true, displayName: "Hayran" });
  guest = await makeUser({ displayName: "Misafir" });
  project = await makeProject(owner.id, { title: "Gece Lambası" });
});
after(() => prisma.$disconnect());

/* ── beğeni ───────────────────────────────────────────────── */

test("beğeni yalnız üyeye açık; jetonsuz ve üyesiz istek reddedilir", async () => {
  const jetonsuz = await request(app).post(`/api/projects/${project.id}/like`);
  assert.equal(jetonsuz.status, 401);

  const uyesiz = await request(app)
    .post(`/api/projects/${project.id}/like`)
    .set("Authorization", `Bearer ${await login(guest.email)}`);
  assert.equal(uyesiz.status, 403);
});

test("beğeni ekle ve kaldır: sayaç güncellenir, ikinci ekleme ikiye katlamaz", async () => {
  const token = await login(fan.email);
  const ekle = await request(app).post(`/api/projects/${project.id}/like`).set("Authorization", `Bearer ${token}`);
  assert.equal(ekle.status, 200);
  assert.equal(ekle.body.liked, true);
  assert.equal(ekle.body.likeCount, 1);

  const tekrar = await request(app).post(`/api/projects/${project.id}/like`).set("Authorization", `Bearer ${token}`);
  assert.equal(tekrar.body.likeCount, 1, "aynı kullanıcı iki kez beğenemez");

  const duvar = await request(app).get("/api/wall");
  const item = duvar.body.items.find((i) => i.id === project.id);
  assert.equal(item.likeCount, 1, "beğeni sayısı herkese açık");
  assert.equal(item.likedByViewer, false, "anonim görüntüleyici hiçbir şeyi beğenmiş sayılmaz");

  const uyeli = await request(app).get("/api/wall").set("Authorization", `Bearer ${token}`);
  assert.equal(uyeli.body.items.find((i) => i.id === project.id).likedByViewer, true);

  const kaldir = await request(app).delete(`/api/projects/${project.id}/like`).set("Authorization", `Bearer ${token}`);
  assert.equal(kaldir.body.liked, false);
  assert.equal(kaldir.body.likeCount, 0);

  // Olmayan proje 404; olmayan beğeni silmek de 404 (sessizce sahte 200 değil).
  const yok = await request(app).post("/api/projects/boyle-biri-yok/like").set("Authorization", `Bearer ${token}`);
  assert.equal(yok.status, 404);
});

/* ── yorum ────────────────────────────────────────────────── */

test("yorum okumak herkese açık, yazmak üyelere açık", async () => {
  const anon = await request(app).get(`/api/projects/${project.id}/comments`);
  assert.equal(anon.status, 200);
  assert.deepEqual(anon.body.comments, []);
  assert.equal(anon.body.canComment, false, "anonim yorum yazamaz");

  const uyesiz = await request(app)
    .post(`/api/projects/${project.id}/comments`)
    .set("Authorization", `Bearer ${await login(guest.email)}`)
    .send({ body: "Bunu deneyeceğim" });
  assert.equal(uyesiz.status, 403);

  const token = await login(fan.email);
  const yaz = await request(app)
    .post(`/api/projects/${project.id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ body: "Harika iş!" });
  assert.equal(yaz.status, 201);
  assert.equal(yaz.body.comment.body, "Harika iş!");
  assert.equal(yaz.body.comment.isOwn, true);
  assert.equal(yaz.body.comment.author.handle, fan.handle);
  assert.equal(yaz.body.commentCount, 1);
});

test("yorum gövdesi doğrulanır: boş ve çok uzun reddedilir", async () => {
  const token = await login(fan.email);
  const bos = await request(app)
    .post(`/api/projects/${project.id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ body: "   " });
  assert.equal(bos.status, 400);
  assert.equal(bos.body.error, "empty_comment");

  const uzun = await request(app)
    .post(`/api/projects/${project.id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ body: "x".repeat(5000) });
  assert.equal(uzun.status, 201);
  assert.equal(uzun.body.comment.body.length, 1000, "gövde 1000 karakterle sınırlı");
});

test("yorum silme yalnız yazara veya proje sahibine açık", async () => {
  const yorum = await prisma.comment.create({
    data: { projectId: project.id, authorId: fan.id, body: "Silinecek yorum" }
  });
  const onceki = await prisma.comment.count({ where: { projectId: project.id } });
  const yabanci = await makeUser({ member: true });
  const yabanciToken = await login(yabanci.email);

  const red = await request(app)
    .delete(`/api/comments/${yorum.id}`)
    .set("Authorization", `Bearer ${yabanciToken}`);
  assert.equal(red.status, 403);

  const yazar = await request(app)
    .delete(`/api/comments/${yorum.id}`)
    .set("Authorization", `Bearer ${await login(fan.email)}`);
  assert.equal(yazar.status, 200);
  assert.equal(yazar.body.commentCount, onceki - 1, "sayaç silinen yorum kadar azalmalı");

  const sahipYorumu = await prisma.comment.create({
    data: { projectId: project.id, authorId: fan.id, body: "Sahibi de silebilmeli" }
  });
  const sahibi = await request(app)
    .delete(`/api/comments/${sahipYorumu.id}`)
    .set("Authorization", `Bearer ${await login(owner.email)}`);
  assert.equal(sahibi.status, 200, "proje sahibi yazarın yorumunu silebilmeli");
});

test("jetonsuz yorum silme 401", async () => {
  const yorum = await prisma.comment.create({
    data: { projectId: project.id, authorId: fan.id, body: "Kalacak" }
  });
  const res = await request(app).delete(`/api/comments/${yorum.id}`);
  assert.equal(res.status, 401);
});

test("yayınlanmamış projenin yorumları dışarıdan 404", async () => {
  const taslak = await makeProject(owner.id, { title: "Taslak", shared: false });
  const res = await request(app).get(`/api/projects/${taslak.id}/comments`);
  assert.equal(res.status, 404);
});

test("GİZLİ: yorum ve beğeni uçları prompt sızdırmaz", async () => {
  const yorumlar = await request(app).get(`/api/projects/${project.id}/comments`);
  assertNoPromptLeak(yorumlar.body);
  const duvar = await request(app).get("/api/wall");
  assertNoPromptLeak(duvar.body);
});