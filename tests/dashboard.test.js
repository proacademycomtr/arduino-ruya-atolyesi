"use strict";
/* Üye paneli (dashboard) — saf fonksiyon birim testleri.
   Çalıştırma: node --test tests/ */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadCore } = require("./extract.js");

const { picked: core } = loadCore();

test("setup: panel sembolleri çıkarıldı", () => {
  assert.equal(typeof core.dashQuota, "function", "dashQuota yok");
  assert.equal(typeof core.dashTierLabel, "function", "dashTierLabel yok");
});

test("dashQuota: veri yoksa hedef 1000, kullanılan 0, doluluk %0", () => {
  // Nesne vm realm'inden geliyor; deepEqual prototip eşleşmediği için
  // alan alan karşılaştırıyoruz (değerler aynı olmalı).
  const q = core.dashQuota(undefined);
  assert.equal(q.target, 1000);
  assert.equal(q.used, 0);
  assert.equal(q.remaining, 1000);
  assert.equal(q.pct, 0);
});

test("dashQuota: freeLimit + used ile kalan ve yüzde doğru", () => {
  const q = core.dashQuota({ freeLimit: 500, used: 125 });
  assert.equal(q.target, 500);
  assert.equal(q.used, 125);
  assert.equal(q.remaining, 375);
  assert.equal(q.pct, 25);
});

test("dashQuota: tek kişilik dolulukta bar kaybolmaz (en az %2)", () => {
  assert.equal(core.dashQuota({ freeLimit: 1000, used: 1 }).pct, 2);
  assert.equal(core.dashQuota({ freeLimit: 1000, used: 4 }).pct, 2);
});

test("dashQuota: used hedefi aşamaz, negatif sayılamaz, dolu hedef %100", () => {
  assert.equal(core.dashQuota({ freeLimit: 100, used: 500 }).used, 100);
  assert.equal(core.dashQuota({ freeLimit: 100, used: -5 }).used, 0);
  const full = core.dashQuota({ freeLimit: 100, used: 100 });
  assert.equal(full.remaining, 0);
  assert.equal(full.pct, 100);
});

test("dashQuota: freeLimit geçersizse (0/nan) 1000'e düşer", () => {
  assert.equal(core.dashQuota({ freeLimit: 0, used: 5 }).target, 1000);
  assert.equal(core.dashQuota({ freeLimit: NaN, used: 5 }).target, 1000);
  assert.equal(core.dashQuota({ freeLimit: 1000, used: NaN }).used, 0);
});

test("dashTierLabel: TR/EN kademe etiketleri", () => {
  const tl = core.dashTierLabel;
  assert.match(tl("LIFETIME", false), /Ömür boyu/);
  assert.match(tl("LIFETIME", true), /Lifetime/);
  assert.match(tl("MONTHLY", false), /Aylık/);
  assert.match(tl("MONTHLY", true), /Monthly/);
  assert.match(tl("FREE", false), /Ücretsiz/);
  assert.match(tl("FREE", true), /Free/);
  // Bilinmeyen kademe Ücretsiz'e düşer (kapı hiçbir yerde kapanmaz)
  assert.match(tl(undefined, false), /Ücretsiz/);
});
