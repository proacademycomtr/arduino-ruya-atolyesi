/* ── v3.1.0: Tarayıcı (E2E) testleri node --test içinde ──
   Senaryoların tanımı scripts/e2e.mjs'de yaşar; burada her senaryo bir
   node:test testi olarak koşar. Böylece birim + tarayıcı testleri tek komutla
   çalışır:  node --test tests/

   Bu dosya ESM olmak zorunda: playwright'ın ESM girişinde top-level await var,
   CJS require() ile yüklenemiyor (Node 20: ERR_REQUIRE_ASYNC_MODULE).

   Senaryoların kendi iç izolasyonu (kendi browser context'i, temiz
   localStorage) scripts/e2e.mjs içinde; burada yalnızca sarmalama yapılır. */
import { test, after } from "node:test";
import assert from "node:assert";

// Playwright kurulu değilse (ör. yalnız birim testi çalıştıran ortam) sessizce
// geçmek yerine açıkça bildirip atlanır — testler "yeşil ama boş" görünmez.
let SCENARIOS = null, runScenario = null, closeBrowser = null, loadError = null;
try {
  ({ SCENARIOS, runScenario, closeBrowser } = await import("../scripts/e2e.mjs"));
} catch (e) {
  loadError = e;
  if (!(e && e.code === "MODULE_NOT_FOUND" && String(e.message).includes("playwright"))) {
    throw e; // başka bir hata (sözdizimi vb.) — gizlenmesin
  }
  console.warn("⚠️  Playwright kurulu değil — tarayıcı testleri atlandı. Kurulum: npm install");
}

test("E2E modülü yüklenebiliyor", () => {
  assert.equal(loadError, null, `e2e modülü yüklenemedi: ${loadError && loadError.message}`);
  assert.ok(SCENARIOS && SCENARIOS.length > 0, "senaryo kayıt defteri boş");
});

test("E2E kayıt defteri beklenen senaryoları içeriyor", () => {
  if (!SCENARIOS) return;
  const ids = SCENARIOS.map((s) => s.id);
  assert.ok(ids.length >= 13, `senaryo sayısı ${ids.length}, en az 13 beklenir`);
  assert.equal(new Set(ids).size, ids.length, "senaryo kimlikleri benzersiz olmalı");
  for (const must of ["1-2", "3", "4", "5", "ipucu", "6", "7", "8", "9", "10", "11", "12", "13"]) {
    assert.ok(ids.includes(must), `senaryo ${must} kayıtlı değil`);
  }
});

if (SCENARIOS) {
  // Tarayıcı süreci node'un çıkmasını engelliyordu; senaryolar bittikten sonra
  // kapatılır, aksi halde "node --test" asla sonlanmaz.
  after(async () => { if (closeBrowser) await closeBrowser(); });

  for (const { id, fn } of SCENARIOS) {
    test(`E2E ${id}`, async (t) => {
      // runScenario senaryodaki her kontrolü ayrı ayrı değerlendirir; başarısız
      // kontrol varsa senaryo testi düşürür (kontrol sayısı zayıflatılmaz).
      await runScenario({ id, fn }, t);
    });
  }
}