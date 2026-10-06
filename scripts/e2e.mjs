#!/usr/bin/env node
/* ── Arduino Rüya Atölyesi — uçtan uca tarayıcı testleri (Playwright) ──
   Çalıştırma: node scripts/e2e.mjs [url] [--only 12,6] [--list]
   - URL verilmezse dist/index.html file:// ile açılır.
   - --only 12,6   yalnızca belirtilen senaryoları koşar (aralık: --only 9-12)
   - --list        senaryo kimliklerini listeler, koşmaz
   - Her senaryo KENDİ browser context'inde, temiz localStorage ve sıfır
     modül durumuyla koşar → senaryolar birbirinden ve sıralamadan bağımsızdır.
     (Eskiden arşiv arama filtresi gibi modül seviyesi kalıntılar bir sonraki
      senaryoyu bozuyordu.)
   - Senaryolar: rehber üretimi + fiyat tablosu, sıralama, bütçe uyarısı,
     sertifika akışı, adet override kalıcılığı, canlı ipucu, panel arama +
     sayfalama, CSV tarih filtresi, arşiv arama, çoklu sınıf seçici + grafik,
     sınıf karşılaştırma, öğrenci zaman çizelgesi, arşiv mini önizleme,
     rapor sınıf turları.

   v3.1.0: Bu dosya bir modül olarak da dışa açılır; tests/e2e.test.js
   senaryoları node --test içinde koşturur (birim + tarayıcı tek komut). */

import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

/* --only / --list bayraklarını ayrıştır; ilk konumsal argüman URL'dir. */
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv.splice(i, 2)[1]; };
const listOnly = argv.includes("--list") && argv.splice(argv.indexOf("--list"), 1).length === 1;
const onlyArg = flag("--only");

/* Verilen URL yoksa DEMO derlemesini üret (API adresi boş). Menü kilitleri
   kapandığında bölümlerin açılabilmesi gerekiyor; dist daha önce API_BASE'li
   derlenmişse (yerel doğrulama sonrası) senaryolar kilitli menülere tıklayıp
   kırılır. Bu yüzden test kendi derlemesini yapar — ortamdan bağımsız olur. */
let target = argv[0];
if (!target) {
  try {
    execFileSync("python3", ["build.py"], { cwd: resolve(process.cwd()), stdio: "pipe" });
  } catch (e) {
    console.warn("UYARI: build.py çalışmadı, mevcut dist kullanılıyor:", e.message);
  }
  target = pathToFileURL(resolve(process.cwd(), "dist/index.html")).href;
}

/** --only 12 / 6,7 / 9-12 → çalıştırılacak kimlik listesi (null = hepsi). */
function parseOnly(spec) {
  if (!spec) return null;
  const ids = new Set();
  for (const part of String(spec).split(",")) {
    const p = part.trim();
    if (!p) continue;
    const range = p.match(/^(\d+)-(\d+)$/);
    if (range) {
      for (let n = Number(range[1]); n <= Number(range[2]); n++) ids.add(String(n));
    } else ids.add(p);
  }
  return ids;
}

const results = [];
/** Kontrol kaydeder. node --test modunda `t` verilirse test içine de raporlanır. */
const ok = (name, cond, extra = "", t) => {
  results.push({ name, pass: !!cond, extra });
  console.log((cond ? "✅" : "❌") + " " + name + (extra ? ` — ${extra}` : ""));
  if (t) t.diagnostic((cond ? "  ✓ " : "  ✗ ") + name + (extra ? ` — ${extra}` : ""));
};

/* ── Ortak veri kurulum yardımcıları ── */

const DAY = 86400000;

/** Bir gönderi kaydı üretir. steps değerleri gerçek zaman damgası olabilir. */
const sub = (student, project, o = {}) => ({
  student,
  project,
  total: o.total ?? 2,
  steps: o.steps ?? { 0: 1 },
  ts: o.ts ?? Date.now() - DAY,
  ...(o.classCode ? { classCode: o.classCode } : {}),
  materials: o.materials ?? [],
});

/** localStorage'a yazar; string verilmezse JSON olarak saklar. */
const setStore = (page, key, value) =>
  page.evaluate(([k, v]) => localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)), [key, value]);

const iso = (ts) => {
  const d = new Date(ts);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

/** Sınıf gönderilerini "Öğrenci|Proje" anahtarlı haritaya çevirip saklar. */
const seedClassroom = (page, submissions, { code = "7A", activeClass = null } = {}) =>
  page.evaluate(([subs, clsCode, active]) => {
    const map = {};
    for (const s of subs) map[`${s.student}|${s.project}`] = s;
    localStorage.setItem("arduinoDreamLab.classroom.v1", JSON.stringify({ code: clsCode, submissions: map }));
    if (active !== null) localStorage.setItem("arduinoDreamLab.activeClass.v1", active);
  }, [submissions, code, activeClass]);

/** Arşiv kayıtlarını saklar (her kayıt rehber alanlarını içerir). */
const seedArchive = (page, items) =>
  page.evaluate((v) => localStorage.setItem("arduinoDreamLab.archive.v1", JSON.stringify(v)), items);

/** window.open yerine sahte pencere döndürür; çağrılan HTML'i __repHtml'e yazar. */
const stubWindowOpen = (page) =>
  page.evaluate(() => {
    window.__repHtml = "";
    window.open = () => ({ document: { write: (h) => { window.__repHtml = h; }, close: () => {} } });
  });

/** Testin değişken girdisi + üretim (demo yolu anında, ~2 sn üst sınır). */
const generate = async (page, idea = "LCD'li dijital saat") => {
  await page.fill("#ideaInput", idea);
  await page.click("#generateBtn");
  await page.waitForSelector(".materials-table .cost-total", { timeout: 20000 });
};

/**
 * v4.4.0: Menü artık başlıktaki ayrı bir hamburger panelinde duruyor.
 * Menü öğelerine tıklamadan önce paneli açmazsan eleman DOM'da var ama
 * görünmez → Playwright tıklama zaman aşımına düşüyor.
 */
const openMenu = async (page) => {
  // v4.4.0: Menü GÖRÜNÜRLÜĞÜ girişe bağlı, yani ziyaretçide (ve demo
  // derlemede) hamburger gizli. Bu senaryolar panellerin İŞLEVİNİ
  // ölçtüğü için önce görünür olma izni veriyoruz; erişim izni ayrı ve
  // demo derlemede zaten açık (`canUseApp`).
  await page.evaluate(() => {
    const t = document.getElementById("menuToggle");
    if (t) t.hidden = false;
  });
  const toggle = await page.$("#menuToggle");
  if (!toggle) return;
  if ((await toggle.getAttribute("aria-expanded")) === "true") return;
  await page.click("#menuToggle");
  await page.waitForSelector("#archiveBtn:visible", { timeout: 5000 }).catch(() => {});
};

/** Paneli açıp verilen menü düğmesine tıklar (panel tıklama sonrası kapanır). */
const clickMenu = async (page, selector) => {
  await openMenu(page);
  await page.click(selector);
};

/** Sınıf panelini açar (panel açılışında localStorage okunur). */
const openClassroom = async (page, sel = "#subList .archive-item") => {
  await clickMenu(page, "#classBtn");
  await page.waitForSelector(sel);
};

const closeClassroom = async (page) => {
  await page.click("#classCloseBtn");
  await page.waitForTimeout(300);
};

/* Senaryo kayıt defteri: aşağıdaki tanimlar sırayla buraya eklenir, sonra
   --only seçimine göre koşulur. */
/* Tarayıcı tembel başlatılır: modül olarak import edildiğinde (node --test)
   require()'ın top-level await'a takılmaması için import anında açılmaz. */
let _browserPromise = null;
const getBrowser = () => (_browserPromise ||= chromium.launch());
export const closeBrowser = async () => {
  if (_browserPromise) { const b = await _browserPromise; await b.close(); _browserPromise = null; }
};

const REGISTRY = [];

/** Senaryo kaydeder (koşmaz). */
function scenario(id, fn) { REGISTRY.push({ id, fn }); }

/**
 * Bir senaryoyu koşar: yepyeni context, localStorage temizliği ve sayfa
 * yenilemesi (modül durumu sıfırlanır). Hata olursa yalnızca o senaryo
 * başarısız olur, diğerleri koşmaya devam eder.
 * `t` verilirse (node --test) o senaryonun TestContext'i olarak kullanılır.
 */
async function runScenario({ id, fn }, t) {
  const browser = await getBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const before = results.length;
  try {
    await page.goto(target, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#ideaInput");
    await fn(page);
  } catch (e) {
    ok(id + " — AKIŞ", false, e.message, t);
  } finally {
    await ctx.close();
  }
  // Bu senaryodaki başarısız kontrolleri node --test'e de bildir
  const failedHere = results.slice(before).filter((r) => !r.pass);
  if (t && failedHere.length) {
    throw new Error(`${failedHere.length} kontrol başarısız: ` + failedHere.map((r) => r.name).join("; "));
  }
}

/* ── 1) Rehber üretimi + fiyat tablosu + sıralama döngüsü ── */
scenario("1-2", async (page) => {
  await generate(page);
  const headers = await page.$$eval(".materials-table thead th", (ths) => ths.map((t) => t.textContent.trim()));
  ok("1a. fiyat tablosu 5 sütunlu", headers.join("|").includes("Birim Fiyat") && headers.join("|").includes("Tutar"), headers.join(" / "));
  const totalTxt = await page.$eval(".cost-total td:nth-child(4)", (t) => t.textContent.trim());
  ok("1b. toplam ₺+çift gösterim", /^\d+\.\d{2}₺ \(\$\d+\.\d{2}\)$/.test(totalTxt), totalTxt);

  const names = () => page.$$eval(".materials-table tbody tr:not(.cost-total) td:first-child", (tds) => tds.map((t) => t.textContent.trim()));
  const before = await names();
  await page.click(".th-sort-btn");
  const desc = await names();
  await page.click(".th-sort-btn");
  const asc = await names();
  await page.click(".th-sort-btn");
  const back = await names();
  ok("2a. desc: ilk satır en pahalı", desc[0].includes("Arduino Uno"), desc.join(" > "));
  ok("2b. asc: ilk satır en ucuz", asc[0].includes("Breadboard") || asc[0].includes("LCD"), asc.join(" > "));
  ok("2c. üçüncü tık orijinal sıra", JSON.stringify(back) === JSON.stringify(before));
});

/* ── 2) Bütçe uyarısı ── */
scenario("3", async (page) => {
  await setStore(page, "arduinoDreamLab.budget.v1", "15");
  await generate(page);
  await page.waitForSelector(".cost-over", { timeout: 10000 }).catch(() => {});
  const overRow = await page.$(".cost-over");
  const overText = overRow ? await overRow.$eval("td:nth-child(5)", (t) => t.textContent) : "";
  ok("3. bütçe aşımı uyarısı", !!overRow && overText.includes("Bütçe aşımı"), overText.trim().slice(0, 60));
});

/* ── 3) Sertifika akışı (rozet kaydı) ── */
scenario("4", async (page) => {
  await page.evaluate(() => { window.open = () => null; }); // popup engelle
  await generate(page);
  await page.$$eval(".step-check", (cbs) => cbs.forEach((c) => { if (!c.checked) c.click(); }));
  await page.waitForSelector("#certRow:not([hidden])", { state: "attached" });
  await page.fill("#certNameInput", "E2E Öğrenci");
  await page.click('[data-act="cert"]');
  await page.waitForFunction(() => !!localStorage.getItem("arduinoDreamLab.badges.v1"), null, { timeout: 10000 });
  const badges = await page.evaluate(() => JSON.parse(localStorage.getItem("arduinoDreamLab.badges.v1") || "[]"));
  ok("4. sertifika → rozet kaydı", badges.length === 1 && badges[0].type === "cert" && !!badges[0].guide, badges.length + " rozet");
});

/* ── 4) Adet override kalıcılığı ── */
scenario("5", async (page) => {
  await generate(page);
  await page.click('.qty-btn[data-qdir="1"]');
  await page.waitForTimeout(300);
  const unoVal = await page.$eval(".qty-input", (i) => i.value);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("arduinoDreamLab.costQty.v1") || "{}"));
  const totalAfter = await page.$eval(".cost-total td:nth-child(4)", (t) => t.textContent.trim());
  ok("5a. + düğmesi adedi 2 yaptı", unoVal === "2", "input=" + unoVal);
  ok("5b. override localStorage'da", stored["Arduino Uno"] === "2", JSON.stringify(stored));
  // Toplam +10$ artmış olmalı (2×Uno): $16.00 + $8.00 = $24.00
  ok("5c. toplam güncellendi (2×Uno)", totalAfter.endsWith("($24.00)"), totalAfter);
});

/* ── 5) Canlı maliyet ipucu (senkron demo yolu) ── */
scenario("ipucu", async (page) => {
  await page.fill("#ideaInput", "Odam için sıcaklığı ölçüp lamba yakan otomatik bir gece lambası istiyorum");
  await page.waitForTimeout(900);
  const hint = await page.$eval("#costHint", (e) => e.textContent);
  ok("+ canlı ipucu (demo şablonu)", hint.includes("≈"), hint);
});

/* ── 6) Panel arama + sayfalama + alışveriş listesi düğmesi ── */
scenario("6", async (page) => {
  const subs = [];
  for (let i = 1; i <= 8; i++) {
    subs.push(sub(`Öğrenci ${i}`, `Proje ${i}`, { total: 3, ts: Date.now() - i * DAY }));
  }
  await seedClassroom(page, subs, { code: "E2E-19" });
  await openClassroom(page);
  const perPage = (await page.$$("#subList .archive-item")).length;
  ok("6a. sayfa başına 6 gönderi + sayfalayıcı", perPage === 6 && !!(await page.$("#subList .pager")), perPage + " satır");
  await page.fill("#subSearch", "ogrenci 7");
  await page.waitForTimeout(300);
  const filtered = (await page.$$("#subList .archive-item")).length;
  ok("6b. arama Türkçe harf duyarsız", filtered === 1, filtered + " eşleşme");
  await page.fill("#subSearch", "");
  await page.waitForTimeout(300);
  await page.click('#subList [data-pg="2"]');
  await page.waitForTimeout(300);
  const page2 = (await page.$$("#subList .archive-item")).length;
  ok("6c. 2. sayfada kalan 2 gönderi", page2 === 2, page2 + " satır");
  // Satırdaki gerçek aksiyonlar: geri bildirim, zaman çizelgesi, sil.
  // (data-act="cart" yalnızca ana rehber görünümünde var; gönderi satırında değil.)
  const rowActs = await page.$$eval("#subList .archive-item", (items) => items.map((it) => ({
    fb: !!it.querySelector("[data-fbdl]"),
    tl: !!it.querySelector("[data-tl]"),
    del: !!it.querySelector("[data-delsub]"),
  })));
  ok("6d. satır aksiyonları: geri bildirim + ⏱️ + sil", rowActs.length > 0 && rowActs.every((r) => r.fb && r.tl && r.del), rowActs.length + " satırda 3/3");
});

/* ── 7) CSV tarih filtresi gönderi listesini süzer ── */
scenario("7", async (page) => {
  const subs = [
    sub("Eski Öğrenci", "Proje A", { ts: Date.now() - 40 * DAY }),
    sub("Yeni Öğrenci", "Proje B", { ts: Date.now() - DAY }),
  ];
  await seedClassroom(page, subs, { code: "E2E-20" });
  await setStore(page, "arduinoDreamLab.csvRange.v1", { from: iso(Date.now() - 7 * DAY), to: "" });
  await openClassroom(page);
  const fSubs = (await page.$$("#subList .archive-item")).length;
  ok("7a. tarih filtresi 1 gönderiye düşürür", fSubs === 1, fSubs + " satır");
  await page.click("#csvRangeClear");
  await page.waitForTimeout(300);
  const cSubs = (await page.$$("#subList .archive-item")).length;
  ok("7b. filtre temizle → tüm gönderiler", cSubs === 2, cSubs + " satır");
});

/* ── 8) Arşiv arama — başlık/etikette Türkçe duyarsız süzme ── */
scenario("8", async (page) => {
  await seedArchive(page, [
    { id: 1, ts: 1, idea: "otomatik sulama", guide: { title: "Akıllı Saksı", code: "a", difficulty: "Orta", materials: [] } },
    { id: 2, ts: 2, idea: "", guide: { title: "Gece Lambası", code: "b", difficulty: "Kolay", materials: [] }, meta: { fav: true, tags: ["veli"] } },
  ]);
  await clickMenu(page, "#archiveBtn");
  await page.waitForSelector("#archSearch");
  const allItems = (await page.$$("#archGrid .archive-item")).length;
  await page.fill("#archSearch", "saksi");
  await page.waitForTimeout(300);
  const searched = (await page.$$("#archGrid .archive-item")).length;
  const firstTitle = await page.$eval("#archGrid .archive-item h4", (h) => h.textContent.trim());
  ok("8a. arama Türkçe duyarsız (saksi→Akıllı Saksı)", allItems === 2 && searched === 1 && firstTitle.includes("Akıllı Saksı"), allItems + "→" + searched + " | " + firstTitle);
  await page.fill("#archSearch", "veli");
  await page.waitForTimeout(300);
  const byTag = (await page.$$("#archGrid .archive-item")).length;
  ok("8b. etikette arama", byTag === 1, byTag + " eşleşme");
});

/* ── 9) Çoklu sınıf seçici + panel haftalık grafiği ── */
scenario("9", async (page) => {
  const subs = [
    sub("A", "P1", { classCode: "7A", ts: Date.now() - DAY }),
    sub("B", "P2", { classCode: "8B", ts: Date.now() - 2 * DAY }),
  ];
  await seedClassroom(page, subs, { code: "7A", activeClass: "" });
  await setStore(page, "arduinoDreamLab.csvRange.v1", { from: iso(Date.now() - 14 * DAY), to: "" });
  await openClassroom(page, "#activeClassSel");
  const allRows = (await page.$$("#subList .archive-item")).length;
  const chartSvg = await page.$("#classBody svg[aria-label='weekly steps']");
  ok("9a. tüm sınıflar: 2 gönderi + canlı grafik", allRows === 2 && !!chartSvg, allRows + " satır, svg=" + !!chartSvg);
  await page.selectOption("#activeClassSel", "8B");
  await page.waitForTimeout(400);
  const b8Rows = (await page.$$("#subList .archive-item")).length;
  const firstStudent = await page.$eval("#subList .archive-item h4", (h) => h.textContent.trim());
  ok("9b. 8B seçili: sadece B görünür", b8Rows === 1 && firstStudent.includes("B"), b8Rows + " satır | " + firstStudent);
});

/* ── 10) Sınıf karşılaştırma kartı ── */
scenario("10", async (page) => {
  const subs = [
    sub("A", "P1", { total: 4, steps: { 0: 1, 1: 1 }, classCode: "7A", ts: Date.now() - DAY }),
    sub("B", "P2", { total: 4, steps: { 0: 1 }, classCode: "7A", ts: Date.now() - 2 * DAY }),
    sub("C", "P3", { total: 4, steps: { 0: 1, 1: 1, 2: 1 }, classCode: "8B", ts: Date.now() - DAY }),
  ];
  await seedClassroom(page, subs, { code: "7A", activeClass: "" });
  await openClassroom(page, "#cmpTable .cmp-table");
  const cmpHeads = await page.$$eval("#cmpTable thead th", (ths) => ths.map((t) => t.textContent.trim()));
  ok("10a. karşılaştırma: iki sınıf başlığı", cmpHeads.join("|").includes("7A") && cmpHeads.join("|").includes("8B"), cmpHeads.join(" / "));
  const winCells = (await page.$$("#cmpTable td.cmp-win")).length;
  ok("10b. kazanan hücre vurgusu var", winCells >= 1, winCells + " vurgulu hücre");
  await page.selectOption("#cmpSelB", "8B");
  await page.waitForTimeout(250);
  const cmpRows = await page.$$eval("#cmpTable tbody tr th", (ths) => ths.map((t) => t.textContent.trim()));
  ok("10c. 5 metrik satırı (öğrenci…en aktif hafta)", cmpRows.length === 5, cmpRows.join(" | "));
  const barRows = (await page.$$("#cmpBars .cmp-bar-row")).length;
  const barRects = (await page.$$("#cmpBars rect.cmp-bar")).length;
  const barBox = await page.$("#cmpBars svg");
  ok("10d. karşılaştırma grafiği: 5 metrik çift çubuk", barRows === 5 && barRects === 12, barRows + " satır, " + barRects + " çubuk/legend");
  ok("10e. grafik görünür (panel içinde taşmıyor)", !!barBox && (await barBox.boundingBox()).width > 100, barBox ? Math.round((await barBox.boundingBox()).width) + "px" : "yok");
});

/* ── 11) Öğrenci zaman çizelgesi ── */
scenario("11", async (page) => {
  const subs = [sub("Elif", "Robot Kol", {
    total: 4,
    steps: { 0: Date.now() - 3 * DAY, 1: Date.now() - 2 * DAY, 2: Date.now() - DAY },
    classCode: "7A",
    ts: Date.now() - DAY,
  })];
  await seedClassroom(page, subs, { code: "7A" });
  await openClassroom(page);
  const tlBtnBefore = await page.$("#subList [data-tl]");
  ok("11a. kartta ⏱️ düğmesi var", !!tlBtnBefore);
  const tlHidden0 = !(await page.$("#subList .timeline"));
  await tlBtnBefore.click();
  await page.waitForSelector("#subList .timeline");
  const tlRows = (await page.$$("#subList .timeline .tl-row")).length;
  ok("11b. çizelge açıldı: 3 adım + gönderim = 4 satır", tlRows === 4, tlRows + " satır");
  await page.click("#subList [data-tl]");
  await page.waitForTimeout(250);
  const tlGone = !(await page.$("#subList .timeline"));
  ok("11c. tekrar tıklayınca kapanır", tlHidden0 && tlGone);
});

/* ── 12) Arşiv mini önizleme ── */
scenario("12", async (page) => {
  await seedArchive(page, [
    {
      id: 1, ts: 1, idea: "saksı",
      guide: {
        title: "Akıllı Saksı", code: "a", difficulty: "Orta", summary: "Toprağı ölçen saksı.", materials: [],
        steps: [{ title: "Sensörü tak" }, { title: "Pompayı bağla" }, { title: "Eşiği ayarla" }, { title: "Kodu yükle" }],
        tips: ["Fazla su kök çürütür."],
      },
    },
  ]);
  await clickMenu(page, "#archiveBtn");
  await page.waitForSelector("#archGrid [data-prev]");
  const prevHidden0 = !(await page.$("#archGrid .arch-preview"));
  await page.click("#archGrid [data-prev]");
  await page.waitForSelector("#archGrid .arch-preview");
  const pvSteps = (await page.$$("#archGrid .arch-preview li")).length;
  const pvSum = await page.$eval("#archGrid .arch-prev-sum", (e) => e.textContent);
  ok("12a. önizleme açıldı: özet + ilk 3 adım + ipucu", pvSum.includes("Toprağı ölçen") && pvSteps === 3 && !!(await page.$("#archGrid .arch-prev-tip")), pvSteps + " adım");
  await page.click("#archGrid [data-prev]");
  await page.waitForTimeout(250);
  const pvGone = !(await page.$("#archGrid .arch-preview"));
  ok("12b. tekrar tıklayınca kapanır", prevHidden0 && pvGone);
});

/* ── 13) Rapor sınıf turları + satır rozeti + çizelge bölümü ── */
scenario("13", async (page) => {
  const subs = [
    sub("Ali", "P1", { total: 3, steps: { 0: Date.now() - 2 * DAY, 1: Date.now() - DAY }, classCode: "7A", ts: Date.now() - DAY }),
    sub("Veli", "P2", { total: 3, steps: { 0: Date.now() - 5 * DAY }, classCode: "8B", ts: Date.now() - 4 * DAY }),
  ];
  await seedClassroom(page, subs, { code: "7A", activeClass: "" });
  await stubWindowOpen(page);
  await openClassroom(page, "#classReportBtn:not([disabled])");
  await page.click("#classReportBtn");
  await page.waitForTimeout(400);
  const rep = await page.evaluate(() => window.__repHtml || "");
  ok("13a. rapor: tur başlıkları (7A + 8B) + satır rozeti", rep.includes("cls-tour") && rep.includes("🎓 7A") && rep.includes("🎓 8B") && rep.includes("cls-tag"), rep ? rep.length + " kr" : "boş");
  ok("13b. rapor: öğrenci zaman çizelgesi bölümü", rep.includes("Öğrenci zaman çizelgeleri") && rep.includes("gönderim"), "");
  ok("13c. rapor: sınıf karşılaştırma grafiği basıldı", rep.includes('class="cmp-bars-print"') && rep.includes("Sınıf Karşılaştırması") && rep.includes('<svg class="cmp-bars"'), "");
});

/* ── Dışa açıklanan arayüz (node --test bunu kullanır) ── */

export { REGISTRY as SCENARIOS, runScenario, parseOnly };

/** Seçilen senaryoları sırayla koşar; koşulan kontrol sayısını döner. */
export async function runScenarios(ids, t) {
  const only = ids ? parseOnly(ids) : null;
  if (only) {
    const bilinmeyen = [...only].filter((id) => !REGISTRY.some((s) => s.id === id));
    if (bilinmeyen.length) {
      throw new Error(`Bilinmeyen senaryo: ${bilinmeyen.join(", ")}. Mevcut: ${REGISTRY.map((s) => s.id).join(", ")}`);
    }
  }
  const chosen = REGISTRY.filter((s) => !only || only.has(s.id));
  console.log(`▶ ${chosen.length} senaryo koşuluyor: ${chosen.map((s) => s.id).join(", ")}\n`);
  for (const s of chosen) await runScenario(s, t);
  return results.length;
}

/* ── CLI: yalnızca doğrudan çalıştırıldığında ── */

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const onlyIds = parseOnly(onlyArg);

  if (listOnly) {
    console.log("Kullanılabilir senaryolar: " + REGISTRY.map((s) => s.id).join(", "));
    console.log("Örnek: node scripts/e2e.mjs --only 12   |   --only 9-12   |   --only 6,12");
    await closeBrowser();
    process.exit(0);
  }

  try {
    await runScenarios(onlyArg);
  } catch (e) {
    console.error(`⚠️  ${e.message}`);
    await closeBrowser();
    process.exit(2);
  }

  await closeBrowser();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n── E2E özeti: ${results.length - failed.length}/${results.length} geçti ──`);
  process.exit(failed.length ? 1 : 0);
}