import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/index.js";
import { prisma } from "../src/db.js";
import { makeProject, makeUser, resetDb } from "./setup.js";

const app = createApp();
let owner;
let admin;
let guest;
let project;

const login = async (u) => {
  const res = await request(app).post("/api/auth/login").send({ email: u.email, password: "test1234" });
  return res.body.token;
};
// Token'ı bir kez alıp saklıyoruz: `login` async olduğu için senkron bir
// yardımcıda çağrılırsa başlığa "[object Promise]" yazılır ve her istek 401
// döner — sessiz ve çok yanıltıcı bir hata.
const TOKENS = new Map();
const auth = (u) => ({ Authorization: `Bearer ${TOKENS.get(u.handle)}` });

const yorumEkle = (p, u, body) =>
  request(app)
    .post(`/api/projects/${p}/comments`)
    .set(auth(u))
    .send({ body })
    .then((r) => r.body.comment.id);

before(async () => {
  await resetDb();
  owner = await makeUser({ member: true, displayName: "Sahip" });
  admin = await makeUser({ member: true, admin: true, displayName: "Yönetici" });
  guest = await makeUser({ member: true, displayName: "Üye" });
  project = await makeProject(owner.id, { title: "Gece Lambası" });
  for (const u of [owner, admin, guest]) TOKENS.set(u.handle, await login(u));
});
after(() => prisma.$disconnect());

/* ── yorum gizleme ────────────────────────────────────────── */

test("yazar kendi yorumunu gizleyebilir, gizli yorum listeden düşer", async () => {
  const id = await yorumEkle(project.id, guest, "Gizlenecek yorum");
  const once = await request(app).get(`/api/projects/${project.id}/comments`);
  assert.equal(once.body.comments.length, 1);

  const gizle = await request(app).patch(`/api/comments/${id}`).set(auth(guest)).send({ hidden: true });
  assert.equal(gizle.status, 200);
  assert.equal(gizle.body.comment.hiddenAt !== null, true);
  // Yazar moderatör değil → yalnız kendisi için gizler, geri açabilir.
  assert.equal(gizle.body.canHide, false);
  assert.equal(gizle.body.commentCount, 0);

  const sonra = await request(app).get(`/api/projects/${project.id}/comments`);
  assert.equal(sonra.body.comments.length, 0);
});

test("proje sahibi yorumu gizleyebilir (canHide=true)", async () => {
  const id = await yorumEkle(project.id, guest, "Sahibi gizleyebilir");
  const res = await request(app).patch(`/api/comments/${id}`).set(auth(owner)).send({ hidden: true });
  assert.equal(res.status, 200);
  assert.equal(res.body.canHide, true);
  // Geri açılabilir olmalı.
  const geri = await request(app).patch(`/api/comments/${id}`).set(auth(owner)).send({ hidden: false });
  assert.equal(geri.body.comment.hiddenAt, null);
  assert.equal(geri.body.commentCount, 1);
});

test("yönetici yorumu gizleyip geri açabilir", async () => {
  const id = await yorumEkle(project.id, guest, "Yönetici gizler");
  const gizle = await request(app).patch(`/api/comments/${id}`).set(auth(admin)).send({ hidden: true });
  assert.equal(gizle.status, 200);
  assert.equal(gizle.body.canHide, true);
  await request(app).patch(`/api/comments/${id}`).set(auth(admin)).send({ hidden: false });
});

test("ilgisiz üçüncü kişi yorumu gizleyemez", async () => {
  const id = await yorumEkle(project.id, guest, "Korumalı yorum");
  const yabanci = await request(app).patch(`/api/comments/${id}`).set(auth(admin)).send({ hidden: true });
  assert.equal(yabanci.status, 200); // yönetici
  const uye = await makeUser({ member: true, displayName: "Bambaşka Üye" });
  TOKENS.set(uye.handle, await login(uye));
  const red = await request(app).patch(`/api/comments/${id}`).set(auth(uye)).send({ hidden: true });
  assert.equal(red.status, 403);
  await request(app).patch(`/api/comments/${id}`).set(auth(admin)).send({ hidden: false });
});

test("jetonsuz yorum gizleme isteği 401", async () => {
  const id = await yorumEkle(project.id, guest, "Jetonsuz deneme");
  const res = await request(app).patch(`/api/comments/${id}`).send({ hidden: true });
  assert.equal(res.status, 401);
  await request(app).patch(`/api/comments/${id}`).set(auth(admin)).send({ hidden: true });
  await request(app).patch(`/api/comments/${id}`).set(auth(admin)).send({ hidden: false });
});

test("gizli yorumlar duvar kartındaki sayaca girmez", async () => {
  const p = await makeProject(owner.id, { title: "Sayaç Projesi" });
  const id = await yorumEkle(p.id, guest, "sayaca girmez");
  const once = await request(app).get("/api/wall");
  const kart = once.body.items.find((i) => i.id === p.id);
  assert.equal(kart.commentCount, 1);
  await request(app).patch(`/api/comments/${id}`).set(auth(admin)).send({ hidden: true });
  const duvar = await request(app).get("/api/wall");
  assert.equal(duvar.body.items.find((i) => i.id === p.id).commentCount, 0);
});

/* ── projeyi gizleme ve duvardan kaldırma ──────────────────── */

test("yönetici projeyi gizler → duvardan düşer, geri açılır", async () => {
  const p = await makeProject(owner.id, { title: "Gizlenecek Proje" });
  assert.ok((await request(app).get("/api/wall")).body.items.some((i) => i.id === p.id));

  const gizle = await request(app).patch(`/api/projects/${p.id}/moderation`).set(auth(admin)).send({ hidden: true });
  assert.equal(gizle.status, 200);
  assert.ok(!(await request(app).get("/api/wall")).body.items.some((i) => i.id === p.id));
  // Gizli proje jetonsuz açılamaz.
  assert.equal((await request(app).get(`/api/projects/${p.id}`)).status, 404);
  // Sahibi görebilir.
  assert.equal((await request(app).get(`/api/projects/${p.id}`).set(auth(owner))).status, 200);

  const ac = await request(app).patch(`/api/projects/${p.id}/moderation`).set(auth(admin)).send({ hidden: false });
  assert.equal(ac.status, 200);
  assert.ok((await request(app).get("/api/wall")).body.items.some((i) => i.id === p.id));
});

test("projeyi gizleme yalnız yöneticiye açık", async () => {
  const p = await makeProject(owner.id, { title: "Yetkisiz Gizleme" });
  const uye = await request(app).patch(`/api/projects/${p.id}/moderation`).set(auth(guest)).send({ hidden: true });
  assert.equal(uye.status, 403);
  const sahip = await request(app).patch(`/api/projects/${p.id}/moderation`).set(auth(owner)).send({ hidden: true });
  assert.equal(sahip.status, 403);
  assert.equal((await request(app).get(`/api/projects/${p.id}/moderation`)).status, 404);
});

test("sahibi projesini duvardan kaldırır (kayıt silinmez)", async () => {
  const p = await makeProject(owner.id, { title: "Kaldırılacak" });
  const kaldir = await request(app).delete(`/api/projects/${p.id}/share`).set(auth(owner));
  assert.equal(kaldir.status, 200);
  assert.equal(kaldir.body.isShared, false);
  assert.ok(!(await request(app).get("/api/wall")).body.items.some((i) => i.id === p.id));
  // Kayıt duruyor ve sahibi erişebiliyor.
  assert.equal((await request(app).get(`/api/projects/${p.id}`).set(auth(owner))).status, 200);
  // İkinci kez kaldırmak hata değil.
  const tekrar = await request(app).delete(`/api/projects/${p.id}/share`).set(auth(owner));
  assert.equal(tekrar.body.already, true);
});

test("başkasının projesini duvardan kaldıramaz", async () => {
  const p = await makeProject(owner.id, { title: "Sahipsiz Kaldırma" });
  const res = await request(app).delete(`/api/projects/${p.id}/share`).set(auth(guest));
  assert.equal(res.status, 404);
  assert.equal((await request(app).delete(`/api/projects/${p.id}/share`)).status, 401);
});

/* ── şikâyet (raporlama) ───────────────────────────────────── */

test("üye yorumu şikâyet edebilir", async () => {
  const id = await yorumEkle(project.id, guest, "Şikâyet edilecek yorum");
  const res = await request(app)
    .post("/api/reports")
    .set(auth(owner))
    .send({ targetType: "COMMENT", targetId: id, reason: "SPAM", details: "reklam" });
  assert.equal(res.status, 201);
  assert.equal(res.body.report.status, "OPEN");
});

test("aynı hedef iki kez şikâyet edilemez", async () => {
  const id = await yorumEkle(project.id, guest, "Çift şikâyet");
  const ilk = await request(app)
    .post("/api/reports")
    .set(auth(owner))
    .send({ targetType: "COMMENT", targetId: id, reason: "SPAM" });
  assert.equal(ilk.status, 201);
  const ikinci = await request(app)
    .post("/api/reports")
    .set(auth(owner))
    .send({ targetType: "COMMENT", targetId: id, reason: "SPAM" });
  assert.equal(ikinci.status, 409);
});

test("şikâyet yalnız üyeye açık", async () => {
  const p2 = await makeProject(owner.id, { title: "Üyesiz Şikâyet" });
  const jetonsuz = await request(app)
    .post("/api/reports")
    .send({ targetType: "PROJECT", targetId: p2.id, reason: "SPAM" });
  assert.equal(jetonsuz.status, 401);
  const uyesiz = await makeUser({ displayName: "Üyesiz" });
  TOKENS.set(uyesiz.handle, await login(uyesiz));
  const res = await request(app)
    .post("/api/reports")
    .set(auth(uyesiz))
    .send({ targetType: "PROJECT", targetId: p2.id, reason: "SPAM" });
  assert.equal(res.status, 403);
});

test("geçersiz hedef türü ve gerekçe reddedilir", async () => {
  const kotuHedef = await request(app)
    .post("/api/reports")
    .set(auth(owner))
    .send({ targetType: "SUNUCU", targetId: "x", reason: "SPAM" });
  assert.equal(kotuHedef.status, 400);
  const kotuSebep = await request(app)
    .post("/api/reports")
    .set(auth(owner))
    .send({ targetType: "PROJECT", targetId: project.id, reason: "SEBEP_YOK" });
  assert.equal(kotuSebep.status, 400);
});

test("olmayan hedef 404 — hayalet şikâyet açılamaz", async () => {
  const res = await request(app)
    .post("/api/reports")
    .set(auth(owner))
    .send({ targetType: "COMMENT", targetId: "yok-boyle-bir-yorum", reason: "SPAM" });
  assert.equal(res.status, 404);
});

test("kullanıcı handle ile şikâyet edilir, kendini şikâyet edemezsin", async () => {
  const res = await request(app)
    .post("/api/reports")
    .set(auth(guest))
    .send({ targetType: "USER", targetId: owner.handle.toUpperCase(), reason: "HARASSMENT" });
  assert.equal(res.status, 201);
  // Büyük harf normalleşti: aynı kişi iki kez bildirilemez.
  const tekrar = await request(app)
    .post("/api/reports")
    .set(auth(guest))
    .send({ targetType: "USER", targetId: owner.handle, reason: "HARASSMENT" });
  assert.equal(tekrar.status, 409);

  const kendi = await request(app)
    .post("/api/reports")
    .set(auth(guest))
    .send({ targetType: "USER", targetId: guest.handle, reason: "SPAM" });
  assert.equal(kendi.status, 400);
});

test("şikâyet listesi ve kapatma yalnız yöneticiye açık", async () => {
  assert.equal((await request(app).get("/api/reports")).status, 401);
  const uye = await request(app).get("/api/reports").set(auth(guest));
  assert.equal(uye.status, 403);
  const jetonsuz = await request(app).patch("/api/reports/yok").send({ status: "RESOLVED" });
  assert.equal(jetonsuz.status, 401);

  const liste = await request(app).get("/api/reports").set(auth(admin));
  assert.equal(liste.status, 200);
  assert.ok(liste.body.reports.length > 0);
  assert.ok(liste.body.counts.open > 0);
  // Bildiren kişinin handle'ı görünür (kimin bildirdiği belli olmalı).
  assert.ok(liste.body.reports[0].reporter.handle);

  const id = liste.body.reports[0].id;
  const coz = await request(app).patch(`/api/reports/${id}`).set(auth(admin)).send({ status: "RESOLVED" });
  assert.equal(coz.status, 200);
  assert.equal(coz.body.report.status, "RESOLVED");
  assert.equal(coz.body.report.resolvedBy.handle, admin.handle);

  const kotu = await request(app).patch(`/api/reports/${id}`).set(auth(admin)).send({ status: "KAPANDI" });
  assert.equal(kotu.status, 400);
  const yok = await request(app).patch("/api/reports/yok-boyle-bir-kayit").set(auth(admin)).send({ status: "RESOLVED" });
  assert.equal(yok.status, 404);
});
