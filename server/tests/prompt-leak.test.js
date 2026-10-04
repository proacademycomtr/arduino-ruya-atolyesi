import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/index.js";
import { prisma } from "../src/db.js";
import { assertNoPromptLeak, makeProject, makeUser, resetDb } from "./setup.js";

const app = createApp();
let member;
let guest;
let project;

before(async () => {
  await resetDb();
  member = await makeUser({ member: true, displayName: "Usta Kurulu" });
  guest = await makeUser({ displayName: "Misafir" });
  project = await makeProject(member.id);
});
after(() => prisma.$disconnect());

test("GİZLİ: üye olmayan istek /api/wall yanıtında prompt yok", async () => {
  const res = await request(app).get("/api/wall");
  assert.equal(res.status, 200);
  assert.ok(res.body.items.length >= 1, "paylaşılmış proje herkese açık listede görünmeli");
  assertNoPromptLeak(res.body);
  const item = res.body.items.find((i) => i.id === project.id);
  assert.ok(item, "proje duvarda listelenmeli");
  assert.equal(item.title, project.title);
  assert.equal(item.owner.handle, member.handle);
});

test("GİZLİ: giriş yapmış ama üye olmayan kullanıcı da prompt görmez", async () => {
  const res = await request(app).get("/api/wall").set("Authorization", `Bearer ${guest.token}`);
  assert.equal(res.status, 200);
  assertNoPromptLeak(res.body);
});

test("GİZLİ: üye prompt'u görebilir (özellik çalışıyor olmalı)", async () => {
  const token = await request(app).post("/api/auth/login").send({ email: member.email, password: "test1234" });
  const res = await request(app).get("/api/wall").set("Authorization", `Bearer ${token.body.token}`);
  assert.equal(res.status, 200);
  const item = res.body.items.find((i) => i.id === project.id);
  assert.ok(item, "üye projeyi görmeli");
  assert.equal(item.promptBody, project.promptBody);
});

test("GİZLİ: proje detayı üye olmayana prompt vermez", async () => {
  const res = await request(app).get(`/api/projects/${project.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.project.title, project.title);
  assertNoPromptLeak(res.body);
});

test("GİZLİ: profil sayfası üye olmayana prompt vermez", async () => {
  const res = await request(app).get(`/api/users/${member.handle}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.handle, member.handle);
  assertNoPromptLeak(res.body);
});

test("GİZLİ: takip akışı üye olmayana kapalı", async () => {
  const res = await request(app).get("/api/feed/timeline");
  assert.equal(res.status, 401);
});

test("GİZLİ: yayınlanmamış proje dışarıdan 404 döner", async () => {
  const owner = await makeUser({ member: true });
  const gizli = await makeProject(owner.id, { title: "Çalışma Masası", shared: false });
  const res = await request(app).get(`/api/projects/${gizli.id}`);
  assert.equal(res.status, 404);
});

test("GİZLİ: yayınlanmamış projeyi sahibi kendi üyeliğiyle görebilir", async () => {
  const owner = await makeUser({ member: true });
  const gizli = await makeProject(owner.id, { title: "Çalışma Masası", shared: false });
  const login = await request(app).post("/api/auth/login").send({ email: owner.email, password: "test1234" });
  const res = await request(app).get(`/api/projects/${gizli.id}`).set("Authorization", `Bearer ${login.body.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.project.promptBody, gizli.promptBody);
});

test("GİZLİ: üye olmayan kullanıcının profili yalnız paylaşılmış projeleri gösterir", async () => {
  const owner = await makeUser({ member: true });
  await makeProject(owner.id, { title: "Paylaşılan", shared: true });
  await makeProject(owner.id, { title: "Taslak", shared: false });
  const res = await request(app).get(`/api/users/${owner.handle}`);
  assert.equal(res.status, 200);
  const basliklar = res.body.projects.map((p) => p.title).sort();
  assert.deepEqual(basliklar, ["Paylaşılan"]);
});