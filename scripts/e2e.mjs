#!/usr/bin/env node
/* ── Arduino Rüya Atölyesi — uçtan uca tarayıcı testleri (Playwright) ──
   Çalıştırma: node scripts/e2e.mjs [url]
   - URL verilmezse dist/index.html file:// ile açılır.
   - 5 senaryo: rehber üretimi + fiyat tablosu, sıralama, bütçe uyarısı,
     sertifika akışı, localStorage ısrarlılığı (adet override). */

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = process.argv[2]
  || pathToFileURL(resolve(process.cwd(), "dist/index.html")).href;

const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond, extra });
  console.log((cond ? "✅" : "❌") + " " + name + (extra ? ` — ${extra}` : ""));
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(15000);

try {
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#ideaInput");

  /* ── 1) Rehber üretimi + fiyat tablosu ── */
  await page.fill("#ideaInput", "LCD'li dijital saat");
  await page.click("#generateBtn");
  await page.waitForSelector(".materials-table .cost-total");
  const headers = await page.$$eval(".materials-table thead th", (ths) => ths.map((t) => t.textContent.trim()));
  ok("1a. fiyat tablosu 5 sütunlu", headers.join("|").includes("Birim Fiyat") && headers.join("|").includes("Tutar"), headers.join(" / "));
  const totalTxt = await page.$eval(".cost-total td:nth-child(4)", (t) => t.textContent.trim());
  ok("1b. toplam ₺+çift gösterim", /^\d+\.\d{2}₺ \(\$\d+\.\d{2}\)$/.test(totalTxt), totalTxt);

  /* ── 2) Fiyata göre sıralama döngüsü ── */
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

  /* ── 3) Bütçe uyarısı ── */
  await page.evaluate(() => localStorage.setItem("arduinoDreamLab.budget.v1", "15"));
  await page.click("#generateBtn"); // yeniden üret (2000ms AI gecikmesi olabilir; demo anında)
  await page.waitForSelector(".cost-over", { timeout: 10000 }).catch(() => {});
  const overRow = await page.$(".cost-over");
  const overText = overRow ? await overRow.$eval("td:nth-child(5)", (t) => t.textContent) : "";
  ok("3. bütçe aşımı uyarısı", !!overRow && overText.includes("Bütçe aşımı"), overText.trim().slice(0, 60));
  await page.evaluate(() => localStorage.removeItem("arduinoDreamLab.budget.v1"));

  /* ── 4) Sertifika akışı (window.open stub + badge kaydı) ── */
  await page.evaluate(() => window.open = () => null); // popup engelle (context yıkılmasın)
  await page.$$eval(".step-check", (cbs) => cbs.forEach((c) => { if (!c.checked) c.click(); }));
  await page.waitForSelector("#certRow:not([hidden])", { state: "attached" });
  await page.fill("#certNameInput", "E2E Öğrenci");
  await page.click('[data-act="cert"]');
  await page.waitForTimeout(1500);
  const badges = await page.evaluate(() => JSON.parse(localStorage.getItem("arduinoDreamLab.badges.v1") || "[]"));
  ok("4. sertifika → rozet kaydı", badges.length === 1 && badges[0].type === "cert" && !!badges[0].guide, badges.length + " rozet");

  /* ── 5) Adet override kalıcılığı ── */
  const plusBtn = await page.$('.qty-btn[data-qdir="1"]');
  await plusBtn.click();
  await page.waitForTimeout(300);
  const unoVal = await page.$eval(".qty-input", (i) => i.value);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("arduinoDreamLab.costQty.v1") || "{}"));
  const totalAfter = await page.$eval(".cost-total td:nth-child(4)", (t) => t.textContent.trim());
  ok("5a. + düğmesi adedi 2 yaptı", unoVal === "2", "input=" + unoVal);
  ok("5b. override localStorage'da", stored["Arduino Uno"] === "2", JSON.stringify(stored));
  // Toplam +10$ artmış olmalı (2×Uno): kur ne olursa olsun $24.00 (16+8)
  ok("5c. toplam güncellendi (2×Uno)", totalAfter.endsWith("($24.00)"), totalAfter);

  /* ── Canlı maliyet ipucu (senkron demo yolu) ── */
  await page.fill("#ideaInput", "Odam için sıcaklığı ölçüp lamba yakan otomatik bir gece lambası istiyorum");
  await page.waitForTimeout(900);
  const hint = await page.$eval("#costHint", (e) => e.textContent);
  ok("+ canlı ipucu (demo şablonu)", hint.includes("≈"), hint);

  /* ── 6) v2.19.0: panel arama + sayfalama + alışveriş listesi düğmesi ── */
  await page.evaluate(() => {
    const subs = {};
    for (let i = 1; i <= 8; i++) {
      subs[`Öğrenci ${i}|Proje ${i}`] = { student: `Öğrenci ${i}`, project: `Proje ${i}`, total: 3, steps: { 0: 1 }, ts: Date.now() - i * 86400000, materials: [] };
    }
    localStorage.setItem("arduinoDreamLab.classroom.v1", JSON.stringify({ code: "E2E-19", submissions: subs }));
  });
  await page.click("#classBtn");
  await page.waitForSelector("#subList .archive-item");
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
  ok("6d. alışveriş listesi düğmesi var", !!(await page.$('[data-act="cart"]')));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

} catch (e) {
  ok("AKIŞ", false, e.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n── E2E özeti: ${results.length - failed.length}/${results.length} geçti ──`);
process.exit(failed.length ? 1 : 0);
