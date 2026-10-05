import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/index.js";
import { prisma } from "../src/db.js";
import { makeProject, makeUser, resetDb } from "./setup.js";
import { foldTR, searchTextFor } from "../src/str.js";
import { parseSort } from "../src/routes/wall.js";

const app = createApp();
let owner;

const login = async (email, password = "test1234") => {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
};

/** Arama sonucunun başlıklarını verir. */
const basliklar = (r) => (r.body.items || []).map((i) => i.title);

before(async () => {
  await resetDb();
  owner = await makeUser({ member: true });
  // Arama için Türkçe harf farkı olan üç proje:
  // "Irmak", "Işık" ve "Şafak sensörü" → sırasıyla i/ı, ı/i, ş/s farkı.
  // Not: Aşağıdaki arama testleri bu dört projeye gönderme yapıyor. Veri
  // eksiği testleri sessizce "bulamadım" hatasına çevirir; her adı burada
  // üretmek zorundayız.
  await makeProject(owner.id, { title: "Irmak Seviye Ölçer", summary: "Su seviyesi ölçer." });
  await makeProject(owner.id, { title: "Işık Dedektörü", summary: "Ortam ışığını ölçer." });
  await makeProject(owner.id, { title: "Isı Dedektörü", summary: "Oda ısısını ölçer." });
  await makeProject(owner.id, { title: "Şafak Işığı", summary: "Gün doğumu alarmı." });
  await makeProject(owner.id, { title: "Gece Lambası", summary: "Karanlıkta yanar." });
  await makeProject(owner.id, { title: "Ses ve led", summary: "Tamamen farklı bir konu." });
});
after(() => prisma.$disconnect());

/* ── katlama ──────────────────────────────────────────────── */

test("foldTR Türkçe harfleri küçültür: I/ı/İ → i", () => {
  assert.equal(foldTR("Irmak"), "irmak");
  assert.equal(foldTR("ışık"), "isik");
  assert.equal(foldTR("İŞİK"), "isik");
  assert.equal(foldTR("ŞÜĞÜÖÇ"), "suguoc");
  // Katlanmayan harfler olduğu gibi kalır.
  assert.equal(foldTR("Arduino 2026"), "arduino 2026");
});

test("searchTextFor başlık ve özeti tek metinde birleştirir", () => {
  assert.equal(searchTextFor("Gece Lambası", "Karanlıkta yanar."), "gece lambasi karanlikta yanar.");
});

/* ── sıralama ─────────────────────────────────────────────── */

test("parseSort geçersiz değerden 'new' döner — istemci güvenilmezdir", () => {
  assert.equal(parseSort("top"), "top");
  assert.equal(parseSort("discussed"), "discussed");
  assert.equal(parseSort("yok-boyle-bir-siralama"), "new");
  assert.equal(parseSort(undefined), "new");
});

test("varsayılan sıralama en yeni paylaşılan", async () => {
  const res = await request(app).get("/api/wall");
  assert.equal(res.status, 200);
  assert.equal(res.body.sort, "new");
});

/* ── arama ────────────────────────────────────────────────── */

test("arama Türkçe harf duyarsız: 'irmak' → 'Irmak' kaydını bulur", async () => {
  const res = await request(app).get("/api/wall").query({ q: "irmak" });
  assert.equal(res.status, 200);
  assert.ok(basliklar(res).includes("Irmak Seviye Ölçer"), "Irmak bulunamadı: " + JSON.stringify(basliklar(res)));
  assert.ok(!basliklar(res).includes("Ses ve led"));
});

test("arama ters yönde de çalışır: 'ışık' → 'Işık Dedektörü'", async () => {
  // 'ışık' → 'isik', "Işık Dedektörü" → "isik dedektoru ...". Ters yön de
  // aynı sonucu verir: katlama sorgu tarafında da uygulanır.
  const kucuk = await request(app).get("/api/wall").query({ q: "ışık" });
  assert.ok(basliklar(kucuk).includes("Işık Dedektörü"), JSON.stringify(basliklar(kucuk)));
  const buyukHarf = await request(app).get("/api/wall").query({ q: "IŞIK" });
  assert.ok(basliklar(buyukHarf).includes("Işık Dedektörü"), JSON.stringify(basliklar(buyukHarf)));
  // Alt dizge: "Işığı" → "isigi", "ışı" → "isi" — ek almadan baştan eşleşir.
  const ekli = await request(app).get("/api/wall").query({ q: "ışı" });
  assert.ok(basliklar(ekli).includes("Şafak Işığı"), JSON.stringify(basliklar(ekli)));
  // "Isı Dedektörü" → "isi dedektoru": 'isik' alt dizgesi YOK.
  assert.ok(!basliklar(kucuk).includes("Isı Dedektörü"), JSON.stringify(basliklar(kucuk)));
  assert.ok(!basliklar(kucuk).includes("Irmak Seviye Ölçer"));
});

test("arama ş/Ş farkını yok sayar: 'şafak' → 'Şafak Işığı'", async () => {
  const res = await request(app).get("/api/wall").query({ q: "şafak" });
  const bas = basliklar(res);
  assert.ok(bas.includes("Şafak Işığı"), JSON.stringify(bas));
  assert.ok(!bas.includes("Gece Lambası"), JSON.stringify(bas));
});

test("arama ASCII/ Türkçe büyük harf farkını yok sayar: 'ISIK' = 'ışık'", async () => {
  const buyuk = await request(app).get("/api/wall").query({ q: "ISIK" });
  const bas = basliklar(buyuk);
  assert.ok(bas.includes("Işık Dedektörü"), JSON.stringify(bas));
  // Düz "I" ile yazılmış "Irmak" yalnız 'irmak' ile bulunur.
  const irmak = await request(app).get("/api/wall").query({ q: "IRMAK" });
  assert.ok(basliklar(irmak).includes("Irmak Seviye Ölçer"), JSON.stringify(basliklar(irmak)));
});

test("arama özet metninde de çalışır", async () => {
  const res = await request(app).get("/api/wall").query({ q: "karanlik" });
  assert.equal(res.status, 200); // "Gece Lambası" özeti "Karanlıkta yanar."
  assert.ok(basliklar(res).includes("Gece Lambası"), JSON.stringify(basliklar(res)));
});

test("bulunmayan arama boş liste döner, hata değil", async () => {
  const res = await request(app).get("/api/wall").query({ q: "bulunamayacak-bir-konu-zzz" });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.items, []);
  assert.equal(res.body.nextCursor, null);
});

test("arama + üyelik birlikte çalışır (prompt yine yalnız üyeye)", async () => {
  const jetonsuz = await request(app).get("/api/wall").query({ q: "irmak" });
  assert.equal(typeof jetonsuz.body.items[0].promptBody, "undefined");

  const uye = await request(app)
    .get("/api/wall")
    .query({ q: "irmak" })
    .set("Authorization", `Bearer ${await login(owner.email)}`);
  assert.equal(uye.body.items[0].promptBody, "GIZLI_PROMPT_METNI_12345");
});
