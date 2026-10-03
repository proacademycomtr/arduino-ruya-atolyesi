"use strict";
/* app.js kaynak metninden saf çözücü fonksiyonlarını çıkarıp sanal ortamda
   değerlendirir. Tarayıcı API'leri stub'lanır; DOM'a dokunan kodlar çalışmaz. */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP_JS = path.join(__dirname, "..", "app.js");

/* Sanal localStorage */
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; }
  };
}

/* app.js'i çalıştırır; DOM dokunmaları stub'lanır. Dönen sandbox'ta
   fonksiyonlara erişilebilir. */
function loadApp({ storage } = {}) {
  const src = fs.readFileSync(APP_JS, "utf8");
  const ls = storage || makeStorage();
  const noop = () => {};
  const fakeElement = () => {
    const el = {
      hidden: true, value: "", textContent: "", innerHTML: "", title: "",
      dataset: {}, style: {}, files: [],
      classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
      addEventListener: noop, removeEventListener: noop,
      appendChild: noop, remove: noop, focus: noop, click: noop,
      closest: () => null, setAttribute: noop, getAttribute: () => null
    };
    el.querySelector = () => ({ textContent: "", value: "", hidden: false });
    el.querySelectorAll = () => [];
    return el;
  };
  const sandbox = {
    console: { log: noop, warn: noop, error: noop, info: noop, debug: noop },
    localStorage: ls,
    document: {
      getElementById: () => fakeElement(),
      querySelector: () => fakeElement(),
      querySelectorAll: () => [],
      createElement: () => fakeElement(),
      addEventListener: noop,
      documentElement: { dataset: {}, removeAttribute: noop },
      body: Object.assign(fakeElement(), { appendChild: noop }),
      hidden: false
    },
    window: {},
    navigator: { clipboard: { writeText: async () => {} }, language: "tr" },
    location: { href: "http://localhost/", protocol: "http:", pathname: "/" },
    fetch: async () => { throw new Error("no network in tests"); },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: noop },
    Blob: class { constructor(parts) { this._p = parts; } },
    TextEncoder: require("node:util").TextEncoder,
    TextDecoder: require("node:util").TextDecoder,
    requestAnimationFrame: noop,
    setTimeout: (fn) => 0,
    clearTimeout: noop,
    alert: noop,
    prompt: () => null,
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    FileReader: class { readAsText() {} },
    Math, Date, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, TypeError,
    parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  try {
    vm.runInContext(src, sandbox, { filename: "app.js" });
  } catch (e) {
    // Tarayıcıya özgü başlatma kodları stub'larla genelde atlatılır;
    // ama exception'ı yutup ne çıkabildiyse onu döndürmek testleri
    // gereksiz kırılgan yapmasın: hatayı bilerek yutuyoruz.
    sandbox.__loadError = e;
  }
  return sandbox;
}

/* Belirli bir top-level `function NAME(...)` kaynağını metinden dilimler.
   Süslü parantez dengesi ile fonksiyon gövdesinin sonunu bulur. */
function sliceFunction(src, name) {
  const re = new RegExp("(?:^|\\n)(?:async )?function " + name + "\\s*\\(");
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length - 1; // "(" konumu
  let depth = 0, i = start, inStr = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") { i++; continue; }
      if (inStr === ch) inStr = null;
      else if (inStr === "`" && ch === "$" && src[i + 1] === "{") { i++; inStr = "tpl"; }
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(m.index, i).trim();
}

/* Çözücü testlerinde kullanılan saf çekirdeği sanal ortamda kurar:
   foldTR, unoPinOf, splitSides, wokwiCompPinOf, wokwiConnections, wokwiValidate,
   wokwiDiagram, makeZip, crc32, buildWokwiProjectFiles, makeDemoGuide + yardımcıları. */
function loadCore() {
  const sandbox = loadApp();
  const src = fs.readFileSync(APP_JS, "utf8");
  const names = [
    "foldTR", "unoPinOf", "splitSides", "rowPinOf", "resolveToken", "wokwiCompPinOf",
    "wokwiConnections", "wokwiValidate", "wokwiDiagram", "wokwiConnectionSummary",
    "libAppendParts", "appendHints", "libWokwiMatch", "libPinWords", "libHasPart",
    "loadLibCustom", "saveLibCustom", "normalizeLibCustom", "ALL_LIB", "LIB_DATA",
    "makeDemoGuide", "demoMeta", "demoLineFollower", "demoPlantWaterer", "demoThermostat",
    "demoSecurity", "demoGeneric", "demoLcdClock", "demoRgbLamp", "demoServoLock",
    "demoNightLight", "demoDice", "demoOledRuler", "certificateSVG", "makeZip", "crc32", "dosDateTime", "buildWokwiProjectFiles",
    "buildClassSubmission", "stepsStore", "stepsKeyOf", "downloadWokwiZip", "downloadPortfolio", "applyBulkFeedback", "exportBackup", "restoreBackup",
    "loadFeedback", "saveFeedback", "downloadClassFeedback", "showFeedback", "openStudentFeedback", "leaderboardSVG",
    "recordCertificate", "loadBadges", "saveBadges", "updateBadgeCount", "badgeTiers",
    "colorOf", "kindOf", "hintOwnerId", "wordToPin", "partOf", "kindIdOf", "idOf",
    "priceOf", "estimateCost", "fmtTL", "PRICE_CATALOG", "USD_TRY_RATE",
    "loadCustomPrices", "saveCustomPrices", "parseCustomPrices",
    "loadBudget", "isOverBudget", "parseCatalogJSON", "sortCostRows",
    "loadFileCatalog", "fileCatalogBudget", "budgetSuggestion", "liveCostHint",
    "loadRate", "rate", "rateAgeHours", "updateRateFromWeb",
    "liveCostHintSync", "buildCostPrompt", "askAICostMaterials", "aiCostCache",
    "loadClassSize", "weeklyProgressSVG",
    "catalogSuggestions", "atRiskStudents", "unknownMaterials", "classSubsToCSV", "downloadClassCSV",
    "shoppingListText", "shareShoppingList", "filterSubmissions", "paginate", "mostActiveWeek", "mondayOf",
    "loadCsvRange", "saveCsvRange", "filterSubsByRange", "archiveMeta", "setArchiveMeta", "loadArchive", "writeArchive",
    "filterArchiveItems", "weeklyParticipationDetail",
    "weeklyBarsData", "panelWeeklySVG", "activeClassCode", "setActiveClassCode", "classSubs", "sortArchiveItems",
    "compareClasses", "classMetrics", "compareTableHTML", "studentTimeline", "timelineSummary", "groupSubsByClass", "archivePreviewData",
    "buildAmbientPlan", "nextAmbientStep", "markAmbientStep", "orderPortfolioCerts"
  ];
  // Sanal ortamda app.js tümüyle çalıştı; örneklemesi gerekenler const/let ise
  // ayrıca değerlendir. window üzerinde export edilenler zaten sandbox'ta.
  const picked = {};
  const missing = [];
  for (const n of names) {
    let v;
    try { v = vm.runInContext("typeof " + n + " === 'function' ? " + n + " : (typeof " + n + " !== 'undefined' ? " + n + " : undefined)", sandbox); }
    catch { v = undefined; }
    if (typeof v === "undefined") { missing.push(n); continue; }
    picked[n] = v;
  }
  // const/let ile tanımlı olanlar sandbox'tan doğrudan okunamaz (vm kapsamı);
  // gerekli sabitleri metinden yeniden değerlendir.
  if (missing.length) {
    const needed = [];
    // LIB_DATA (dizi sabiti) + LIB_CATS + kategori sabitleri
    const libDataM = src.match(/const LIB_DATA = \[[\s\S]*?\n\];/);
    if (libDataM) needed.push(libDataM[0]);
    const libCatsM = src.match(/const LIB_CATS = \[[^\]]*\];/);
    if (libCatsM) needed.push(libCatsM[0]);
    for (const n of ["foldTR", "ALL_LIB"]) {
      const f = sliceFunction(src, n);
      // const foldTR = ... biçimindeyse kaynak metnini al
      if (!f) {
        const cm = src.match(new RegExp("const " + n + " = [\\s\\S]*?\\n\\};"));
        if (cm) needed.push(cm[0]);
      } else needed.push(f);
    }
    try { vm.runInContext(needed.join("\n"), sandbox); } catch (e) { sandbox.__extractError = e; }
    for (const n of missing.slice()) {
      let v;
      try { v = vm.runInContext("typeof " + n + " !== 'undefined' ? " + n + " : undefined", sandbox); }
      catch { v = undefined; }
      if (typeof v === "undefined") continue;
      picked[n] = v;
      missing.splice(missing.indexOf(n), 1);
    }
  }
  return { sandbox, picked, missing };
}
/* AI tahmini testleri için ayrı sandbox: settings önceden doldurulmuş storage ile yüklenir.
   loadCore'un sandbox'ı paylaşmak yerine bağımsız kurar — settings const'ı yükleme anında
   okunduğu için API-anahtarlı senaryo bu yolla test edilir. */
function loadCoreWithSettings(settings) {
  const ls = makeStorage();
  ls.setItem("arduinoDreamLab.settings.v1", JSON.stringify(settings || {}));
  const sandbox = loadApp({ storage: ls });
  // picked setini aynı kurallarla çıkar (loadCore'un names listesi — kısa yol: loadCore'daki
  // listeyi kopyalamak yerine loadCore'u çağırıp sandbox'ı değiştirmek yanlış olur; burada
  // yalnız AI-tahmini testlerinde gereken fonksiyonlar vm ile alınır).
  const names = ["liveCostHint", "liveCostHintSync", "askAICostMaterials", "buildCostPrompt", "aiCostCache", "hasApiKey", "estimateCost", "fmtTL", "rate"];
  const picked = {};
  for (const n of names) {
    let v;
    try { v = vm.runInContext("typeof " + n + " === 'function' ? " + n + " : (typeof " + n + " !== 'undefined' ? " + n + " : undefined)", sandbox); }
    catch { v = undefined; }
    if (typeof v !== "undefined") picked[n] = v;
  }
  return { sandbox, picked };
}

module.exports = { loadApp, loadCore, loadCoreWithSettings, sliceFunction, makeStorage, APP_JS };
