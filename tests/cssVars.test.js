"use strict";
/* v4.4.1 regresyon testi — CSS özel değişkenleri.
   Kök neden: style.css içinde var(--card) gibi tanımsız değişkenler kullanılıyordu.
   Tarayıcı bildirimi GEÇERSİZ sayar ve KURALIN TAMAMINI yok sayar: doluluk
   barının dolgusu, .feat-card, .hero-trust li, .wall-card ve .header-menu
   paneli şeffaf çiziliyordu. Bu test, her var(--x) için ya bir tanımlama ya
   da fallback zorunlu kılar.
   Çalıştırma: node --test tests/ */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
// Yorum içindeki örnekler yanlış alarm vermesin diye yorumlar atılır.
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");

const defined = new Set();
for (const m of stripped.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) defined.add(m[1]);

// var(--ad, fallback) kalıpları: grup1 = ad, grup3 = fallback (varsa)
const usages = [...stripped.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*(,\s*([^)]+))?\)/g)];

test("setup: style.css okundu ve değişkenler toplandı", () => {
  assert.ok(defined.size >= 20, "tanımlı değişken az: " + defined.size);
  assert.ok(usages.length >= 30, "var() kullanımı az: " + usages.length);
});

test("her var(--x) tanımlı ya da fallback taşımalı", () => {
  const bad = [];
  for (const m of usages) {
    const name = m[1];
    const hasFallback = Boolean(m[2] && m[3] && m[3].trim().length);
    if (!defined.has(name) && !hasFallback) {
      const idx = stripped.indexOf(m[0]);
      const line = stripped.slice(0, idx).split("\n").length;
      bad.push(name + " (satır ~" + line + ")");
    }
  }
  assert.deepEqual(bad, [], "tanımsız ve fallback'siz değişkenler: " + bad.join(", "));
});

test("doluluk barı dolgusu ve kart değişkenleri tanımlı", () => {
  const fill = stripped.match(/\.occupancy-fill\s*\{[^}]*background\s*:\s*([^;]+);/);
  assert.ok(fill, ".occupancy-fill background kuralı bulunamadı");
  // --accent fallback'siz kullanılıyordu; tanımlı olmasa gradyan çökerdi.
  if (/var\(\s*--accent\s*\)/.test(stripped)) {
    assert.ok(defined.has("--accent"), "--accent kullanılıyor ama tanımlı değil");
  }
  if (/var\(\s*--card\s*\)/.test(stripped)) {
    assert.ok(defined.has("--card"), "--card kullanılıyor ama tanımlı değil");
  }
  // --code-bg / --shadow-sm fallback'li kullanılıyor; yine de tanımlı olsun
  // (yedek değerler kaynakla tutarlı kalsın diye).
  assert.ok(defined.has("--code-bg"), "--code-bg tanımlı değil");
  assert.ok(defined.has("--shadow-sm"), "--shadow-sm tanımlı değil");
});
