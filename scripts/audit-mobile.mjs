#!/usr/bin/env node
/* ── Geçici mobil uyumluluk denetimi ──
   Birden fazla viewport'ta yatay taşma, görünür alanı aşan öğeleri ve
   dokunma hedefi küçüklüğünü ölçer. Kırık düzenleri listelemek için kullanılır.
   Çalıştırma: node scripts/audit-mobile.mjs */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const target = pathToFileURL(resolve(process.cwd(), "dist/index.html")).href;
const VIEWPORTS = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 12", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
];

const browser = await chromium.launch();
const d = 86400000;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.width < 768, hasTouch: vp.width < 768 });
  const page = await ctx.newPage();
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#ideaInput");

  // Sınıf verisi + arşiv verisi ekle ki paneller de dolu olsun
  await page.evaluate((day) => {
    const subs = {};
    const mk = (n, cls) => { subs[`Öğrenci ${n}|Proje ${n}`] = { student: `Öğrenci ${n}`, project: `Proje ${n}`, total: 4, steps: { 0: 1, 1: Date.now() - day }, ts: Date.now() - n * day, classCode: cls, materials: [] }; };
    mk(1, "7A"); mk(2, "7A"); mk(3, "8B");
    localStorage.setItem("arduinoDreamLab.classroom.v1", JSON.stringify({ code: "7A", submissions: subs }));
    localStorage.setItem("arduinoDreamLab.activeClass.v1", "");
    localStorage.setItem("arduinoDreamLab.archive.v1", JSON.stringify([
      { id: 1, ts: 1, idea: "saksı", guide: { title: "Akıllı Saksı", code: "a", difficulty: "Orta", summary: "Toprağı ölçen saksı.", materials: [], steps: [{ title: "a" }, { title: "b" }, { title: "c" }], tips: ["ipucu"] } },
    ]));
  }, d);

  const measure = async (label) => {
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const overflowX = document.documentElement.scrollWidth > vw + 1;
      const wide = [];
      for (const el of document.querySelectorAll("body *")) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        const st = getComputedStyle(el);
        if (st.position === "fixed" || st.display === "none" || st.visibility === "hidden") continue;
        // Kırpılan dekoratif içerik (hero devre izleri, aria-hidden SVG'ler) taşma sayılmaz
        if (el.closest('[aria-hidden="true"]')) continue;
        let clipped = false;
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ps = getComputedStyle(p);
          if (ps.overflowX !== "visible" || ps.overflowY !== "visible") { clipped = true; break; }
        }
        if (clipped) continue;
        if (b.right > vw + 1 || b.left < -1) {
          wide.push({ sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(" ").filter(Boolean).slice(0, 2).join(".") : ""), w: Math.round(b.width), left: Math.round(b.left), right: Math.round(b.right) });
        }
      }
      const small = [];
      for (const el of document.querySelectorAll("button, a, input, select")) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden") continue;
        if (b.height < 32 || b.width < 32) {
          small.push({ sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""), txt: (el.textContent || "").trim().slice(0, 18), w: Math.round(b.width), h: Math.round(b.height) });
        }
      }
      return { vw, overflowX, wide: wide.slice(0, 8), small: small.slice(0, 8), wideN: wide.length, smallN: small.length };
    });
    console.log(`\n── ${vp.name} (${vp.width}px) / ${label} ──`);
    console.log(`   viewport=${r.vw}  yatayTaşma=${r.overflowX}  taşanÖğe=${r.wideN}  küçükHedef=${r.smallN}`);
    for (const w of r.wide) console.log(`   TAŞAN: ${w.sel} w=${w.w} left=${w.left} right=${w.right}`);
    for (const s of r.small) console.log(`   KÜÇÜK: ${s.sel} "${s.txt}" ${s.w}x${s.h}`);
    return r;
  };

  await measure("ana sayfa");

  await page.click("#classBtn");
  await page.waitForSelector("#subList .archive-item");
  await page.waitForTimeout(400);
  await measure("sınıf paneli");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.click("#archiveBtn");
  await page.waitForSelector("#archGrid .archive-item");
  await page.waitForTimeout(300);
  await measure("arşiv");

  await ctx.close();
}
await browser.close();