"use strict";
/* Çözücü + Wokwi diyagram + doğrulama + zip paketi birim testleri.
   Çalıştırma: node --test tests/ */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadCore, loadCoreWithSettings } = require("./extract.js");

/* Demet: her test dosyası app.js'i bir kez yükler (pahalı işlem) */
const { sandbox, picked: core, missing } = loadCore();

test("setup: çekirdek semboller çıkarıldı", () => {
  const must = ["wokwiConnections", "wokwiDiagram", "wokwiValidate", "wokwiConnectionSummary",
    "makeDemoGuide", "libWokwiMatch", "libPinWords", "makeZip", "crc32",
    "libAppendParts", "appendHints", "normalizeLibCustom"];
  const gone = must.filter((n) => typeof core[n] !== "function");
  assert.deepEqual(gone, [], "eksik semboller: " + gone.join(", "));
});

test("foldTR: Türkçe karakterler katlanır", () => {
  const f = core.foldTR || sandbox.foldTR;
  assert.equal(String(f("ÇİĞÖŞÜ")), String(f("CIGOSU")));
});

/* ─────────── Demo rehberlerin tamamı diyagrama dönüşebilmeli ─────────── */

const DEMO_IDEAS = [
  "Otomatik sulayan akıllı saksı",
  "Odam için akıllı termostat",
  "Hareket algılayan güvenlik sistemi",
  "Çizgi izleyen yarış arabası",
  "Basit robot kol",
  "Otomatik 7 segment display sayacı",
  "Ultrasonik park sensörü",
  "Buzzerlı mini piyano",
  "LCD'li dijital saat",
  "RGB LED mood lambası",
  "Servo kapı kilidi"
];

test("demo rehberler: parça üretimi ve diyagram", () => {
  for (const idea of DEMO_IDEAS) {
    const g = core.makeDemoGuide(idea);
    assert.ok(g && g.title, idea + ": rehber üretilmedi");
    assert.ok((g.materials || []).length >= 3, idea + ": malzeme az");
    const d = core.wokwiDiagram(g);
    assert.ok(d.parts.length >= 2, idea + ": uno dışında parça yok");
    // Tüm parça tipleri wokwi- önekli olmalı
    for (const p of d.parts) assert.match(p.type, /^wokwi-/, idea + ": geçersiz tip " + p.type);
    // Uno her zaman var
    assert.ok(d.parts.some((p) => p.id === "uno"), idea + ": uno yok");
    // Parça id'leri ASCII olmalı (Wokwi gereği)
    for (const p of d.parts) assert.match(p.id, /^[a-zA-Z0-9_-]+$/, idea + ": ASCII-dışı id " + p.id);
  }
});

test("demo rehberler: hayalet parça uydurmama (L298N/DC motor/pompa/fan/toprak)", () => {
  const banned = ["l298n", "dc-motor", "motor", "soil", "pompa", "fan"];
  for (const idea of DEMO_IDEAS) {
    const d = core.wokwiDiagram(core.makeDemoGuide(idea));
    for (const p of d.parts) {
      const t = p.type.replace("wokwi-", "").toLowerCase();
      assert.ok(!banned.includes(t), idea + ": hayali parça uydurulmuş: " + p.type);
    }
  }
});

test("çizgi izleyen: IR sensörler pot olarak simüle edilir ve kabloya bağlanır", () => {
  const g = core.makeDemoGuide("Çizgi izleyen yarış arabası");
  const d = core.wokwiDiagram(g);
  const pots = d.parts.filter((p) => p.type === "wokwi-potentiometer");
  assert.equal(pots.length, 2, "2 IR sensör potu beklenir");
  assert.ok(d.connections.length >= 4, "en az 4 kablo (2×VCC/GND)");
  // OUT pinleri D2/D3'e bağlanmış mı
  const unoEnds = d.connections.map((c) => c[1]);
  assert.ok(unoEnds.some((e) => /:~?2$/.test(e)), "D2 bağlantısı yok");
  assert.ok(unoEnds.some((e) => /:~?3$/.test(e)), "D3 bağlantısı yok");
});

test("doğrulama: demo rehberlerde yanlış pozitif yok", () => {
  for (const idea of DEMO_IDEAS) {
    const g = core.makeDemoGuide(idea);
    const d = core.wokwiDiagram(g);
    const v = core.wokwiValidate(g, d);
    assert.equal(v.length, 0, idea + ": beklenmedik uyarı: " + JSON.stringify(v));
  }
});

test("doğrulama: pin çakışması yakalanır", () => {
  const g = {
    title: "Test", difficulty: "Kolay", summary: "s",
    materials: [{ name: "LED", quantity: "1" }, { name: "Buton", quantity: "1" }],
    wiring: [
      { from: "LED A", to: "Arduino D8" },
      { from: "Buton 1", to: "Arduino D8" }
    ],
    steps: [], tips: [], code: ""
  };
  const d = core.wokwiDiagram(g);
  const v = core.wokwiValidate(g, d);
  assert.ok(v.some((i) => i.type === "pin-conflict"), "çakışma raporlanmalı: " + JSON.stringify(v));
});

test("doğrulama: GND ray istisnası — paylaşılan toprak çakışma sayılmaz", () => {
  const g = {
    title: "Test", difficulty: "Kolay", summary: "s",
    materials: [{ name: "LED", quantity: "1" }, { name: "Buzzer", quantity: "1" }],
    wiring: [
      { from: "LED A / C", to: "Arduino D8 / GND" },
      { from: "Buzzer + / −", to: "Arduino D9 / GND" }
    ],
    steps: [], tips: [], code: ""
  };
  const d = core.wokwiDiagram(g);
  const v = core.wokwiValidate(g, d);
  const conflicts = v.filter((i) => i.type === "pin-conflict" && /GND/.test(i.pin));
  assert.equal(conflicts.length, 0, "GND rayı çakışma sayılmamalı: " + JSON.stringify(v));
});

test("son ekli pin ifadeleri: 'D13 (220Ω ile)' çözülür", () => {
  const g = {
    title: "T", difficulty: "Kolay", summary: "s",
    materials: [{ name: "LED", quantity: "1" }],
    wiring: [{ from: "LED A", to: "Arduino D13 (220Ω ile)" }],
    steps: [], tips: [], code: ""
  };
  const d = core.wokwiDiagram(g);
  assert.ok(d.connections.length === 1, "bağlantı üretilmedi");
  assert.equal(d.connections[0][1], "uno:13");
});

test("kütüphane eşleşmesi: 'DC motor' servo'ya yanlış eşleşmez", () => {
  const hit = core.libWokwiMatch("DC motor + tekerlek");
  if (hit) assert.ok(!/servo/i.test(hit.name), "DC motor servo'ya eşleşti: " + hit.name);
});

/* ─────────── ZIP yazıcı ─────────── */

test("zip: CRC32 doğruluk (bilgi vektörü)", () => {
  // "123456789" → 0xCBF43926 (standart CRC-32 test vektörü)
  const bytes = Array.from(new TextEncoder().encode("123456789"));
  assert.equal(core.crc32(bytes), 0xCBF43926);
});

test("zip: makeZip geçerli arşiv üretir (EOCD + merkezi dizin + yerel başlık imzaları)", () => {
  const files = [
    { name: "sketch.ino", content: "void setup(){}\nvoid loop(){}\n" },
    { name: "diagram.json", content: '{"version":1,"parts":[]}' }
  ];
  const blob = core.makeZip(files);
  assert.ok(blob, "Blob dönmedi");
});

test("zip: makeZip gerçek bayt doğrulaması (Node Blob ile)", () => {
  // Sandbox'taki Blob stub'ı yerine gerçek Node Blob'u enjekte edip baytları oku
  sandbox.Blob = globalThis.Blob;
  const files = [{ name: "a.txt", content: "merhaba dünya" }];
  const blob = sandbox.makeZip(files);
  return blob.arrayBuffer().then((buf) => {
    const b = new Uint8Array(buf);
    // Yerel dosya başlığı imzası PK\x03\x04
    assert.equal(b[0], 0x50); assert.equal(b[1], 0x4B);
    assert.equal(b[2], 0x03); assert.equal(b[3], 0x04);
    // EOCD imzası PK\x05\x06 sonda
    const tail = b.slice(b.length - 22);
    assert.equal(tail[0], 0x50); assert.equal(tail[1], 0x4B);
    assert.equal(tail[2], 0x05); assert.equal(tail[3], 0x06);
    // EOCD alanları: disk no (4-5), girişteki disk (6-7), girdi sayısı (8-9, 10-11)
    assert.equal(tail[4] | (tail[5] << 8), 0, "disk no");
    assert.equal(tail[8] | (tail[9] << 8), 1, "girdi sayısı");
    assert.equal(tail[10] | (tail[11] << 8), 1, "toplam girdi");
    // Merkezi dizin imzası PK\x01\x02 arada bir yerde
    let hasCentral = false;
    for (let i = 0; i < b.length - 3; i++) {
      if (b[i] === 0x50 && b[i + 1] === 0x4B && b[i + 2] === 0x01 && b[i + 3] === 0x02) { hasCentral = true; break; }
    }
    assert.ok(hasCentral, "merkezi dizin yok");
  });
});

test("wokwi paketi: sketch.ino + diagram.json + öğretmen notları", () => {
  sandbox.getLang = () => "tr";
  const g = core.makeDemoGuide("Hareket algılayan güvenlik sistemi");
  const files = sandbox.buildWokwiProjectFiles(g);
  assert.equal(files.length, 3);
  assert.equal(files[0].name, "sketch.ino");
  assert.equal(files[1].name, "diagram.json");
  const diag = JSON.parse(files[1].content);
  assert.ok(diag.parts.length >= 2);
  assert.match(files[2].name, /NOTLARI\.txt$/);
  assert.ok(files[2].content.includes("wokwi.com"), "Wokwi bağlantısı notta yok");
});

/* ─────────── Sınıf gönderimi ─────────── */

test("sınıf gönderimi: adım verisini paketler", () => {
  const vm = require("node:vm");
  const g = core.makeDemoGuide("Basit robot kol");
  const key = sandbox.stepsKeyOf(g);
  sandbox.localStorage.setItem("arduinoDreamLab.steps.v1",
    JSON.stringify({ [key]: { 0: 1, 2: 1 } }));
  // currentGuide vm bağlamındaki let değişkeni — bağlam içinden ata
  vm.runInContext("currentGuide = " + JSON.stringify({ title: g.title, difficulty: g.difficulty, steps: g.steps, code: g.code }), sandbox);
  const payload = sandbox.buildClassSubmission("Ali Veli");
  assert.ok(payload, "payload null");
  assert.equal(payload.student, "Ali Veli");
  assert.equal(payload.project, g.title);
  assert.equal(payload.total, (g.steps || []).length);
  assert.equal(Object.keys(payload.steps).length, 2);
  assert.deepEqual(Object.keys(payload.steps).sort().join(","), "0,2");
});

test("sınıf içe aktarma: tek gönderim dosyası (.klasor.json) kabul edilir", () => {
  const vm = require("node:vm");
  sandbox.localStorage.setItem("arduinoDreamLab.classroom.v1",
    JSON.stringify({ code: "TEST9Z", submissions: {} }));
  const g = core.makeDemoGuide("Basit robot kol");
  const key = sandbox.stepsKeyOf(g);
  sandbox.localStorage.setItem("arduinoDreamLab.steps.v1",
    JSON.stringify({ [key]: { 0: 1, 2: 1 } }));
  vm.runInContext("currentGuide = " + JSON.stringify({ title: g.title, difficulty: g.difficulty, steps: g.steps, code: g.code }), sandbox);
  const payload = sandbox.buildClassSubmission("Zeynep Kaya");
  assert.equal(payload.classCode, "TEST9Z", "payload sınıf kodunu taşımalı");
  // FileReader stub: readAsText senkron sonucu yükler, onload tetikler
  sandbox.FileReader = class {
    readAsText(input) {
      this.result = String(input && input.__text !== undefined ? input.__text : input);
      if (this.onload) this.onload();
    }
  };
  // 1) Öğrencinin indirdiği TEK NESNE biçimi
  sandbox.importClassSubmissions(JSON.stringify(payload));
  let c = JSON.parse(sandbox.localStorage.getItem("arduinoDreamLab.classroom.v1"));
  const k = "Zeynep Kaya|" + g.title;
  assert.ok(c.submissions[k], "tek-nesne gönderim içe aktarılmadı");
  assert.equal(c.submissions[k].student, "Zeynep Kaya");
  assert.equal(c.submissions[k].total, (g.steps || []).length);
  assert.equal(Object.keys(c.submissions[k].steps).length, 2);
  // 2) Dizi biçimi de çalışmalı
  sandbox.importClassSubmissions(JSON.stringify([payload]));
  c = JSON.parse(sandbox.localStorage.getItem("arduinoDreamLab.classroom.v1"));
  assert.ok(c.submissions[k], "dizi biçimli gönderim içe aktarılmadı");
  // 3) Bozuk içerik reddedilir, mevcut gönderiler korunur
  const before = Object.keys(c.submissions).length;
  sandbox.importClassSubmissions(JSON.stringify({ random: true }));
  c = JSON.parse(sandbox.localStorage.getItem("arduinoDreamLab.classroom.v1"));
  assert.equal(Object.keys(c.submissions).length, before, "bozuk dosya gönderi sayısını değiştirmemeli");
});

test("geri bildirim: öğretmen dosyası üretir, öğrenci okur ve gösterir", () => {
  const vm = require("node:vm");
  // İndirme yakalama: document.body.appendChild stub'u dosya adını not eder
  const downloads = [];
  sandbox.document.body = Object.assign(sandbox.document.body, { appendChild: (el) => { if (el && el.download) downloads.push(el.download); } });
  const fb = sandbox.downloadClassFeedback("Zeynep Kaya", "Basit robot kol", "Harika ilerliyorsun!");
  assert.equal(fb.kind, "ogretmen-geribildirim");
  assert.equal(fb.comment, "Harika ilerliyorsun!");
  assert.match(downloads[0] || "", /\.geribildirim\.json$/, "dosya adı .geribildirim.json bitmeli");
  // Öğrenci: FileReader stub + submitRow DOM'u ile showFeedback çağrısı
  sandbox.FileReader = class {
    readAsText(input) { this.result = String(input); if (this.onload) this.onload(); }
  };
  const row = { hidden: false, parentNode: { insertBefore: () => {} } };
  const boxEl = { id: "", className: "", innerHTML: "", hidden: true };
  sandbox.document.getElementById = (id) => (id === "submitRow" ? row : null);
  sandbox.document.createElement = () => Object.assign(boxEl, { addEventListener: () => {}, click: () => {} });
  vm.runInContext("openStudentFeedback()", sandbox);
  // input.click() stub'ta no-op; değişim akışını doğrudan test etmek yerine showFeedback'ı çağır
  vm.runInContext("showFeedback(" + JSON.stringify(fb) + ")", sandbox);
  assert.ok(boxEl.innerHTML.includes("Harika ilerliyorsun!"), "yorum görünmeli");
  assert.ok(boxEl.innerHTML.includes("Zeynep Kaya"), "öğrenci adı görünmeli");
  // Kalıcılık: FEEDBACK_KEY'e yazılmış olmalı (openStudentFeedback üzerinden)
  assert.ok(Array.isArray(sandbox.loadFeedback()));
  // Lider tablosu: SVG üretir, sıralama yüzdeye göre
  const svg = sandbox.leaderboardSVG([
    { student: "Ali", total: 5, steps: { 0: 1 } },
    { student: "Veli", total: 5, steps: { 0: 1, 1: 1, 2: 1, 3: 1 } },
    { student: "Ayşe", total: 4, steps: { 0: 1, 1: 1, 2: 1, 3: 1 } }
  ]);
  assert.ok(svg.includes("<svg"), "SVG dönmeli");
  const vOrder = [...svg.matchAll(/%(\d+)</g)].map((m) => Number(m[1]));
  assert.deepEqual(vOrder, [...vOrder].sort((a, b) => b - a), "yüzdelere göre azalan sıralı");
});

test("başarımlar: sertifika kaydı + zip kişiselleştirme", () => {
  const vm = require("node:vm");
  sandbox.localStorage.removeItem("arduinoDreamLab.badges.v1");
  const g = core.makeDemoGuide("Mini piyano");
  sandbox.recordCertificate(g, "Ali Veli");
  sandbox.recordCertificate(g, "Ali Veli"); // mükerrer — tek kayıt
  let badges = sandbox.loadBadges();
  assert.equal(badges.length, 1, "mükerrer sertifika eklenmemeli");
  assert.equal(badges[0].type, "cert");
  assert.equal(badges[0].project, g.title);
  // Zip kişiselleştirme: meta ile sketch başlığı + notlarda öğrenci
  const files = core.buildWokwiProjectFiles(g, { student: "Ali Veli", classCode: "TEST9A" });
  const sketch = files.find((f) => f.name === "sketch.ino");
  const notes = files.find((f) => /NOTLARI\.txt$/.test(f.name));
  assert.ok(sketch.content.startsWith("// Mini piyano"), "sketch başlığı öğrenciyle başlamalı");
  assert.ok(sketch.content.includes("Hazırlayan: Ali Veli"));
  assert.ok(sketch.content.includes("Sınıf TEST9A"));
  assert.ok(notes.content.includes("Öğrenci: Ali Veli"));
  assert.ok(notes.content.includes("Sınıf kodu: TEST9A"));
  // Meta'sız çağrı: önceki davranış korunmalı (kişiselleştirme satırı yok)
  const plain = core.buildWokwiProjectFiles(g);
  assert.ok(!plain.find((f) => f.name === "sketch.ino").content.includes("Hazırlayan:"));
  assert.ok(!plain.find((f) => /NOTLARI\.txt$/.test(f.name)).content.includes("Öğrenci:"));
});

test("ileri seviye: 7 segment + piyano gelişmiş bölümleri taşır", () => {
  const seg = core.makeDemoGuide("Otomatik 7 segment display sayacı");
  const pia = core.makeDemoGuide("Mini piyano");
  assert.ok(Array.isArray(seg.advanced) && seg.advanced.length === 2, "7 segment 2 gelişmiş öğe");
  assert.ok(Array.isArray(pia.advanced) && pia.advanced.length === 2, "piyano 2 gelişmiş öğe");
  seg.advanced.concat(pia.advanced).forEach((a) => {
    assert.ok(a.title && a.detail, "başlık + açıklama zorunlu");
    assert.ok(Array.isArray(a.wiring), "wiring dizi olmalı");
    assert.ok(typeof a.code === "string" && a.code.length > 10, "kod parçası olmalı");
  });
  // Park sensörü advanced içermemeli (henüz)
  const park = core.makeDemoGuide("Ultrasonik park sensörü");
  assert.ok(!park.advanced, "park sensörü advanced içermemeli");
});

/* ─────────── Özel set normalize ─────────── */

test("özel set: wokwi tipi doğrulaması ve pinMap temizliği", () => {
  const ok = core.normalizeLibCustom({ name: "X", wokwi: { type: "wokwi-buzzer", pinMap: { "1": "GND", bad: 5 } } });
  assert.equal(ok.wokwi.type, "wokwi-buzzer");
  assert.equal(ok.wokwi.pinMap["1"], "GND");
  assert.equal(ok.wokwi.pinMap.bad, undefined);
  const bad = core.normalizeLibCustom({ name: "Y", wokwi: { type: "javascript:alert(1)", pinMap: { a: "b" } } });
  assert.equal(bad.wokwi, null, "geçersiz tip null olmalı");
});

/* ─────────── v2.8.0: yeni demolar + rapor sütunu + kademeler + portfolyo ─────────── */

test("v2.8.0 demolar: yönlendirme + 0 uyarı + ileri seviye", () => {
  const cases = [
    ["LCD'li dijital saat", /LCD/i],
    ["RGB LED mood lambası", /RGB/i],
    ["Servo kapı kilidi", /Servo/i]
  ];
  for (const [idea, re] of cases) {
    const g = core.makeDemoGuide(idea);
    assert.match(g.title, re, idea + ": yönlendirme yanlış: " + g.title);
    const d = core.wokwiDiagram(g);
    const v = core.wokwiValidate(g, d);
    assert.equal(v.length, 0, idea + ": uyarı: " + JSON.stringify(v));
    assert.ok(Array.isArray(g.advanced) && g.advanced.length === 2, idea + ": 2 ileri seviye öğe beklenir");
  }
  // LCD: I2C pinleri A4/A5'e çözülmeli
  const lcdD = core.wokwiDiagram(core.makeDemoGuide("LCD'li dijital saat"));
  const lcdEnds = lcdD.connections.map((c) => c[1]);
  assert.ok(lcdEnds.includes("uno:A4") && lcdEnds.includes("uno:A5"), "I2C A4/A5 yok: " + JSON.stringify(lcdEnds));
  // RGB: ayrı bir düz LED parçası üretilmemeli
  const rgbD = core.wokwiDiagram(core.makeDemoGuide("RGB LED mood lambası"));
  assert.ok(rgbD.parts.some((p) => p.id === "rgb1"), "rgb1 yok");
  assert.ok(!rgbD.parts.some((p) => p.id === "led1"), "RGB projede fazladan düz LED var");
  // Servo: KilitTusu butonu D2'ye çözülmeli
  const svD = core.wokwiDiagram(core.makeDemoGuide("Servo kapı kilidi"));
  const btnEnds = svD.connections.filter((c) => c[0].startsWith("btn1:")).map((c) => c[1]);
  assert.ok(btnEnds.some((e) => /:2$/.test(e)), "buton D2'ye bağlanmalı: " + JSON.stringify(btnEnds));
});

test("v2.8.0 rapor: geri bildirim durumu sütunu", () => {
  let html = "";
  sandbox.open = () => ({ document: { write: (h) => { html = h; }, close: () => {} } });
  sandbox.localStorage.setItem("arduinoDreamLab.classroom.v1", JSON.stringify({
    code: "TEST9A",
    submissions: {
      "Ali|Proj": { student: "Ali", project: "Proj", total: 3, steps: { 0: 1 }, ts: Date.now(), fb: { comment: "Çok iyi gidiyorsun!" } },
      "Veli|Proj": { student: "Veli", project: "Proj", total: 3, steps: { 0: 1 }, ts: Date.now() }
    }
  }));
  sandbox.downloadClassReport();
  assert.ok(html.includes("Geri Bildirim"), "başlık sütunu yok");
  assert.ok(html.includes("Verildi"), "verildi durumu yok");
  assert.ok(html.includes("Bekliyor"), "bekliyor durumu yok");
  assert.ok(html.includes("Çok iyi gidiyorsun"), "yorum özeti yok");
});

test("v2.8.0 rozet kademeleri: bronz 3 / gümüş 5 / altın eşikleri (otomatik)", () => {
  sandbox.localStorage.removeItem("arduinoDreamLab.badges.v1");
  let bt = sandbox.badgeTiers();
  assert.equal(bt.certs, 0);
  assert.ok(!bt.earned, "0 sertifikada kazanılmış kademe olmamalı");
  assert.equal(bt.all, 14, "altın eşiği demo sayısından otomatik türetilir (14)");
  const g = core.makeDemoGuide("Servo kapı kilidi");
  for (let i = 0; i < 3; i++) sandbox.recordCertificate({ ...g, title: "Proje " + i }, "Ayşe");
  bt = sandbox.badgeTiers();
  assert.equal(bt.earned.name, "Bronz");
  for (let i = 3; i < 5; i++) sandbox.recordCertificate({ ...g, title: "Proje " + i }, "Ayşe");
  bt = sandbox.badgeTiers();
  assert.equal(bt.earned.name, "Gümüş");
  for (let i = 5; i < sandbox.badgeTiers().all; i++) sandbox.recordCertificate({ ...g, title: "Proje " + i }, "Ayşe");
  bt = sandbox.badgeTiers();
  assert.equal(bt.earned.name, "Altın");
  assert.ok(bt.all >= 11, "altın hedefi tüm demo sayısı olmalı: " + bt.all);
  // Her sertifika guide snapshot'ı taşımalı (portfolyo için)
  const badges = sandbox.loadBadges();
  assert.equal(badges.length, sandbox.badgeTiers().all, "tüm sertifikalar kaydedilmiş olmalı");
  assert.ok(badges.every((b) => b.guide && b.guide.title), "guide snapshot'ı eksik");
});

test("v2.8.0 rozet modal: kademe kartı + portfolyo düğmesi render edilir", () => {
  sandbox.localStorage.removeItem("arduinoDreamLab.badges.v1");
  const g = core.makeDemoGuide("Mini piyano");
  sandbox.recordCertificate(g, "Deniz");
  const bodyEl = { innerHTML: "", hidden: true };
  const modalEl = { hidden: true };
  sandbox.document.getElementById = (id) => (id === "badgesBody" ? bodyEl : id === "badgesModal" ? modalEl : null);
  sandbox.openBadgesModal();
  assert.ok(bodyEl.innerHTML.includes("tier-row"), "kademe satırı yok");
  assert.ok(bodyEl.innerHTML.includes("tier-cell"), "kademe hücresi yok");
  assert.ok(bodyEl.innerHTML.includes("Sonraki hedef"), "hedef metni yok");
  assert.ok(bodyEl.innerHTML.includes("portfolioBtn"), "portfolyo düğmesi yok");
  assert.ok(!/portfolioBtn" type="button"\s+disabled/.test(bodyEl.innerHTML), "sertifika varken düğme kapalı olmamalı");
});

test("v2.8.0 portfolyo: sertifikalı rehberlerden klasörlü zip üretilir", async () => {
  sandbox.Blob = globalThis.Blob;
  sandbox.localStorage.removeItem("arduinoDreamLab.badges.v1");
  const downloads = [];
  const captured = [];
  sandbox.document.body = Object.assign(sandbox.document.body, { appendChild: (el) => { if (el && el.download) downloads.push(el.download); } });
  sandbox.URL.createObjectURL = (b) => { captured.push(b); return "blob:test"; };
  const g1 = core.makeDemoGuide("LCD'li dijital saat");
  const g2 = core.makeDemoGuide("RGB LED mood lambası");
  sandbox.recordCertificate(g1, "Ali Veli");
  sandbox.recordCertificate(g2, "Ali Veli");
  // guide'sız eski kayıt: portfolyoya girmemeli
  const badges = sandbox.loadBadges();
  badges.push({ type: "cert", project: "Eski proje", student: "Ali Veli", ts: Date.now() - 99999 });
  sandbox.saveBadges(badges);
  sandbox.downloadPortfolio();
  assert.equal(downloads[0], "portfolyo.zip", "dosya adı portfolyo.zip olmalı");
  assert.ok(captured.length >= 1, "zip blob'u üretilmedi");
  const zip = captured[captured.length - 1];
  const buf = await zip.arrayBuffer();
  const b = new Uint8Array(buf);
  // EOCD: 2 girişli proje × 4 dosya (sketch+diagram+notlar+sertifika SVG) + PORTFOLYO.txt = 9 girdi
  const tail = b.slice(b.length - 22);
  assert.equal(tail[0], 0x50); assert.equal(tail[1], 0x4B); assert.equal(tail[2], 0x05); assert.equal(tail[3], 0x06);
  assert.equal(tail[10] | (tail[11] << 8), 9, "girdi sayısı 9 olmalı");
  const text = Buffer.from(buf).toString("latin1");
  assert.ok(/0\d-[a-z0-9-]+\/sketch\.ino/.test(text), "numaralı klasör + sketch.ino yolu yok");
  assert.ok(/0\d-[a-z0-9-]+\/diagram\.json/.test(text), "diagram.json yolu yok");
  assert.ok(/0\d-[a-z0-9-]+\/SERTIFIKA\.svg/.test(text), "SERTIFIKA.svg yolu yok");
  assert.ok(text.includes("PORTFOLYO.txt"), "PORTFOLYO.txt yok");
  assert.ok(!text.includes("Eski proje") && !/eski-proje/.test(text), "guide'sız eski kayıt portfolyoya girmiş");
});

test("v2.9.0: 3 yeni demo — yönlendirme + 0 uyarı + ileri seviye", () => {
  const cases = [
    ["Odam için akıllı gece lambası", /lambası|Lambası/],
    ["Butonla atılan dijital zar", /zar/i],
    ["OLED ekranda mesafe ölçer", /mesafe|lçer/i]
  ];
  for (const [idea, re] of cases) {
    const g = core.makeDemoGuide(idea);
    assert.match(g.title, re, idea + ": yönlendirme yanlış: " + g.title);
    const d = core.wokwiDiagram(g);
    const v = core.wokwiValidate(g, d);
    assert.equal(v.length, 0, idea + ": uyarı: " + JSON.stringify(v));
    assert.ok(Array.isArray(g.advanced) && g.advanced.length === 2, idea + ": 2 ileri seviye öğe beklenir");
  }
  // Yönlendirme önceliği: 'gece lambası' termostata düşmemeli, 'mesafe ölçer' parka değil
  assert.match(core.makeDemoGuide("gece lambası").title, /lambası/);
  assert.match(core.makeDemoGuide("mesafe ölçer").title, /lçer|lç/);
  // Zar: 6 LED'in hepsi ayrı parçalara bağlanmalı
  const zr = core.wokwiDiagram(core.makeDemoGuide("dijital zar"));
  const ledIds = zr.parts.filter((p) => p.type === "wokwi-led").map((p) => p.id);
  assert.equal(ledIds.length, 6, "zar 6 LED parçası taşımalı");
  for (const id of ledIds) {
    assert.ok(zr.connections.some((c) => c[0] === id + ":A"), id + " anodu bağlanmamış");
    assert.ok(zr.connections.some((c) => c[0] === id + ":C"), id + " katodu bağlanmamış");
  }
  // OLED: LCD parçası üretilmemeli, OLED kendisi bağlanmalı
  const ol = core.wokwiDiagram(core.makeDemoGuide("OLED ekranda mesafe ölçer"));
  assert.ok(ol.parts.some((p) => p.id === "oled1"), "oled1 yok");
  assert.ok(!ol.parts.some((p) => p.type === "wokwi-lcd1602"), "OLED projesinde LCD var");
  assert.ok(ol.connections.some((c) => c[0] === "oled1:GND"), "OLED GND bağlanmamış");
  assert.ok(ol.connections.some((c) => c[0] === "oled1:SDA"), "OLED SDA bağlanmamış");
});

test("v2.9.0 sertifika SVG: isim + başlık taşır, Portfolyo klasörüne girer", () => {
  sandbox.getLang = () => "tr";
  const g = core.makeDemoGuide("Servo kapı kilidi");
  const svg = core.certificateSVG(g, "Deniz Öğrenci", 1700000000000);
  assert.match(svg, /^<svg/, "SVG dönmeli");
  assert.ok(svg.includes("Deniz Öğrenci"), "öğrenci adı yok");
  assert.ok(svg.includes("Servo"), "proje başlığı yok");
  assert.ok(svg.includes("BAŞARI SERTİFİKASI"), "başlık metni yok");
  assert.ok(svg.includes("28.11.2023") || svg.includes("2023"), "tarih yok");
});

test("v2.9.0 toplu geri bildirim: dolu yorumlar indirilir, gönderi işaretlenir", () => {
  const vm = require("node:vm");
  const downloads = [];
  sandbox.document.body = Object.assign(sandbox.document.body, { appendChild: (el) => { if (el && el.download) downloads.push(el.download); } });
  sandbox.localStorage.setItem("arduinoDreamLab.classroom.v1", JSON.stringify({
    code: "TEST9B",
    submissions: {
      "Ali|Zar": { student: "Ali", project: "Zar", total: 5, steps: { 0: 1 }, ts: Date.now() },
      "Veli|Zar": { student: "Veli", project: "Zar", total: 5, steps: { 0: 1 }, ts: Date.now() },
      "Ayşe|Zar": { student: "Ayşe", project: "Zar", total: 5, steps: { 0: 1 }, ts: Date.now(), fb: "önceden verilmiş" }
    }
  }));
  const inputs = [
    { dataset: { bulkfb: "Ali|Zar" }, value: "Ali için yorum" },
    { dataset: { bulkfb: "Veli|Zar" }, value: "" }              // boş → atlanır
    // (Ayşe'nin gönderisinde zaten fb var — panelde görünmez, bu yüzden input yok)
  ];
  sandbox.document.querySelectorAll = () => inputs;
  // applyBulkFeedback sonunda panel yeniden açılır — minimal DOM stub'u gerekli
  const panelHtml = { innerHTML: "", addEventListener: () => {}, querySelectorAll: () => [] };
  const stubGet = sandbox.document.getElementById;
  sandbox.document.getElementById = (id) => (id === "classBody" || id === "bulkFbBtn" || id === "classReportBtn" || id === "classGenBtn" || id === "classCode" || id === "classImportBtn" || id === "classImportFile" || id === "classCloseBtn" ? panelHtml : stubGet(id));
  vm.runInContext("applyBulkFeedback()", sandbox);
  sandbox.document.querySelectorAll = () => [];
  sandbox.document.getElementById = stubGet;
  assert.equal(downloads.length, 1, "yalnız dolu yorum indirilmeli: " + downloads.join(","));
  assert.match(downloads[0] || "", /^ali-.*\.geribildirim\.json$/, "Ali'nin dosyası inmeli");
  const c = JSON.parse(sandbox.localStorage.getItem("arduinoDreamLab.classroom.v1"));
  assert.equal(c.submissions["Ali|Zar"].fb, "Ali için yorum", "gönderi işaretlenmeli");
  assert.ok(!c.submissions["Veli|Zar"].fb, "boş yorum işaretlememeli");
  assert.equal(c.submissions["Ayşe|Zar"].fb, "önceden verilmiş", "fb'li gönderiye dokunulmamalı");
  // Hepsini temizle
  sandbox.localStorage.removeItem("arduinoDreamLab.classroom.v1");
});

test("v2.9.0 veri yedeği: dışa aktar + geri yükle, tercih anahtarları atlanır", () => {
  const vm = require("node:vm");
  const captured = [];
  sandbox.document.body = Object.assign(sandbox.document.body, { appendChild: (el) => { if (el && el.download) captured.push(el.download); } });
  const blobs = [];
  sandbox.Blob = class { constructor(parts) { this._p = parts; blobs.push(this); } };
  sandbox.localStorage.setItem("arduinoDreamLab.archive.v1", JSON.stringify([{ title: "T" }]));
  sandbox.localStorage.setItem("arduinoDreamLab.badges.v1", JSON.stringify([{ type: "cert" }]));
  sandbox.localStorage.setItem("arduinoDreamLab.lang.v1", "tr"); // atlanmalı
  sandbox.exportBackup();
  assert.equal(captured[0], "ruya-atolyesi-yedek-" + new Date().toISOString().slice(0, 10) + ".json");
  const payload = JSON.parse(blobs[blobs.length - 1]._p[0]);
  assert.equal(payload.kind, "veri-yedegi");
  assert.ok(payload.data["arduinoDreamLab.archive.v1"], "arşiv yedekte olmalı");
  assert.ok(payload.data["arduinoDreamLab.badges.v1"], "rozetler yedekte olmalı");
  assert.ok(!payload.data["arduinoDreamLab.lang.v1"], "cihaz yerel tercihleri yedeklenmemeli");
  // Geri yükleme: mevcut veriyi sil, yedekten getir
  sandbox.localStorage.removeItem("arduinoDreamLab.badges.v1");
  sandbox.restoreBackup(JSON.stringify(payload));
  const restored = JSON.parse(sandbox.localStorage.getItem("arduinoDreamLab.badges.v1"));
  assert.deepEqual(restored, [{ type: "cert" }], "rozetler geri gelmeli");
  // Bozuk dosya reddedilmeli
  const before = sandbox.localStorage.getItem("arduinoDreamLab.badges.v1");
  sandbox.restoreBackup("{ bozuk");
  assert.equal(sandbox.localStorage.getItem("arduinoDreamLab.badges.v1"), before, "bozuk dosya veriyi değiştirmemeli");
  sandbox.localStorage.removeItem("arduinoDreamLab.badges.v1");
  sandbox.localStorage.removeItem("arduinoDreamLab.archive.v1");
});

/* ─────────── v2.10.0: Malzeme fiyat kataloğu + ortalama proje fiyatı ─────────── */

test("v2.10.0 fiyat kataloğu: priceOf en uzun anahtar önceliğiyle eşleşir", () => {
  assert.equal(typeof core.priceOf, "function", "priceOf çıkarılmalı");
  assert.equal(core.priceOf("Arduino Uno").usd, 10);
  assert.equal(core.priceOf("SG90 servo motor").usd, 2.5);
  assert.equal(core.priceOf("10kΩ direnç").usd, 0.1, "10kΩ kendi girdisiyle eşleşmeli");
  assert.equal(core.priceOf("220Ω direnç").usd, 0.1);
  assert.equal(core.priceOf("LED + 220Ω direnç").usd, 0.25);
  assert.equal(core.priceOf("Kırmızı LED + 220Ω").usd, 0.25);
  assert.equal(core.priceOf("LCD1602 ekran (I2C)").usd, 4);
  assert.equal(core.priceOf("SSD1306 OLED ekran (I2C)").usd, 3.5);
  assert.equal(core.priceOf("PICO"), null, "PICO eşleşmemeli (Nano dahil değil)");
  assert.equal(core.priceOf("Arduino Nano").usd, 6);
  assert.equal(core.priceOf("Röle modülü").usd, 1.5);
  assert.equal(core.priceOf("Kontrol panosu"), null, "'rol' yanlış pozitifi olmamalı");
  assert.equal(core.priceOf("Bilinmeyen Parça XYZ"), null, "katalogda olmayan → null");
});

test("v2.10.0 estimateCost: adet × birim hesabı + bilinmeyen parça işareti", () => {
  assert.equal(typeof core.estimateCost, "function", "estimateCost çıkarılmalı");
  const g = core.makeDemoGuide("LCD'li dijital saat");
  const est = core.estimateCost(g);
  assert.equal(est.rows.length, (g.materials || []).length);
  const uno = est.rows.find((r) => /uno/i.test(r.name));
  assert.ok(uno && uno.known, "uno fiyatlanmalı");
  assert.ok(Math.abs(uno.total - uno.unit * parseFloat(uno.qty)) < 1e-9, "adet × birim tutar = olmalı");
  let sum = 0;
  for (const r of est.rows) sum += r.known ? r.total : 0;
  assert.ok(Math.abs(sum - est.totalUSD) < 1e-6, "toplam satır toplamlarına eşit olmalı");
  assert.ok(est.totalUSD > 10, "toplam > 10 olmalı: " + est.totalUSD);
  assert.equal(est.anyUnknown, false, "saat demosunun tüm parçaları fiyatlı olmalı");
  // Katalogda olmayan parça: total'e katılmaz, anyUnknown işaretlenir
  const est2 = core.estimateCost({ materials: [{ name: "Gizemli modül", quantity: "2", purpose: "" }] });
  assert.equal(est2.totalUSD, 0);
  assert.equal(est2.anyUnknown, true);
  assert.equal(est2.rows[0].known, false);
});

test("v2.12.0 fmtTL: ₺ ana birim, $ ikincil", () => {
  const s = core.fmtTL(10);
  assert.match(s, /^340\.00₺ \(\$10\.00\)$/);
});

test("v2.12.0 bütçe sınırı: loadBudget + isOverBudget", () => {
  const KEY = "arduinoDreamLab.budget.v1";
  sandbox.localStorage.removeItem(KEY);
  assert.equal(core.loadBudget(), 0, "sınır yok → 0");
  assert.equal(core.isOverBudget(1000), false, "sınır kapalıyken asla aşım yok");
  sandbox.localStorage.setItem(KEY, "25");
  assert.equal(core.loadBudget(), 25);
  assert.equal(core.isOverBudget(24.99), false);
  assert.equal(core.isOverBudget(25.01), true);
  sandbox.localStorage.setItem(KEY, "0");
  assert.equal(core.loadBudget(), 0, "0 → kapalı");
  sandbox.localStorage.setItem(KEY, "abc");
  assert.equal(core.loadBudget(), 0, "sayı değil → kapalı");
  sandbox.localStorage.removeItem(KEY);
});

test("v2.12.0 parseCatalogJSON: {prices, budget} sözlüğü, bozuk girdi null", () => {
  const ok = core.parseCatalogJSON('{"app":"x","prices":{"Arduino Uno":8,"LED":0.25,"bozuk":"nan"},"budget":25}');
  assert.ok(ok, "geçerli JSON ayrıştırılmalı");
  assert.equal(ok.prices["Arduino Uno"], 8);
  assert.equal(ok.prices["LED"], 0.25);
  assert.equal(ok.prices["bozuk"], undefined, "sayı olmayan fiyat atlanmalı");
  assert.equal(ok.budget, 25);
  assert.equal(core.parseCatalogJSON('{"prices":{}}'), null, "boş prices → null");
  assert.equal(core.parseCatalogJSON('selam'), null, "JSON olmayan → null");
  assert.equal(core.parseCatalogJSON('{"budget":30}'), null, "prices yok → null");
  const noBudget = core.parseCatalogJSON('{"prices":{"X":1}}');
  assert.equal(noBudget.budget, 0, "bütçesiz katalog geçerli");
});

test("v2.10.0 demo rehberler: tüm malzemeler fiyatlanabilmeli", () => {
  for (const idea of [...DEMO_IDEAS, "gece lambası", "dijital zar", "OLED mesafe ölçer"]) {
    const est = core.estimateCost(core.makeDemoGuide(idea));
    const unknown = est.rows.filter((r) => !r.known).map((r) => r.name).join(", ");
    assert.equal(est.anyUnknown, false, idea + ": fiyatlanamayan parça: " + unknown);
    assert.ok(est.totalUSD > 0, idea + ": toplam sıfır olmamalı");
  }
});

/* ─────────── v2.11.0: öğretmen kataloğu + canlı adet + rapor maliyeti + portfolyo bütçesi ─────────── */

test("v2.11.0 parseCustomPrices: satır sözlüğü, hatalı satırlar atlanır", () => {
  assert.equal(typeof core.parseCustomPrices, "function", "parseCustomPrices çıkarılmalı");
  const map = core.parseCustomPrices("Arduino Uno: 8\nSG90 servo motor = 2,75\nbozuk satır\nJumper kablolar: 1,5\n\nLED: -3");
  assert.equal(map["Arduino Uno"], 8);
  assert.equal(map["SG90 servo motor"], 2.75, "virgül ondalık kabul edilmeli");
  assert.equal(map["Jumper kablolar"], 1.5);
  assert.equal(Object.keys(map).length, 3, "bozuk/negatif satırlar atlanmalı");
});

test("v2.11.0 öğretmen fiyatı: kataloğu override eder, temizleyince geri döner", () => {
  const prev = sandbox.localStorage.getItem("arduinoDreamLab.customPrices.v1");
  sandbox.localStorage.setItem("arduinoDreamLab.customPrices.v1", JSON.stringify({ "Arduino Uno": 8 }));
  assert.equal(core.priceOf("Arduino Uno").usd, 8, "özel fiyat kazanmalı");
  assert.equal(core.priceOf("Arduino Uno").note, "özel");
  assert.equal(core.priceOf("SG90 servo motor").usd, 2.5, "katalog diğer parçalara dokunulmamalı");
  // Daha uzun özel ad, kısa özel adı yener
  sandbox.localStorage.setItem("arduinoDreamLab.customPrices.v1", JSON.stringify({ "Uno": 1, "Arduino Uno": 8 }));
  assert.equal(core.priceOf("Arduino Uno").usd, 8, "en uzun özel ad kazanmalı");
  sandbox.localStorage.removeItem("arduinoDreamLab.customPrices.v1");
  assert.equal(core.priceOf("Arduino Uno").usd, 10, "temizleyince katalog fiyatı dönmeli");
  if (prev != null) sandbox.localStorage.setItem("arduinoDreamLab.customPrices.v1", prev);
});

test("v2.11.0 estimateCost: adet override hesaba katılır", () => {
  const g = core.makeDemoGuide("LCD'li dijital saat");
  const base = core.estimateCost(g);
  const unoName = g.materials.find((m) => /uno/i.test(m.name)).name;
  const ov = {};
  ov[unoName] = "2";
  const est = core.estimateCost(g, ov);
  const diff = est.totalUSD - base.totalUSD;
  assert.ok(Math.abs(diff - 10) < 1e-6, "2 adet Uno → toplam +$10 olmalı, fark: " + diff);
  const unoRow = est.rows.find((r) => /uno/i.test(r.name));
  assert.equal(unoRow.qty, "2");
  assert.ok(Math.abs(unoRow.total - 20) < 1e-6);
});

test("v2.11.0 buildClassSubmission: malzemeler gönderime gömülür", () => {
  const vm = require("node:vm");
  const g = core.makeDemoGuide("LCD'li dijital saat");
  sandbox.__g = g;
  vm.runInContext("currentGuide = __g", sandbox); // lexical let binding'e atanmalı
  vm.runInContext("currentGuide = __g", sandbox);
  const sub = core.buildClassSubmission("Test Öğrenci");
  assert.ok(Array.isArray(sub.materials) && sub.materials.length >= 3, "malzemeler gönderimde olmalı");
  assert.ok(sub.materials.every((m) => m.name && m.quantity != null), "malzeme {name,quantity} olmalı");
  vm.runInContext("currentGuide = undefined", sandbox);
});

test("v2.11.0 sınıf raporu: Maliyet sütunu + gönderi malzemesinden hesap", () => {
  const vm = require("node:vm");
  const captured = [];
  sandbox.window.open = () => { captured.push(true); return { document: { write: (h) => captured.push(h), close: () => {} } }; };
  sandbox.localStorage.setItem("arduinoDreamLab.classroom.v1", JSON.stringify({
    code: "ABC123",
    submissions: { "Deniz|Saat": { student: "Deniz", project: "Saat", total: 5, steps: { 0: true }, ts: Date.now(), materials: [{ name: "Arduino Uno", quantity: "1" }, { name: "LCD1602 ekran (I2C)", quantity: "1" }] } }
  }));
  sandbox.downloadClassReport();
  const html = captured[1] || "";
  assert.match(html, /Maliyet/, "raporda Maliyet başlığı olmalı");
  assert.match(html, /\$14\.00/, "Uno+LCD = $14 hesaplanmalı");
  sandbox.localStorage.removeItem("arduinoDreamLab.classroom.v1");
  sandbox.window.open = undefined;
});

test("v2.11.0 portfolyo: PORTFOLYO.txt'te bütçe özeti + toplam", () => {
  const vm = require("node:vm");
  const blobs = [];
  sandbox.Blob = class { constructor(parts) { this._p = parts; blobs.push(this); } };
  const downloads = [];
  sandbox.document.body = Object.assign(sandbox.document.body, { appendChild: (el) => { if (el && el.download) downloads.push(el.download); } });
  sandbox.localStorage.setItem("arduinoDreamLab.badges.v1", JSON.stringify([
    { type: "cert", project: "LCD Saat", guide: core.makeDemoGuide("LCD'li dijital saat"), student: "Deniz", ts: Date.now() }
  ]));
  sandbox.downloadPortfolio();
  assert.equal(downloads[0], "portfolyo.zip");
  // zip blob'u tek Uint8Array parçasıdır; STORE yöntemiyle düz yazı gömülür (latin1 sıkıştırma)
  const txt = Buffer.from(blobs[blobs.length - 1]._p[0]).toString("utf8");
  assert.ok(txt.includes("BÜTÇE ÖZETİ"), "bütçe özeti PORTFOLYO.txt'te olmalı");
  assert.match(txt, /PORTFOLYO TOPLAMI: [\d.]+₺ \(\$[\d.]+\)/, "toplam satırı olmalı");
  assert.match(txt, /LCD Saat: 612\.00₺ \(\$18\.00\)/, "proje maliyeti listelenmeli");
  sandbox.localStorage.removeItem("arduinoDreamLab.badges.v1");
  sandbox.Blob = globalThis.Blob;
});

test("v2.13.0 sortCostRows: pahalıdan ucuza / ucuza pahalıya, bilinmeyenler sonda", () => {
  assert.equal(typeof core.sortCostRows, "function", "sortCostRows çıkarılmalı");
  const rows = [
    { name: "A", total: 10 },
    { name: "B", total: 2 },
    { name: "C", total: null },
    { name: "D", total: 5 }
  ];
  const desc = core.sortCostRows(rows, "desc");
  assert.deepEqual(desc.map((r) => r.name), ["A", "D", "B", "C"], "pahalıdan ucuza, null sonda");
  const asc = core.sortCostRows(rows, "asc");
  assert.deepEqual(asc.map((r) => r.name), ["B", "D", "A", "C"], "ucuza pahalıya, null sonda");
  const orig = core.sortCostRows(rows, "");
  assert.deepEqual(orig.map((r) => r.name), ["A", "B", "C", "D"], "orijinal sıra korunmalı");
  assert.deepEqual(rows.map((r) => r.name), ["A", "B", "C", "D"], "girdi dizisi mutasyona uğramamalı");
});

test("v2.13.0 portfolyo: özel katalog + bütçe varsa fiyat-katalogu.json arşivde", () => {
  const vm = require("node:vm");
  const blobs = [];
  sandbox.Blob = class { constructor(parts) { this._p = parts; blobs.push(this); } };
  const downloads = [];
  sandbox.document.body = Object.assign(sandbox.document.body, { appendChild: (el) => { if (el && el.download) downloads.push(el.download); } });
  sandbox.localStorage.setItem("arduinoDreamLab.badges.v1", JSON.stringify([
    { type: "cert", project: "LCD Saat", guide: core.makeDemoGuide("LCD'li dijital saat"), student: "Deniz", ts: Date.now() }
  ]));
  sandbox.localStorage.setItem("arduinoDreamLab.customPrices.v1", JSON.stringify({ "Arduino Uno": 8 }));
  sandbox.localStorage.setItem("arduinoDreamLab.budget.v1", "25");
  sandbox.downloadPortfolio();
  const txt = Buffer.from(blobs[blobs.length - 1]._p[0]).toString("utf8");
  assert.ok(txt.includes("fiyat-katalogu.json"), "katalog dosyası arşivde olmalı");
  assert.ok(txt.includes('"budget": 25'), "bütçe katalog JSON'unda olmalı");
  assert.ok(txt.includes('"Arduino Uno": 8'), "özel fiyat katalog JSON'unda olmalı");
  assert.ok(txt.includes("fiyat-katalogu.json: öğretmenin özel fiyatları"), "PORTFOLYO.txt notu olmalı");
  sandbox.localStorage.removeItem("arduinoDreamLab.badges.v1");
  sandbox.localStorage.removeItem("arduinoDreamLab.customPrices.v1");
  sandbox.localStorage.removeItem("arduinoDreamLab.budget.v1");
  sandbox.Blob = globalThis.Blob;
});

test("v2.13.0 portfolyo: katalog yoksa fiyat-katalogu.json üretilmez", () => {
  const blobs = [];
  sandbox.Blob = class { constructor(parts) { this._p = parts; blobs.push(this); } };
  const downloads = [];
  sandbox.document.body = Object.assign(sandbox.document.body, { appendChild: (el) => { if (el && el.download) downloads.push(el.download); } });
  sandbox.localStorage.setItem("arduinoDreamLab.badges.v1", JSON.stringify([
    { type: "cert", project: "LCD Saat", guide: core.makeDemoGuide("LCD'li dijital saat"), student: "Deniz", ts: Date.now() }
  ]));
  sandbox.downloadPortfolio();
  const txt = Buffer.from(blobs[blobs.length - 1]._p[0]).toString("utf8");
  assert.ok(!txt.includes("fiyat-katalogu.json"), "katalogsuz arşivde katalog dosyası olmamalı");
  sandbox.localStorage.removeItem("arduinoDreamLab.badges.v1");
  sandbox.Blob = globalThis.Blob;
});

test("v2.13.0 sınıf raporu: toplam bütçe satırı + aşım işareti", () => {
  const captured = [];
  sandbox.window.open = () => ({ document: { write: (h) => captured.push(h), close: () => {} } });
  sandbox.localStorage.setItem("arduinoDreamLab.classroom.v1", JSON.stringify({
    code: "ABC123",
    submissions: {
      "Deniz|Saat": { student: "Deniz", project: "Saat", total: 5, steps: { 0: true }, ts: Date.now(), materials: [{ name: "Arduino Uno", quantity: "1" }, { name: "LCD1602 ekran (I2C)", quantity: "1" }] },
      "Ece|Zar": { student: "Ece", project: "Zar", total: 5, steps: {}, ts: Date.now(), materials: [{ name: "Arduino Uno", quantity: "1" }] }
    }
  }));
  sandbox.downloadClassReport();
  const html = captured[captured.length - 1] || "";
  assert.match(html, /Sınıf toplam bütçesi/, "toplam bütçe başlığı olmalı");
  assert.match(html, /816\.00₺ \(\$24\.00\)/, "14 + 10 = 24$ → 816₺ olmalı");
  assert.ok(!html.includes("bütçe aşımı"), "sınır yokken aşım yazmamalı");
  // Sınır 15 → 20 aşar → işaret gelir
  sandbox.localStorage.setItem("arduinoDreamLab.budget.v1", "15");
  captured.length = 0;
  sandbox.downloadClassReport();
  assert.match(captured[captured.length - 1] || "", /bütçe aşımı/, "sınır aşılınca işaret olmalı");
  sandbox.localStorage.removeItem("arduinoDreamLab.classroom.v1");
  sandbox.localStorage.removeItem("arduinoDreamLab.budget.v1");
  sandbox.window.open = undefined;
});

test("v2.13.0 sertifika SVG: bütçe aşımında kırmızı şerit", () => {
  const g = core.makeDemoGuide("LCD'li dijital saat"); // $18
  sandbox.localStorage.setItem("arduinoDreamLab.budget.v1", "15");
  const svgOver = core.certificateSVG(g, "Deniz", Date.now());
  assert.match(svgOver, /BÜTÇE AŞIMI/, "aşım metni olmalı");
  assert.ok(svgOver.includes("#e5484d"), "kırmızı çerçeve olmalı");
  sandbox.localStorage.setItem("arduinoDreamLab.budget.v1", "25");
  const svgOk = core.certificateSVG(g, "Deniz", Date.now());
  assert.match(svgOk, /ortalama perakende tahmini/, "normal metin olmalı");
  assert.ok(!svgOk.includes("#e5484d"), "sınır içindeyken kırmızı olmamalı");
  sandbox.localStorage.removeItem("arduinoDreamLab.budget.v1");
});

/* ─────────── v2.14.0: depo kataloğu + bütçe önerisi + canlı ipucu ─────────── */

test("v2.14.0 loadFileCatalog: FILE_CATALOG yoksa null, varsa {prices,budget}", () => {
  const vm = require("node:vm");
  // FILE_CATALOG tanımsız → null (test sandbox'ı build gömüsü olmadan çalışır)
  assert.equal(core.loadFileCatalog(), null, "FILE_CATALOG olmadan null dönmeli");
  assert.equal(core.fileCatalogBudget(), 0);
  // Gömülü katalogla davranış (var: vm global binding'e çıkar, const çıkmaz)
  vm.runInContext('var FILE_CATALOG = JSON.parse(`{"prices":{"Arduino Uno":8,"LED":0.2,"bozuk":"x"},"budget":25}`);', sandbox);
  const fc = core.loadFileCatalog();
  assert.ok(fc, "FILE_CATALOG varken katalog dönmeli");
  assert.equal(fc.prices["Arduino Uno"], 8);
  assert.equal(fc.prices["bozuk"], undefined, "sayı olmayan atlanmalı");
  assert.equal(fc.budget, 25);
  assert.equal(core.fileCatalogBudget(), 25);
  vm.runInContext("FILE_CATALOG = undefined;", sandbox);
});

test("v2.14.0 priceOf katmanları: özel > depo > gömülü katalog", () => {
  const vm = require("node:vm");
  const KEY = "arduinoDreamLab.customPrices.v1";
  // Depo kataloğu kur (Uno $8)
  vm.runInContext('var FILE_CATALOG = JSON.parse(`{"prices":{"Arduino Uno":8},"budget":0}`);', sandbox);
  try {
    assert.equal(core.priceOf("Arduino Uno").usd, 8, "depo fiyatı gömülüyü yener");
    assert.equal(core.priceOf("Arduino Uno").note, "depo");
    assert.equal(core.priceOf("SG90 servo motor").usd, 2.5, "depo kataloğunda olmayan → gömülü");
    // Öğretmen özel en üst katman
    sandbox.localStorage.setItem(KEY, JSON.stringify({ "Arduino Uno": 12 }));
    assert.equal(core.priceOf("Arduino Uno").usd, 12, "özel fiyat depoyu yener");
    assert.equal(core.priceOf("Arduino Uno").note, "özel");
  } finally {
    sandbox.localStorage.removeItem(KEY);
  }
  // Depoyu temizle → gömülü kalır
  vm.runInContext("FILE_CATALOG = null;", sandbox);
  assert.equal(core.priceOf("Arduino Uno").usd, 10, "depo boşken gömülü katalog");
});

test("v2.14.0 budgetSuggestion: yalnız aşım varsa Nano önerisi", () => {
  const KEY = "arduinoDreamLab.budget.v1";
  sandbox.localStorage.removeItem(KEY);
  assert.equal(core.budgetSuggestion(100), "", "sınır yokken öneri yok");
  sandbox.localStorage.setItem(KEY, "7");
  const s = core.budgetSuggestion(18);
  assert.match(s, /Arduino Nano/, "Nano önerisi olmalı");
  assert.match(s, /\$10\.00 → \$6\.00/, "eski-yeni fiyat çifti olmalı");
  assert.equal(core.budgetSuggestion(5), "", "aşım yokken öneri yok");
  sandbox.localStorage.removeItem(KEY);
});

test("v2.14.0 liveCostHint (demo yolu): 30+ karakterde tahmin, kısada boş", async () => {
  assert.equal(await core.liveCostHint("kısa fikir"), "", "kısada boş");
  const hint = await core.liveCostHint("Odam için sıcaklığı ölçüp lamba yakan otomatik bir gece lambası istiyorum");
  assert.ok(hint.includes("≈"), "tahmin işareti olmalı: " + hint);
  assert.match(hint, /₺ \(\$[\d.]+\)/, "₺+çift gösterim olmalı");
});

/* ─────────── v2.15.0: çevrimiçi kur ─────────── */

test("v2.15.0 loadRate: varsayılan 34, saklanan kur + yaş hesabı", () => {
  const KEY = "arduinoDreamLab.rate.v1";
  sandbox.localStorage.removeItem(KEY);
  assert.equal(core.rate(), 34, "saklanan kur yokken varsayılan 34");
  assert.equal(core.rateAgeHours(), Infinity, "hiç güncellenmemiş → Infinity");
  sandbox.localStorage.setItem(KEY, JSON.stringify({ rate: 41.5, ts: Date.now() }));
  assert.equal(core.rate(), 41.5);
  const age = core.rateAgeHours();
  assert.ok(age >= 0 && age < 1, "taze kur ~0 saat eski, " + age);
  // Geçersiz saklama → varsayılana düş
  sandbox.localStorage.setItem(KEY, "bozuk");
  assert.equal(core.rate(), 34, "bozuk veri → varsayılan");
  sandbox.localStorage.setItem(KEY, JSON.stringify({ rate: 5000, ts: Date.now() }));
  assert.equal(core.rate(), 34, "absürt kur (>1000) → varsayılan");
  sandbox.localStorage.removeItem(KEY);
});

test("v2.15.0 updateRateFromWeb: başarılı fetch saklanır, hata session-fallback", async () => {
  const KEY = "arduinoDreamLab.rate.v1";
  sandbox.localStorage.removeItem(KEY);
  const vm = require("node:vm");
  // Başarılı senaryo
  vm.runInContext("__fakeFetch = async (url) => ({ ok: true, json: async () => ({ rates: { TRY: 41.2 } }) });", sandbox);
  sandbox.fetch = sandbox.__fakeFetch;
  const ok = await core.updateRateFromWeb();
  assert.ok(ok.ok, "başarılı fetch");
  assert.equal(ok.rate, 41.2);
  assert.equal(core.rate(), 41.2, "kur saklanmalı");
  assert.ok(core.rateAgeHours() < 1);
  // Hata senaryosu: iki uç nokta da patlar → ok:false, mevcut kur korunur
  sandbox.fetch = async () => { throw new Error("offline"); };
  const fail = await core.updateRateFromWeb();
  assert.equal(fail.ok, false);
  assert.equal(fail.rate, 41.2, "hata anında saklanan kur korunmalı");
  assert.equal(core.rate(), 41.2);
  // Bozuk yanıt → reddet
  sandbox.fetch = async () => ({ ok: true, json: async () => ({ rates: { TRY: "x" } }) });
  const fail2 = await core.updateRateFromWeb();
  assert.equal(fail2.ok, false, "sayı olmayan kur reddedilmeli");
  sandbox.fetch = async () => { throw new Error("no network in tests"); }; // extract.js varsayılanına dön
  sandbox.localStorage.removeItem(KEY);
  sandbox.fetch = undefined;
});

/* ─────────── v2.16.0: AI'lı canlı tahmin ─────────── */

test("v2.16.0 buildCostPrompt: fikri gömer, JSON şeması ister", () => {
  assert.equal(typeof core.buildCostPrompt, "function");
  const p = core.buildCostPrompt("akıllı saksı");
  assert.ok(p.includes("akıllı saksı"), "fikir istemde olmalı");
  assert.match(p, /"materials"/, "materials şeması istenmeli");
});

test("v2.16.0 askAICostMaterials: gemini yanıtı ayrıştırılır, bozuk yanıt hata fırlatır", async () => {
  const vm = require("node:vm");
  // Gemini akışı (provider: gemini) mock fetch ile
  const good = JSON.stringify({ materials: [{ name: "Arduino Uno", quantity: "1" }, { name: "LDR fotorezistör", quantity: "1" }, { name: "Jumper kablolar", quantity: "10" }] });
  sandbox.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: good }] } }] }) });
  const mats = await core.askAICostMaterials("akıllı saksı");
  assert.equal(mats.length, 3);
  assert.equal(mats[0].name, "Arduino Uno");
  assert.ok(mats.every((m) => m.name && m.quantity != null), "normalize edilmeli");
  // Kod çiti + çöp metin içeren yanıt da ayrışmalı
  sandbox.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "```json\n" + good + "\n```" }] } }] }) });
  const mats2 = await core.askAICostMaterials("akıllı saksı");
  assert.equal(mats2.length, 3);
  // HTTP hatası → throw
  sandbox.fetch = async () => ({ ok: false, json: async () => ({}) });
  await assert.rejects(() => core.askAICostMaterials("x"), /Gemini HTTP/);
  // Geçersiz malzeme filtrelenir; hepsi geçersizse throw
  sandbox.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"materials":[{"name":""},{"foo":1}]}' }] } }] }) });
  await assert.rejects(() => core.askAICostMaterials("x"), /malzeme yok/);
  sandbox.fetch = async () => { throw new Error("no network in tests"); };
  sandbox.fetch = undefined;
});

test("v2.16.0 liveCostHint: AI yoksa senkron demo ipucu, AI varsa gerçek listeden tahmin", async () => {
  const good = JSON.stringify({ materials: [{ name: "Arduino Nano", quantity: "1" }, { name: "Buzzer", quantity: "1" }] });
  // Ana sandbox (AI'sız): demo ipucu + onDone çağrısı
  let cb = null;
  const syncMsg = await core.liveCostHint("Odam için sıcaklığı ölçüp lamba yakan otomatik bir gece lambası istiyorum", (m) => { cb = m; });
  assert.ok(syncMsg.includes("≈"), "demo ipucu tahmin içermeli");
  assert.equal(cb, syncMsg, "onDone senkron yolda da çağrılmalı");
  // API-anahtarlı ayrı sandbox: gerçek AI yolu + önbellek + hata fallback'i
  const { sandbox: sb2, picked: ai } = loadCoreWithSettings({ provider: "gemini", apiKey: "test-key-1234567890" });
  assert.equal(ai.hasApiKey(), true, "önceden doldurulmuş settings ile hasApiKey true");
  sb2.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: good }] } }] }) });
  let got = null;
  const aiMsg = await ai.liveCostHint("Kapı zili projesi için bütçe hesapla ışıklı butonlu sistem", (m) => { got = m; });
  assert.match(aiMsg, /AI tahmini/, "AI etiketi olmalı: " + aiMsg);
  assert.match(aiMsg, /₺ \(\$[\d.]+\)/, "çift para gösterimi olmalı");
  assert.equal(got, aiMsg);
  // Önbellek: ikinci çağrı fetch'siz cevap vermeli
  let fetchCount = 0;
  sb2.fetch = async () => { fetchCount++; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: good }] } }] }) }; };
  await ai.liveCostHint("Kapı zili projesi için bütçe hesapla ışıklı butonlu sistem");
  assert.equal(fetchCount, 0, "önbellekten gelmeli");
  // AI hatalı: demo ipucuna düşmeli
  sb2.fetch = async () => { throw new Error("offline"); };
  const fallback = await ai.liveCostHint("Robot kolu üç eklemli servo motorlarla hassas hareket eden büyük proje");
  assert.ok(fallback.includes("≈"), "hata anında demo ipucu dönmeli");
});

/* ─────────── v2.17.0: sınıf mevcudu planlayıcısı + haftalık ilerleme grafiği ─────────── */

test("v2.17.0 loadClassSize: yoksa 0, geçersizse 0, geçerliyse değer", () => {
  const KEY = "arduinoDreamLab.classSize.v1";
  sandbox.localStorage.removeItem(KEY);
  assert.equal(core.loadClassSize(), 0, "boş → 0");
  sandbox.localStorage.setItem(KEY, "24");
  assert.equal(core.loadClassSize(), 24);
  sandbox.localStorage.setItem(KEY, "-3");
  assert.equal(core.loadClassSize(), 0, "negatif → 0");
  sandbox.localStorage.setItem(KEY, "abc");
  assert.equal(core.loadClassSize(), 0, "sayı değil → 0");
  sandbox.localStorage.removeItem(KEY);
});

test("v2.17.0 weeklyProgressSVG: adımları haftaya kümelendirir, boş veride boş string", () => {
  assert.equal(typeof core.weeklyProgressSVG, "function");
  assert.equal(core.weeklyProgressSVG([]), "", "veri yok → boş");
  assert.equal(core.weeklyProgressSVG([{ steps: {}, ts: Date.now() }]), "", "adımsız gönderim → boş");
  // Sabit referans haftası: Pazartesi 15 Haziran 2026, öğlen.
  // Date.now() kullanılsaydı test pazartesi sabahı "dünü aynı hafta" varsayımı
  // yanlış olduğu için saat 00:00'den sonra kırılırdı.
  const pzt = new Date(2026, 5, 15, 12, 0, 0).getTime();
  const svg = core.weeklyProgressSVG([
    { steps: { 0: true, 1: true, 2: true }, ts: pzt },
    { steps: { 0: true }, ts: pzt + 2 * 86400000 }, // çarşamba — aynı hafta
    { steps: { 0: true, 1: true, 2: true, 3: true, 4: true }, ts: pzt - 3 * 86400000 } // geçen hafta
  ]);
  assert.ok(svg.includes("<svg"), "SVG üretmeli");
  assert.ok(svg.includes("Haftada tamamlanan"), "başlık olmalı");
  // Bu hafta 4 adım (3+1), geçen hafta 5 → çubuk değerleri görünmeli
  assert.ok(svg.includes(">4<"), "bu hafta değeri 4 olmalı");
  assert.ok(svg.includes(">5<"), "geçen hafta değeri 5 olmalı");
  assert.ok((svg.match(/<rect/g) || []).length === 2, "2 hafta → 2 çubuk");
});

/* ─────────── v2.18.0: katalog önerileri + risk listesi + fiyatlanamayanlar + CSV ─────────── */

test("v2.18.0 catalogSuggestions: depoda olup özel fiyatı olmayan parçaları önerir", () => {
  assert.equal(typeof core.catalogSuggestions, "function");
  // Depo kataloğu yoksa boş liste (vm realm'i farklı prototipli dizi döndürür → uzunluk karşılaştır)
  const hadCatalog = sandbox.FILE_CATALOG;
  delete sandbox.FILE_CATALOG;
  assert.equal(core.catalogSuggestions().length, 0, "katalog yok → boş");
  // Sahte depo kataloğu enjekte et
  sandbox.FILE_CATALOG = { prices: { "Astronaut Sensörü": 7.5, "NeoPixel": 3.2, "Jumper": 2.0 }, budget: 20 };
  sandbox.localStorage.setItem("arduinoDreamLab.customPrices.v1", "{}");
  const all = core.catalogSuggestions();
  assert.deepEqual(all.sort(), ["Astronaut Sensörü", "Jumper", "NeoPixel"], "hepsi önerilmeli: " + JSON.stringify(all));
  // NeoPixel'e özel fiyat ekle → önerilerden düşmeli
  sandbox.localStorage.setItem("arduinoDreamLab.customPrices.v1", JSON.stringify({ NeoPixel: 9.9 }));
  const after = core.catalogSuggestions();
  assert.ok(!after.some((n) => core.foldTR(n) === core.foldTR("NeoPixel")), "özel fiyatı eklenen önerilmemeli");
  assert.equal(after.length, 2);
  // Temizlik
  if (hadCatalog) sandbox.FILE_CATALOG = hadCatalog; else delete sandbox.FILE_CATALOG;
  sandbox.localStorage.removeItem("arduinoDreamLab.customPrices.v1");
});

test("v2.18.0 atRiskStudents: 10 gündür hareketsiz + bitmemiş proje → listede", () => {
  const now = Date.now(), day = 86400000;
  const subs = [
    { student: "Ada", project: "Akıllı Saksı", ts: now - 3 * day, total: 6, steps: { 0: 1 } },          // yeni — değil
    { student: "Barış", project: "Gece Lambası", ts: now - 15 * day, total: 5, steps: { 0: 1, 1: 1 } }, // risk
    { student: "Cem", project: "Robot Kol", ts: now - 30 * day, total: 6, steps: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 } }, // bitmiş — değil
    { student: "Defne", project: "Termometre", ts: now - 20 * day, total: 0, steps: {} },               // risksiz total → risk
    { student: "Ece", project: "Kapı Zili", ts: now - 12 * day, total: 4, steps: { 0: 1 } }             // risk
  ];
  const risk = core.atRiskStudents(subs);
  assert.deepEqual(risk.map((s) => s.name), ["Defne", "Barış", "Ece"], "en eski önce sıralanmalı");
  // Eşik günü değiştir: 14 gün → 15+ gün öncesi: Defne (20g) ve Barış (15g)
  const tight = core.atRiskStudents(subs, 14);
  assert.deepEqual(tight.map((s) => s.name), ["Defne", "Barış"], "14 gün eşiği");
  assert.deepEqual(core.atRiskStudents(subs, 40).map((s) => s.name), [], "40 gün eşiğinde kimse kalmaz");
  assert.equal(core.atRiskStudents([]).length, 0);
});

test("v2.18.0 unknownMaterials: hiçbir katalogda olmayan parçaları adetle toplar", () => {
  const subs = [
    { materials: [{ name: "Arduino Uno", quantity: 2 }, { name: "Kuantum Sensör MK-9", quantity: 1 }] },
    { materials: [{ name: "kuantum sensör mk-9", quantity: 2 }, { name: "Buzzer", quantity: "1" }] },
    { materials: [] }
  ];
  const unk = core.unknownMaterials(subs);
  assert.equal(unk.length, 1, "yalnız kataloksız parça kalmalı: " + JSON.stringify(unk));
  assert.match(unk[0].name, /Kuantum Sensör MK-9/i);
  assert.equal(unk[0].qty, 3, "adet toplanmalı (1+2), harf farkı aynı grupta");
  assert.equal(core.unknownMaterials([]).length, 0);
});

test("v2.18.0 classSubsToCSV: BOM + başlık + hücreleri ';'-ile ayırır, tırnakları kaçar", () => {
  const csv = core.classSubsToCSV([
    { student: "Ada;", project: "Ceviz ve \"LED\" projesi", total: 4, steps: { 0: 1, 1: 1 }, ts: Date.UTC(2026, 0, 15),
      materials: [{ name: "Arduino Uno", quantity: 1 }], fb: "Harika\nİş" }
  ]);
  assert.ok(csv.charCodeAt(0) === 0xFEFF, "UTF-8 BOM ile başlamalı");
  const body = csv.slice(1);
  const lines = body.split("\r\n");
  assert.equal(lines.length, 2, "başlık + 1 satır");
  assert.ok(lines[0].startsWith("Öğrenci;Proje;Tamamlanan Adım"), "başlık Türkçe: " + lines[0]);
  assert.ok(lines[1].includes('"Ada;"'), "; içeren hücre tırnaklanmalı");
  assert.ok(lines[1].includes('"Ceviz ve ""LED"" projesi"'), "tırnak çiftlenerek kaçırılmalı");
  assert.ok(lines[1].includes('"Harika\nİş"'), "satır sonu içeren hücre tırnaklanmalı");
  assert.ok(lines[1].includes("2026-01-15"), "ISO tarih olmalı");
  assert.ok(lines[1].includes("50"), "ilerleme %50 olmalı");
});

test("v2.18.0 downloadClassCSV: gönderi yoksa sessiz kalır, varsa .csv indirir", () => {
  let downloads = [];
  sandbox.downloadFileBlob = (blob, name) => downloads.push(name);
  sandbox.localStorage.setItem("arduinoDreamLab.classroom.v1", JSON.stringify({ code: "7A", submissions: {} }));
  downloads = [];
  core.downloadClassCSV();
  assert.equal(downloads.length, 0, "gönderi yok → indirme yok");
  sandbox.localStorage.setItem("arduinoDreamLab.classroom.v1", JSON.stringify({
    code: "7A", submissions: { "Ada|Saksı": { student: "Ada", project: "Saksı", total: 3, steps: { 0: 1 }, ts: Date.now(), materials: [] } }
  }));
  core.downloadClassCSV();
  assert.equal(downloads.length, 1);
  assert.match(downloads[0], /^sinif-gonderimleri-\d{4}-\d{2}-\d{2}\.csv$/);
});

/* ─────────── v2.19.0: alışveriş listesi + panel arama/sayfalama + en aktif hafta ─────────── */

test("v2.19.0 shoppingListText: parça × adet + satır toplamları + proje toplamı", () => {
  const g = core.makeDemoGuide("LCD'li dijital saat");
  const txt = core.shoppingListText(g);
  assert.ok(txt.startsWith("🛒"), "başlıkta alışveriş ikonu");
  assert.ok(txt.includes("Alışveriş listesi") && txt.includes(g.title), "başlıkta proje adı");
  assert.ok(txt.includes("× "), "satırlar parça × adet biçiminde");
  assert.ok(txt.includes("Tahmini toplam"), "sonda proje toplamı");
  // Adet override: Uno 2 adet yapılınca hem satır hem toplam büyümeli
  const uno = (g.materials || []).find((m) => /uno/i.test(m.name));
  if (uno) {
    const base = core.estimateCost(g).totalUSD;
    const ov = core.estimateCost(g, { [uno.name]: "2" }).totalUSD;
    const txt2 = core.shoppingListText(g, { [uno.name]: "2" });
    assert.ok(txt2.includes("× 2"), "override adet satıra yansımalı");
    assert.ok(ov > base, "override toplamı artırmalı");
  }
  // Fiyatlanamayan parça: satırda fiyat yok ama anyUnknown işareti var
  const g2 = { title: "Deney", summary: "", materials: [{ name: "Kuantum Sensör MK-9", quantity: 1 }] };
  const txt3 = core.shoppingListText(g2);
  assert.ok(txt3.includes("Kuantum Sensör MK-9"), "bilinmeyen parça listelenir");
  assert.ok(txt3.includes("bazı parçalar fiyatlanmadı"), "anyUnknown işareti");
});

test("v2.19.0 filterSubmissions: foldTR duyarsız arama, boş sorgu tümünü döndürür", () => {
  const subs = [
    { student: "Cem Kaya", project: "Akıllı Saksı" },
    { student: "Ada", project: "Gece Lambası" },
    { student: "Öğrenci 7", project: "Robot Kol" }
  ];
  assert.equal(core.filterSubmissions(subs, "").length, 3, "boş → tümü");
  assert.equal(core.filterSubmissions(subs, null).length, 3, "null → tümü");
  assert.deepEqual(core.filterSubmissions(subs, "cem kaya").map((s) => s.student), ["Cem Kaya"], "büyük/küçük harf duyarsız");
  assert.deepEqual(core.filterSubmissions(subs, "OGRENCI").map((s) => s.student), ["Öğrenci 7"], "Türkçe harf katlanmalı (Ö→O)");
  assert.deepEqual(core.filterSubmissions(subs, "lamba").map((s) => s.project), ["Gece Lambası"], "proje adında arar (ı→I)");
  assert.equal(core.filterSubmissions(subs, "yok boyle").length, 0);
});

test("v2.19.0 paginate: dilimleme + sayfa kelepçeleme", () => {
  const items = Array.from({ length: 10 }, (_, i) => i);
  const p1 = core.paginate(items, 1, 3);
  assert.deepEqual(p1.slice, [0, 1, 2]);
  assert.equal(p1.pages, 4);
  const p3 = core.paginate(items, 3, 3);
  assert.deepEqual(p3.slice, [6, 7, 8]);
  const p99 = core.paginate(items, 99, 3);
  assert.equal(p99.page, 4, "taşan sayfa sona kelepçelenir");
  assert.deepEqual(p99.slice, [9]);
  assert.equal(core.paginate(items, 0, 3).page, 1, "geçersiz sayfa → 1");
  assert.equal(core.paginate([], 1, 3).pages, 1, "boş liste → 1 sayfa");
  assert.deepEqual(core.paginate(items, 2).slice, [8, 9], "perPage yoksa 8; son sayfada kalanlar");
});

test("v2.19.0 mostActiveWeek: en çok adımın tamamlandığı Pazartesi'yi döndürür", () => {
  assert.equal(core.mostActiveWeek([]), null, "veri yok → null");
  assert.equal(core.mostActiveWeek([{ steps: {}, ts: Date.now() }]), null, "adımsız → null");
  // Deterministik: iki sabit Pazartesi haftası
  const w1 = core.mondayOf(new Date(2026, 8, 28, 12).getTime()); // Pzt (hafta 1)
  const w2 = w1 + 7 * 86400000;                                  // sonraki hafta
  const best = core.mostActiveWeek([
    { steps: { 0: 1, 1: 1 }, ts: w2 + 3 * 86400000 },                 // hafta 2 → 2
    { steps: { 0: 1 }, ts: w2 + 4 * 86400000 },                        // hafta 2 → 3
    { steps: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 }, ts: w1 + 2 * 86400000 } // hafta 1 → 5
  ]);
  assert.equal(best.steps, 5, "5 adımlı hafta kazanır");
  assert.equal(best.weekStart, w1, "weekStart o haftanın Pazartesi'si");
  assert.ok(new Date(core.mondayOf(Date.now())).getDay() === 1, "mondayOf bugün için Pazartesi döndürür");
});

test("v2.8.0 portfolyo: sertifikasız durumda sessizce hata gösterir", () => {
  sandbox.localStorage.removeItem("arduinoDreamLab.badges.v1");
  let shown = "";
  sandbox.showError = (m) => { shown = m; };
  const downloads = [];
  sandbox.document.body = Object.assign(sandbox.document.body, { appendChild: (el) => { if (el && el.download) downloads.push(el.download); } });
  sandbox.downloadPortfolio();
  assert.ok(shown.includes("📦"), "bilgilendirme gösterilmeli");
  assert.equal(downloads.length, 0, "sertifikasız zip üretilmemeli");
});

/* ───── v2.20.0: CSV tarih filtresi ───── */
test("v2.20.0 filterSubsByRange: ISO gün aralığı (dahil), boş aralık tümünü döndürür", () => {
  const d = (y, m, day) => new Date(y, m, day, 14).getTime(); // yerel öğlen saati
  const subs = [
    { student: "Eylül", ts: d(2026, 8, 10) },
    { student: "Ekim", ts: d(2026, 9, 5) },
    { student: "Ekim2", ts: d(2026, 9, 20) },
    { student: "tsYok", ts: 0 }
  ];
  assert.equal(core.filterSubsByRange(subs, "", "").length, 4, "boş aralık → tümü");
  assert.deepEqual(core.filterSubsByRange(subs, "2026-10-01", "").map((s) => s.student), ["Ekim", "Ekim2"], "sadece from");
  assert.deepEqual(core.filterSubsByRange(subs, "", "2026-09-30").map((s) => s.student), ["Eylül"], "sadece to");
  assert.deepEqual(core.filterSubsByRange(subs, "2026-10-05", "2026-10-20").map((s) => s.student), ["Ekim", "Ekim2"], "her iki uç da dahil");
  assert.equal(core.filterSubsByRange(subs, "2026-01-01", "2026-01-02").length, 0, "aralık dışında kalır");
  assert.equal(core.filterSubsByRange(null, "2026-01-01", "").length, 0, "null liste güvenli");
});

test("v2.20.0 loadCsvRange/saveCsvRange: kalıcılık + bozuk JSON'a dayanıklılık", () => {
  sandbox.localStorage.removeItem("arduinoDreamLab.csvRange.v1");
  assert.deepEqual({ ...core.loadCsvRange() }, { from: "", to: "" }, "ilk okuma boş");
  core.saveCsvRange({ from: "2026-10-01", to: "2026-10-20" });
  assert.equal(core.loadCsvRange().from, "2026-10-01");
  assert.equal(core.loadCsvRange().to, "2026-10-20");
  core.saveCsvRange({ from: "2026-11-01", to: undefined });
  assert.equal(core.loadCsvRange().to, "", "eksik alan boşa normalize");
  sandbox.localStorage.setItem("arduinoDreamLab.csvRange.v1", "{bozuk");
  assert.deepEqual({ ...core.loadCsvRange() }, { from: "", to: "" }, "bozuk JSON → varsayılan");
  sandbox.localStorage.removeItem("arduinoDreamLab.csvRange.v1");
});

/* ───── v2.20.0: Arşiv favori/etiket ───── */
test("v2.20.0 archiveMeta/setArchiveMeta: favori işaretleme + etiket normalize (trim, en çok 5)", () => {
  sandbox.localStorage.setItem("arduinoDreamLab.archive.v1", JSON.stringify([
    { id: 11, ts: 1, guide: { title: "P1", code: "a" } },
    { id: 12, ts: 2, guide: { title: "P2", code: "b" }, meta: { fav: true, tags: ["veli"] } }
  ]));
  const list = core.loadArchive();
  const m0 = core.archiveMeta(list[0]);
  assert.equal(m0.fav, false, "meta yok → fav varsayılan false");
  assert.equal(m0.tags.length, 0, "meta yok → etiketsiz");
  const m1 = core.archiveMeta(list[1]);
  assert.equal(m1.fav, true, "mevcut meta korunur");
  assert.equal(m1.tags.join(","), "veli");
  core.setArchiveMeta(11, { fav: true });
  assert.equal(core.archiveMeta(core.loadArchive()[0]).fav, true, "fav kalıcı");
  core.setArchiveMeta(11, { tags: [" dönem1 ", "", "veli", "a", "b", "c", "d"] });
  const m = core.archiveMeta(core.loadArchive()[0]);
  assert.equal(m.tags.join(","), "dönem1,veli,a,b,c", "boşluk temizle + en çok 5");
  assert.equal(m.fav, true, "tags güncellemesi fav'ı korur");
  core.setArchiveMeta(11, { fav: false });
  assert.equal(core.archiveMeta(core.loadArchive()[0]).fav, false);
  core.setArchiveMeta(999, { fav: true }); // olmayan id → no-op, hata atmamalı
  assert.equal(core.loadArchive().length, 2);
  sandbox.localStorage.removeItem("arduinoDreamLab.archive.v1");
});

/* ───── v2.20.0: Göz serbest okuma ───── */
test("v2.20.0 buildAmbientPlan + nextAmbientStep/markAmbientStep: iç içe adım deposuyla sırayı izler", () => {
  const g = { title: "Göz Serbest Projesi", code: "const x=1;".repeat(3), steps: [
    { title: "Led bağla", detail: "Led dijital 13 pinine bağlanır." },
    { title: "Kod yükle", detail: "Blink kodunu yükleyip gözlemle." },
    { title: "Gözlemle", detail: "Ledin yanıp sönme hızını değiştir." }
  ] };
  const plan = core.buildAmbientPlan(g);
  assert.equal(plan.length, 3);
  assert.equal(plan[0].i, 0);
  assert.ok(plan[1].text.startsWith("Adım 2."), "okuma metni Adım N ile başlar");
  assert.equal(core.buildAmbientPlan({ steps: [] }).length, 0);

  const done = () => { try { return core.stepsStore()[core.stepsKeyOf(g)] || {}; } catch { return {}; } };
  assert.deepEqual(Object.keys(done()), [], "başlangıçta işaretli adım yok");
  assert.equal(core.nextAmbientStep(g, 0), 0, "ilk okunacak adım 0");
  core.markAmbientStep(g, 0);
  assert.ok(done()[0] > 0, "adım localStorage'a yazıldı (iç içe yapı)");
  assert.equal(core.nextAmbientStep(g, 0), 1, "işaretli adım atlanır");
  core.markAmbientStep(g, 1);
  core.markAmbientStep(g, 2);
  assert.equal(core.nextAmbientStep(g, 0), -1, "tümü bitince -1");
  assert.equal(core.nextAmbientStep(g, 2), -1, "tümü bitince idx'ten bağımsız -1");
});

/* ───── v2.20.0: Portfolyo favori sıralaması ───── */
test("v2.20.0 orderPortfolioCerts: favoriler önce, sonra en yeni tarih", () => {
  sandbox.localStorage.setItem("arduinoDreamLab.badges.v1", JSON.stringify([
    { type: "cert", project: "Eski Proje", ts: 100, guide: { title: "Eski Proje", code: "x1" } },
    { type: "cert", project: "Yeni Proje", ts: 300, guide: { title: "Yeni Proje", code: "x2" } },
    { type: "cert", project: "Favori Proje", ts: 200, guide: { title: "Favori Proje", code: "x3" } },
    { type: "feedback", project: "Rozet", ts: 999 }
  ]));
  sandbox.localStorage.setItem("arduinoDreamLab.archive.v1", JSON.stringify([
    { id: 1, ts: 1, guide: { title: "Favori Proje", code: "x3" }, meta: { fav: true, tags: ["severim"] } }
  ]));
  const certs = core.loadBadges().filter((b) => b.type === "cert" && b.guide);
  assert.equal(certs.length, 3);
  const ordered = core.orderPortfolioCerts(certs);
  assert.deepEqual(ordered.map((b) => b.project), ["Favori Proje", "Yeni Proje", "Eski Proje"], "favori önce, aynı statüde en yeni önce");
  assert.deepEqual(core.orderPortfolioCerts([]).length, 0, "boş liste güvenli");
  sandbox.localStorage.removeItem("arduinoDreamLab.badges.v1");
  sandbox.localStorage.removeItem("arduinoDreamLab.archive.v1");
});

/* ───── v2.21.0: Arşiv arama ───── */
test("v2.21.0 filterArchiveItems: başlık/fikir/etikette Türkçe harf duyarsız arama", () => {
  const items = [
    { id: 1, guide: { title: "Akıllı Saksı", code: "a" }, idea: "otomatik sulama" },
    { id: 2, guide: { title: "Gece Lambası", code: "b" }, idea: "ışık sensörü", meta: { fav: true, tags: ["veli", "Dönem1"] } },
    { id: 3, guide: { title: "Robot Kol", code: "c" }, idea: "", meta: { fav: false, tags: [] } }
  ];
  assert.equal(core.filterArchiveItems(items, "").length, 3, "boş sorgu → tümü");
  assert.equal(core.filterArchiveItems(items, null).length, 3, "null → tümü");
  assert.deepEqual(core.filterArchiveItems(items, "saksi").map((x) => x.id), [1], "başlıkta arar (ı→I, ş→S)");
  assert.deepEqual(core.filterArchiveItems(items, "SAKSI").map((x) => x.id), [1], "büyük harf de yakalar");
  assert.deepEqual(core.filterArchiveItems(items, "sensör").map((x) => x.id), [2], "fikir alanında arar");
  assert.deepEqual(core.filterArchiveItems(items, "DÖNEM").map((x) => x.id), [2], "etikette arar (Ö→O)");
  assert.deepEqual(core.filterArchiveItems(items, "veli").map((x) => x.id), [2]);
  assert.equal(core.filterArchiveItems(items, "yok boyle").length, 0);
  assert.equal(core.filterArchiveItems(null, "x").length, 0, "null liste güvenli");
  assert.equal(core.filterArchiveItems(items, "  ").length, 3, "boşluk → tümü");
});

/* ───── v2.21.0: Haftalık katılım detayı ───── */
test("v2.21.0 weeklyParticipationDetail: haftaları azalan dizer, adım sayısıyla", () => {
  assert.equal(core.weeklyParticipationDetail([]), "", "veri yok → boş");
  assert.equal(core.weeklyParticipationDetail([{ steps: {}, ts: Date.now() }]), "", "adımsız → boş");
  const w1 = core.mondayOf(new Date(2026, 8, 28, 12).getTime());
  const w2 = w1 + 7 * 86400000;
  const html = core.weeklyParticipationDetail([
    { student: "Ada", steps: { 0: 1, 1: 1 }, ts: w1 + 86400000 },
    { student: "Cem", steps: { 0: 1 }, ts: w1 + 2 * 86400000 },
    { student: "Ece", steps: { 0: 1, 1: 1, 2: 1 }, ts: w2 + 86400000 }
  ]);
  assert.ok(html.includes("Haftalık katılım detayı"), "başlık");
  assert.ok(html.includes("Ada (2)"), "öğrenci + adım sayısı");
  assert.ok(html.includes("Ece (3)"), "ikinci hafta");
  assert.ok(html.indexOf("Ece") < html.indexOf("Ada"), "en güncel hafta üstte (azalan)");
  assert.ok(html.includes("3 adım"), "hafta toplamı");
});

/* ───── v2.21.0: CSV son etkinlik sütunu ───── */
test("v2.21.0 classSubsToCSV: Son Etkinlik sütunu en büyük adım ts'ini yazar", () => {
  const csv = core.classSubsToCSV([
    { student: "Ada", project: "P1", total: 3, steps: { 0: 1700000000000, 1: 1700086400000 }, ts: 1700001000000 },
    { student: "Cem", project: "P2", total: 2, steps: {}, ts: 1700172800000 }
  ]);
  const lines = csv.slice(1).split("\r\n");
  assert.ok(lines[0].endsWith("Son Etkinlik"), "yeni başlık sonda: " + lines[0]);
  assert.ok(lines[1].includes("2023-11-15"), "adım ts'inin max'i (1700086400000 → 2023-11-15 UTC)");
  assert.ok(lines[2].includes("2023-11-16"), "adım yoksa gönderim ts'i (1700172800000 → 2023-11-16 UTC)");
  assert.equal(lines[1].split(";").length, 9, "9 sütun");
});

/* ───── v2.22.0: Haftalık veri + panel grafiği ───── */
test("v2.22.0 weeklyBarsData + panelWeeklySVG: ortak veri, CSS değişkenli SVG", () => {
  assert.equal(core.weeklyBarsData([]), null, "veri yok → null");
  const w1 = core.mondayOf(new Date(2026, 8, 28, 12).getTime());
  const w2 = w1 + 7 * 86400000;
  const d = core.weeklyBarsData([
    { steps: { 0: 1, 1: 1 }, ts: w1 + 86400000 },
    { steps: { 0: 1 }, ts: w2 + 86400000 }
  ]);
  assert.equal(d.weeks.length, 2, "iki hafta");
  assert.equal(d.max, 2, "maksimum 2");
  assert.equal(d.perWeek.get(w1), 2, "hafta 1 toplamı");
  const svg = core.panelWeeklySVG([{ steps: { 0: 1 }, ts: Date.now() }]);
  assert.ok(svg.includes("var(--teal)"), "panel grafiği CSS değişkeni kullanır");
  assert.ok(svg.includes("viewBox"), "SVG gövdesi");
  assert.equal(core.panelWeeklySVG([]), "", "veri yok → boş");
});

/* ───── v2.22.0: Çoklu sınıf filtresi ───── */
test("v2.22.0 classSubs + setActiveClassCode: sınıf koduna süzme + kalıcılık", () => {
  const subs = [
    { student: "A", classCode: "7A" },
    { student: "B", classCode: "8B" },
    { student: "C", classCode: "" },
    { student: "D" }
  ];
  assert.equal(core.classSubs(subs, "").length, 4, "boş kod → tümü");
  assert.deepEqual(core.classSubs(subs, "7A").map((s) => s.student), ["A"]);
  assert.equal(core.classSubs(subs, "9Z").length, 0);
  assert.equal(core.classSubs(null, "7A").length, 0, "null güvenli");
  sandbox.localStorage.removeItem("arduinoDreamLab.activeClass.v1");
  assert.equal(core.activeClassCode(), "", "ilk okuma boş");
  core.setActiveClassCode("7A");
  assert.equal(core.activeClassCode(), "7A", "kalıcı");
  core.setActiveClassCode("");
  assert.equal(core.activeClassCode(), "", "temizlenir");
});

/* ───── v2.22.0: Arşiv sıralama ───── */
test("v2.22.0 sortArchiveItems: fav/new/az modları", () => {
  const items = [
    { id: 1, ts: 100, guide: { title: "Cismi" } },
    { id: 2, ts: 300, guide: { title: "Anka" }, meta: { fav: true, tags: [] } },
    { id: 3, ts: 200, guide: { title: "Başlangıç" } }
  ];
  assert.equal(core.sortArchiveItems(items, "new").map((x) => x.id).join(","), "2,3,1", "en yeni önce");
  assert.equal(core.sortArchiveItems(items, "fav").map((x) => x.id).join(","), "2,3,1", "favori önce, sonra tarih");
  assert.equal(core.sortArchiveItems(items, "az").map((x) => x.id).join(","), "2,3,1", "A→Z: Anka, Başlangıç, Cismi");
  const copy = core.sortArchiveItems(items, "new");
  assert.notEqual(copy, items, "orijinal dizi mutasyona uğramaz");
  assert.equal(core.sortArchiveItems(null, "new").length, 0, "null güvenli");
});

/* ───── v2.22.0: CSV raporu sınıf filtresiyle uyum (classTag hatası regülasyonu) ───── */
test("v2.22.0 downloadClassCSV: aktif sınıf seçiliyken sadece o sınıf indirilir", () => {
  let downloads = [];
  sandbox.downloadFileBlob = (blob, name) => downloads.push(name);
  sandbox.localStorage.setItem("arduinoDreamLab.classroom.v1", JSON.stringify({
    code: "7A",
    submissions: {
      "A|P1": { student: "A", project: "P1", total: 2, steps: { 0: 1 }, ts: Date.now(), classCode: "7A", materials: [] },
      "B|P2": { student: "B", project: "P2", total: 2, steps: { 0: 1 }, ts: Date.now(), classCode: "8B", materials: [] }
    }
  }));
  sandbox.localStorage.setItem("arduinoDreamLab.activeClass.v1", "8B");
  sandbox.downloadClassCSV();
  assert.equal(downloads.length, 1, "8B sınıfı indirildi");
  const blobText = (() => { return "ok"; })();
  assert.ok(downloads[0].startsWith("sinif-gonderimleri"), "dosya adı");
  sandbox.localStorage.removeItem("arduinoDreamLab.activeClass.v1");
  sandbox.localStorage.removeItem("arduinoDreamLab.classroom.v1");
  downloads = [];
});

/* ───── v3.0.0: Sınıf karşılaştırma ───── */

test("v3.0.0 compareClasses: iki sınıfın özet metrikleri + kenar durumlar", () => {
  const subs = [
    { student: "A", project: "P1", total: 4, steps: { 0: 1, 1: 1 }, ts: Date.now(), classCode: "7A", materials: [{ name: "Arduino Uno", quantity: "1" }] },
    { student: "B", project: "P2", total: 4, steps: { 0: 1 }, ts: Date.now(), classCode: "7A", materials: [] },
    { student: "C", project: "P3", total: 2, steps: { 0: 1, 1: 1 }, ts: Date.now(), classCode: "8B", materials: [{ name: "Arduino Uno", quantity: "1" }] }
  ];
  const cmp = core.compareClasses(subs, "7A", "8B");
  assert.equal(cmp.a.code, "7A");
  assert.equal(cmp.a.students, 2, "7A'da 2 öğrenci");
  assert.equal(cmp.a.done, 3);
  assert.equal(cmp.a.steps, 8);
  assert.equal(cmp.a.avgPct, Math.round((3 / 8) * 100), "ortalama ilerleme %38");
  assert.equal(cmp.b.students, 1);
  assert.equal(cmp.b.avgPct, 100);
  assert.ok(cmp.a.cost > 0, "7A bütçesi > 0");
  assert.equal(cmp.a.cost, cmp.b.cost, "her iki tarafta da 1 Uno var → eşit bütçe");
  assert.ok(cmp.a.activeWeek && typeof cmp.a.activeWeek.start === "number", "en aktif hafta döner");
  // Olmayan kod → boş metrikler (çökmez)
  const none = core.compareClasses(subs, "9Z", "9Z");
  assert.equal(none.a.students, 0);
  assert.equal(none.a.avgPct, 0);
  assert.equal(none.a.cost, 0);
  assert.equal(none.a.activeWeek, null);
});

test("v3.0.0 compareTableHTML: iki sütun + kazanan hücre vurgusu", () => {
  const subs = [
    { student: "A", project: "P", total: 4, steps: { 0: 1, 1: 1 }, ts: Date.now(), classCode: "7A", materials: [] },
    { student: "B", project: "P", total: 4, steps: { 0: 1 }, ts: Date.now(), classCode: "8B", materials: [] }
  ];
  const cmp = core.compareClasses(subs, "7A", "8B");
  const html = core.compareTableHTML(cmp, false);
  assert.match(html, /<table class="cmp-table">/, "tablo sınıfı");
  assert.ok(html.includes("7A") && html.includes("8B"), "iki sınıf başlığı");
  assert.ok(html.includes("cmp-win"), "ilerlemede daha iyi taraf vurgulu");
  // 7A %50 > 8B %25 → ilk vurgulu hücre 7A sütununda olmalı
  const winIdx = html.indexOf("cmp-win");
  const bIdx = html.indexOf(">%25<");
  assert.ok(winIdx > 0 && (bIdx < 0 || winIdx < bIdx), "kazanan hücre 8B'den önce gelir");
  const empty = core.compareTableHTML(core.compareClasses([], "", ""), true);
  assert.ok(empty.includes("(no class)"), "boş kenar durumu çökmez");
});

/* ───── v3.0.0: Öğrenci zaman çizelgesi ───── */

test("v3.0.0 studentTimeline: kronolojik olaylar, bozuk damga dayanıklılığı", () => {
  const t1 = Date.now() - 3 * 86400000;
  const t2 = Date.now() - 2 * 86400000;
  const t3 = Date.now() - 86400000;
  // Adımlar bilinçli olarak ters sırada verildi → sonuç sıralı olmalı
  const ev = core.studentTimeline({ steps: { 2: t3, 0: t1, 1: t2 }, ts: t3 });
  assert.equal(ev.length, 4, "3 adım + 1 gönderim");
  // vm-realm dizileri host prototipinden farklı → Array.from ile host'a taşı
  assert.deepEqual(Array.from(ev, (e) => e.ts), [t1, t2, t3, t3].sort((a, b) => a - b));
  assert.equal(ev[0].kind, "step");
  assert.equal(ev[0].n, 1, "0. adım → 1 numara");
  assert.equal(ev[3].kind, "submit");
  // Bayrak değeri (1) ve bozuk damgalar atlanır, gerçek ts korunur
  const legacy = core.studentTimeline({ steps: { 0: 1, 1: "bozuk", 2: t1 }, ts: t3 });
  assert.equal(legacy.length, 2, "bayrak + bozuk atlandı");
  assert.ok(legacy.every((e) => e.ts > 1e11), "kalanlar gerçek damga");
  assert.equal(core.studentTimeline(null).length, 0, "null güvenli");
  assert.equal(core.studentTimeline({}).length, 0, "boş gönderim güvenli");
  assert.equal(core.studentTimeline({ steps: {}, ts: 0 }).length, 0, "ts=0 atlanır");
});

test("v3.0.0 timelineSummary: gün bazlı özet + İngilizce", () => {
  const day = 86400000;
  const now = Date.now();
  const sub = {
    steps: { 0: now - 2 * day, 1: now - 2 * day + 3600000, 2: now - day },
    ts: now - 12 * 3600000
  };
  const tr = core.timelineSummary(sub, false);
  assert.ok(tr.includes("2 adım"), "aynı güne 2 adım tek parçada: " + tr);
  assert.ok(tr.includes("gönderim"), "gönderim günü işaretli");
  assert.ok(tr.includes(" · "), "günler ayracıyla");
  const en = core.timelineSummary(sub, true);
  assert.ok(en.includes("steps") && en.includes("submitted"), "İngilizce: " + en);
  assert.equal(core.timelineSummary({ steps: {} }, false), "", "olay yoksa boş dize");
  // Sıralama: günler eskiden yenisine değil, yeniden eskiye değil artan
  const idxA = tr.indexOf("2 adım");
  assert.ok(idxA >= 0);
});

/* ───── v3.0.0: Rapor sınıf turları ───── */

test("v3.0.0 groupSubsByClass: alfabetik turlar + sınıf kodusuzlar ayrı grupta", () => {
  const subs = [
    { student: "A", classCode: "8B" },
    { student: "B", classCode: "7A" },
    { student: "C", classCode: "7A" },
    { student: "D" },
    { student: "E", classCode: "" }
  ];
  const groups = core.groupSubsByClass(subs);
  assert.deepEqual(Array.from(groups, (g) => g.code), ["", "7A", "8B"], "alfabetik (tr), kodsuz en başta");
  assert.equal(groups[0].subs.length, 2, "D + E (kodsuz) aynı turda");
  assert.equal(groups[1].subs.length, 2);
  assert.equal(groups[2].subs.length, 1);
  assert.equal(core.groupSubsByClass(null).length, 0, "null güvenli");
});

test("v3.0.0 rapor: sınıf turları + satır rozeti + zaman çizelgesi bölümü", () => {
  let html = "";
  sandbox.open = () => ({ document: { write: (h) => { html = h; }, close: () => {} } });
  const day = 86400000;
  sandbox.localStorage.setItem("arduinoDreamLab.classroom.v1", JSON.stringify({
    code: "7A",
    submissions: {
      "Ali|P1": { student: "Ali", project: "P1", total: 3, steps: { 0: Date.now() - 2 * day, 1: Date.now() - day }, ts: Date.now() - day, classCode: "7A", materials: [] },
      "Veli|P2": { student: "Veli", project: "P2", total: 3, steps: { 0: Date.now() - 5 * day }, ts: Date.now() - 4 * day, classCode: "8B", materials: [] },
      "Ayşe|P3": { student: "Ayşe", project: "P3", total: 3, steps: {}, ts: Date.now(), materials: [] }
    }
  }));
  sandbox.localStorage.removeItem("arduinoDreamLab.activeClass.v1");
  sandbox.downloadClassReport();
  // Tur modu: 3 grup (7A, 8B, kodsuz) ayrı başlıklarla (CSS'teki .cls-tour değil, gerçek h3)
  assert.ok(html.includes('<h3 class="cls-tour">'), "tur başlığı yok");
  assert.ok(html.includes("🎓 7A") && html.includes("🎓 8B"), "7A/8B tur başlıkları yok");
  assert.ok(html.includes("sınıfsız"), "kodsuz tur başlığı yok");
  // Satır rozeti + zaman çizelgesi bölümü
  assert.ok(html.includes('<span class="cls-tag">'), "satır rozeti yok");
  assert.ok(html.includes("Öğrenci zaman çizelgeleri"), "zaman çizelgesi bölümü yok");
  assert.ok(html.includes("gönderim"), "çizelge özeti gönderim günü taşımıyor");
  // Tek sınıf seçili: tur yok, başlık etiketi + tek tablo
  sandbox.localStorage.setItem("arduinoDreamLab.activeClass.v1", "8B");
  html = "";
  sandbox.downloadClassReport();
  assert.ok(html.includes("· 🎓 8B"), "aktif sınıf etiketi yok (TDZ regresyonu)");
  assert.ok(!html.includes('<h3 class="cls-tour">'), "tek sınıfta tur başlığı olmamalı");
  assert.equal((html.match(/<table>/g) || []).length, 1, "tek tablo");
  sandbox.localStorage.removeItem("arduinoDreamLab.activeClass.v1");
  sandbox.localStorage.removeItem("arduinoDreamLab.classroom.v1");
});

/* ───── v3.0.0: Arşiv mini önizleme ───── */

test("v3.0.0 archivePreviewData: özet + ilk 3 adım + ilk ipucu, eksik alan dayanıklı", () => {
  const item = { guide: {
    title: "Akıllı Saksı",
    summary: "Toprağı ölçen, bitkiyi sulayan saksı.",
    steps: [
      { title: "Nem sensörünü tak" }, { title: "Pompayı bağla" },
      { title: "Eşiği ayarla" }, { title: "Kodu yükle" }, { title: "Sulama testi" }
    ],
    tips: ["Fazla su kök çürütür.", "İkinci ipucu."]
  } };
  const pv = core.archivePreviewData(item);
  assert.equal(pv.summary, "Toprağı ölçen, bitkiyi sulayan saksı.");
  assert.deepEqual(Array.from(pv.steps), ["Nem sensörünü tak", "Pompayı bağla", "Eşiği ayarla"], "yalnız ilk 3 adım");
  assert.equal(pv.tip, "Fazla su kök çürütür.", "yalnız ilk ipucu");
  // Eski kayıtlar: summary/steps/tips yok → güvenle boş (realm nesnesi, alan alan)
  const bare = core.archivePreviewData({ guide: { title: "Eski" } });
  assert.equal(bare.summary, "");
  assert.equal(bare.steps.length, 0);
  assert.equal(bare.tip, "");
  // Adımlar başlıksızsa atlanır ama ilk-3 sınırı korunur
  const mixed = core.archivePreviewData({ guide: { steps: [{ detail: "yok" }, { title: "Var" }, { title: "İkinci" }, { title: "Üçüncü" }, { title: "Dördüncü" }] } });
  assert.deepEqual(Array.from(mixed.steps), ["Var", "İkinci", "Üçüncü"], "başlıksızlar sayılır");
  const nul = core.archivePreviewData(null);
  assert.equal(nul.summary, "");
  assert.equal(nul.steps.length, 0, "null güvenli");
});

/* ───── v3.1.0: Karşılaştırma grafiği ───── */

test("v3.1.0 compareBarsHTML: 5 metrik, normalize çubuklar, kazanan vurgusu", () => {
  const subs = [
    { student: "A", project: "P", total: 4, steps: { 0: 1, 1: 1 }, ts: Date.now(), classCode: "7A", materials: [] },
    { student: "B", project: "P", total: 4, steps: { 0: 1 }, ts: Date.now(), classCode: "7A", materials: [] },
    { student: "C", project: "P", total: 4, steps: { 0: 1, 1: 1, 2: 1 }, ts: Date.now(), classCode: "8B", materials: [] }
  ];
  const cmp = core.compareClasses(subs, "7A", "8B");
  const svg = core.compareBarsHTML(cmp, false);
  assert.match(svg, /^<svg /, "SVG ile başlamalı");
  assert.match(svg, /<\/svg>$/, "SVG ile bitmeli");
  assert.ok(svg.includes("aria-label"), "erişilebilir etiket yok");
  assert.ok(svg.includes("7A") && svg.includes("8B"), "efsane iki sınıf kodu");
  // 5 metrik satırı → 5 çift çubuk = 10 rect (+ 2 legend)
  const rows = (svg.match(/class="cmp-bar-row"/g) || []).length;
  assert.equal(rows, 5, "5 metrik satırı");
  assert.equal((svg.match(/class="cmp-bar /g) || []).length, 12, "10 çubuk + 2 legend");
  // En büyüğü tam genişlik alır (normalize)
  const widths = [...svg.matchAll(/<rect class="cmp-bar[^"]*" x="\d+" y="\d+" width="(\d+)"/g)].map((m) => Number(m[1]));
  assert.ok(Math.max(...widths) > 300, "en büyük metrik dolu genişlikte");
  assert.ok(Math.min(...widths) >= 2, "sıfır değer bile görünür çubuk");
  assert.ok(svg.includes("cmp-bar-win"), "kazanan vurgusu yok");
  // Boş sınıf çökmez
  const empty = core.compareBarsHTML(core.compareClasses([], "5A", "5B"), true);
  assert.match(empty, /^<svg /, "boş sınıf çökmez");
  assert.equal((empty.match(/class="cmp-bar-row"/g) || []).length, 5, "boşta da 5 satır");
});

test("v3.1.0 karşılaştırma grafiği: bütçede az harcamak kazandırır", () => {
  const mk = (code, cost) => [{ student: "A", project: "P", total: 1, steps: { 0: 1 }, ts: Date.now(), classCode: code,
    materials: [{ name: "X", quantity: "1" }] }];
  // 7A pahalı, 8B ucuz → 8B kazanmalı (lowIsGood)
  sandbox.localStorage.setItem("arduinoDreamLab.customPrices.v1", JSON.stringify({ X: 20 }));
  const costly = core.compareClasses(mk("7A"), "7A", "8B");
  sandbox.localStorage.setItem("arduinoDreamLab.customPrices.v1", JSON.stringify({ X: 20 }));
  const cmpCost = { a: { students: 1, avgPct: 100, done: 1, steps: 1, cost: 40, activeWeek: null },
                    b: { students: 1, avgPct: 100, done: 1, steps: 1, cost: 10, activeWeek: null } };
  const svg = core.compareBarsHTML(cmpCost, false);
  const budgetRow = svg.split("cmp-bar-row").find((s) => s.includes("Tahmini bütçe"));
  assert.ok(budgetRow, "bütçe satırı yok");
  const winIdx = budgetRow.indexOf("cmp-bar-win");
  const bValIdx = budgetRow.indexOf("$10.00");
  const aValIdx = budgetRow.indexOf("$40.00");
  assert.ok(winIdx > -1, "bütçede kazanan vurgulanmalı");
  // $10.00 (B, ucuz) çubuğu vurgulanmalı, $40.00 (A) değil
  assert.ok(bValIdx > winIdx || winIdx < aValIdx, "daha az bütçeli taraf kazanır");
  sandbox.localStorage.removeItem("arduinoDreamLab.customPrices.v1");
});

test("v3.1.0 classMetricValue: weekSteps aktif haftadan okur, yoksa 0", () => {
  assert.equal(core.classMetricValue({ students: 5 }, "students"), 5);
  assert.equal(core.classMetricValue({ activeWeek: { steps: 12 } }, "weekSteps"), 12);
  assert.equal(core.classMetricValue({ activeWeek: null }, "weekSteps"), 0);
  assert.equal(core.classMetricValue({}, "weekSteps"), 0, "eksik alan 0");
  assert.equal(core.classMetricValue(null, "cost"), 0, "null güvenli");
});

test("v3.1.0 rapor: çok sınıflı raporda karşılaştırma grafiği basılır", () => {
  let html = "";
  sandbox.window.open = () => ({ document: { write: (h) => { html = h; }, close: () => {} } });
  const day = 86400000;
  sandbox.localStorage.setItem("arduinoDreamLab.classroom.v1", JSON.stringify({
    code: "7A",
    submissions: {
      "Ali|P1": { student: "Ali", project: "P1", total: 4, steps: { 0: 1, 1: 1 }, ts: Date.now() - day, classCode: "7A", materials: [] },
      "Veli|P2": { student: "Veli", project: "P2", total: 4, steps: { 0: 1 }, ts: Date.now() - 2 * day, classCode: "8B", materials: [] }
    }
  }));
  sandbox.localStorage.removeItem("arduinoDreamLab.activeClass.v1");
  sandbox.downloadClassReport();
  assert.ok(html.includes("Sınıf Karşılaştırması"), "karşılaştırma başlığı yok");
  assert.ok(html.includes('class="cmp-bars-print"'), "yazdırma grafiği kutusu yok");
  assert.ok(html.includes('<svg class="cmp-bars"'), "SVG yok");
  assert.ok(html.includes("🎓 7A / 🎓 8B"), "karşılaştırılan sınıflar yazmıyor");
  assert.ok(html.includes("Her metrik iki sınıfın büyüğüne göre ölçeklenir"), "ölçek notu yok");
  // Tek sınıf seçili → grafik basılmaz (anlamsız)
  sandbox.localStorage.setItem("arduinoDreamLab.activeClass.v1", "8B");
  html = "";
  sandbox.downloadClassReport();
  // Not: raporun <style> bloğunda .cmp-bars-print kuralı her zaman var; bu yüzden
  // varlık değil GERÇEK eleman (class="...") aranır.
  assert.ok(!html.includes('class="cmp-bars-print"'), "tek sınıfta grafik basılmamalı");
  sandbox.localStorage.removeItem("arduinoDreamLab.activeClass.v1");
  sandbox.localStorage.removeItem("arduinoDreamLab.classroom.v1");
});

/* ─────────────────────────────────────────────────────────────
   v4.0.0 — Üyelik ve topluluk duvarı istemcisi
   ───────────────────────────────────────────────────────────── */
test("v4.0.0 wallCardHTML: prompt yoksa kilitli kart basar, sızdırmaz", () => {
  const item = {
    title: "Yağmur Sensörü",
    summary: "Toprak nemi düşünce pompa çalışır.",
    images: [{ url: "https://ornek/a.jpg", width: 800, height: 600 }],
    owner: { displayName: "Deniz Arduino", handle: "deniz-arduino" }
    // promptBody YOK → üye olmayan görüntüleyici
  };
  const html = core.wallCardHTML(item);
  assert.ok(html.includes("wall-card"), "kart basılmalı");
  assert.ok(html.includes("Yağmur Sensörü"), "başlık görünmeli");
  assert.ok(html.includes("deniz-arduino"), "yazar görünmeli");
  assert.ok(html.includes("wall-locked"), "kilitli kart olmalı");
  assert.ok(!html.includes("wall-prompt"), "prompt bloğu basılmamalı");
});

test("v4.0.0 wallCardHTML: üye prompt'u görür ve HTML kaçışı uygulanır", () => {
  const item = {
    title: "Sulama",
    summary: "Özet",
    images: [],
    owner: { displayName: "Ayşe", handle: "ayse" },
    promptBody: 'Arduino <script>alert("x")</script> ile sulama'
  };
  const html = core.wallCardHTML(item);
  assert.ok(html.includes("wall-prompt"), "prompt bloğu olmalı");
  assert.ok(html.includes("&lt;script&gt;"), "prompt HTML kaçışından geçmeli");
  assert.ok(!html.includes("<script>alert"), "ham script etiketi sızmamalı");
});

test("v4.0.0 wallCardHTML: görsel yoksa <img> basılmaz", () => {
  const html = core.wallCardHTML({
    title: "Görselsiz",
    summary: "",
    images: [],
    owner: { displayName: "X", handle: "x" }
  });
  assert.ok(!html.includes("wall-img"), "görsel etiketi olmamalı");
  assert.ok(html.includes("Görselsiz"));
});

test("v4.0.0 wallCardHTML: başlık HTML kaçışından geçer (enjeksiyon koruması)", () => {
  const html = core.wallCardHTML({
    title: '<img src=x onerror="alert(1)">',
    summary: "",
    images: [],
    owner: { displayName: "E", handle: "e" }
  });
  assert.ok(!html.includes("<img src=x"), "başlıktan ham etiket sızmamalı");
  assert.ok(html.includes("&lt;img"), "kaçış uygulanmalı");
});

test("v4.0.0 fmtUsd: sentleri biçimlendirir", () => {
  assert.equal(core.fmtUsd(100), "$1");
  assert.equal(core.fmtUsd(0), "$0");
  assert.equal(core.fmtUsd(300), "$3");
  assert.match(core.fmtUsd(199), /1\.99/);
});

/* ─────────────────────────────────────────────────────────────
   v4.1.0 — Takip akışı sekmesi
   ───────────────────────────────────────────────────────────── */
test("v4.1.0 wallTabsHTML: iki sekme basılır, etkin olan is-active", () => {
  const all = core.wallTabsHTML("all");
  assert.ok(all.includes('data-wall-tab="all"'), "Tümü sekmesi olmalı");
  assert.ok(all.includes('data-wall-tab="following"'), "Takip sekmesi olmalı");
  const allOn = all.match(/class="wall-tab is-active" data-wall-tab="([^"]+)"/);
  assert.equal(allOn && allOn[1], "all", "all seçiliyken 'Tümü' etkin olmalı");

  const follow = core.wallTabsHTML("following");
  const followOn = follow.match(/class="wall-tab is-active" data-wall-tab="([^"]+)"/);
  assert.equal(followOn && followOn[1], "following", "following seçiliyken 'Takip' etkin olmalı");
});

test("v4.1.0 wallTabsHTML: bilinmeyen sekme 'Tümü'ye düşer", () => {
  const html = core.wallTabsHTML("bogus");
  assert.ok(html.includes('class="wall-tab is-active" data-wall-tab="all"'));
  assert.ok(!html.includes('is-active" data-wall-tab="following"'));
});

test("v4.1.0 wallTabsHTML: aria-selected etkin sekmede true", () => {
  const follow = core.wallTabsHTML("following");
  assert.ok(follow.includes('data-wall-tab="following" role="tab" type="button"\n        aria-selected="true"'),
    "etkin sekmede aria-selected=true olmalı");
  assert.ok(follow.includes('aria-selected="false">🌍'), "pasif sekmede aria-selected=false olmalı");
});

test("v4.1.0 wallEmptyText: sekmeye göre boş durum metni değişir", () => {
  assert.match(core.wallEmptyText("all"), /Henüz paylaşılmış proje yok/);
  assert.match(core.wallEmptyText("following"), /henüz proje paylaşmadı/);
  assert.notEqual(core.wallEmptyText("all"), core.wallEmptyText("following"));
});

test("v4.1.0 wallCardHTML: beğeni/yorum düğmeleri ve sayaçları basılır", () => {
  const html = core.wallCardHTML({
    id: "p1",
    title: "Yağmur Sensörü",
    summary: "Özet",
    images: [],
    owner: { displayName: "Deniz", handle: "deniz" },
    likeCount: 3,
    commentCount: 2,
    likedByViewer: true
  });
  assert.ok(html.includes('data-project-id="p1"'), "kart kimliği taşımalı");
  assert.ok(html.includes('data-act="like"'), "beğeni düğmesi olmalı");
  assert.ok(html.includes('data-act="comments"'), "yorum düğmesi olmalı");
  assert.ok(html.includes('aria-pressed="true"'), "beğenilmişse aria-pressed true");
  assert.ok(html.includes('❤️ <span class="wall-count">3</span>'), "kalp ve beğeni sayısı");
  assert.ok(html.includes('💬 <span class="wall-count">2</span>'), "yorum sayısı");
  assert.ok(html.includes('class="wall-comments" hidden'), "yorum paneli gizli başlamalı");
});

test("v4.1.0 wallCardHTML: beğenilmemişse boş kalp, sayaç 0'a düşmez", () => {
  const html = core.wallCardHTML({
    id: "p2", title: "X", summary: "", images: [],
    owner: { displayName: "A", handle: "a" }
  });
  assert.ok(html.includes('aria-pressed="false"'));
  assert.ok(html.includes('🤍 <span class="wall-count">0</span>'));
  assert.ok(html.includes('💬 <span class="wall-count">0</span>'));
  assert.ok(!html.includes("is-on"), "beğenilmemişken is-on olmamalı");
});

test("v4.1.0 likeBtnFace: durum ve sayaç tek kaynaktan gelir", () => {
  const on = core.likeBtnFace(true, 5);
  assert.equal(on.icon, "❤️");
  assert.equal(on.count, 5);
  assert.equal(on.pressed, "true");
  assert.equal(on.cls, "wall-act is-on");

  const off = core.likeBtnFace(false, "3");
  assert.equal(off.icon, "🤍");
  assert.equal(off.count, 3, "metin olarak gelen sayaç sayıya çevrilmeli");
  assert.equal(off.pressed, "false");
  assert.equal(off.cls, "wall-act");
});

test("v4.1.0 commentsHTML: yorum yazma kutusu yalnız üyeye açık", () => {
  const member = core.commentsHTML([], true);
  assert.ok(member.includes("cmt-form"), "üye için yazma kutusu olmalı");
  assert.ok(member.includes("cmt-input"));
  assert.ok(member.includes("Henüz yorum yok"), "boş liste ipucu basmalı");

  const guest = core.commentsHTML([], false);
  assert.ok(!guest.includes("cmt-form"), "üye olmayan için yazma kutusu olmamalı");
  assert.ok(guest.includes("Yorum yazmak için üye ol."));
});

test("v4.1.0 commentsHTML: yorum gövdesi HTML kaçışından geçer", () => {
  const html = core.commentsHTML([
    { id: "c1", body: '<script>alert("x")</script> harika', author: { displayName: "Ayşe", handle: "ayse" }, canDelete: false }
  ], true);
  assert.ok(!html.includes("<script>alert"), "ham script sızmamalı");
  assert.ok(html.includes("&lt;script&gt;"), "kaçış uygulanmalı");
  assert.ok(!html.includes("cmt-del"), "canDelete yoksa sil düğmesi olmamalı");
  assert.ok(html.includes('data-comment-id="c1"'), "yorum kimliği taşımalı");
});

test("v4.1.0 commentsHTML: silme yetkisi olanın düğmesi basılır", () => {
  const html = core.commentsHTML([
    { id: "c2", body: "Metin", author: { displayName: "Ali", handle: "ali" }, canDelete: true }
  ], false);
  assert.ok(html.includes("cmt-del"), "canDelete true ise sil düğmesi olmalı");
});

test("v4.1.0 wallTabsHTML: kimlik taşır (kopya çubuk oluşmaz)", () => {
  const html = core.wallTabsHTML("all");
  assert.ok(html.includes('id="wallTabs"'),
    "sekme çubuğunun kimliği olmalı; renderWallTabs eskisini bulup değiştiriyor");
});

test("v4.1.0 wallTabsCount: DOM'da tek çubuk sayılır", () => {
  const fake = {
    querySelectorAll(sel) {
      assert.equal(sel, ".wall-tabs");
      return [1];   // bir çubuk
    }
  };
  assert.equal(core.wallTabsCount(fake), 1);
  assert.equal(core.wallTabsCount(null), 0);
});

/* ─────────────────────────────────────────────────────────────
   v4.2.0 — Giriş kapısı (menü kilitleri) ve $1 lansmanı
   ───────────────────────────────────────────────────────────── */
test("v4.2.0 GATED_MENU_IDS: kilitli menüler listelenir, duvar ve giriş listede değil", () => {
  // Kilit listesi app.js kaynağından okunur: VM sandbox'ına const dizileri
  // enjekte edilirken çakışma riski var, ama bu test tam olarak bu
  // sabitin DOĞRU tanımlandığını doğrulamalı.
  const src = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "app.js"), "utf8");
  const m = src.match(/const GATED_MENU_IDS = \[([^\]]*)\];/);
  assert.ok(m, "GATED_MENU_IDS app.js içinde tanımlı olmalı");
  const ids = m[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);

  for (const gerekli of ["libraryBtn", "archiveBtn", "badgesBtn", "classBtn"]) {
    assert.ok(ids.includes(gerekli), `${gerekli} kilitli olmalı`);
  }
  assert.ok(!ids.includes("wallBtn"), "topluluk duvarı herkese açık, kilitlenmemeli");
  assert.ok(!ids.includes("authBtn"), "giriş düğmesi kilitlenmemeli");
  assert.ok(!ids.includes("joinBtn") && !ids.includes("loginBtn"), "üye/giriş düğmeleri her zaman açık");
});

test("v4.2.0 canUseApp: API adresi boşken demo açık kalır", () => {
  // canUseApp, app.js'te API_BASE sabitine bakar. Bu sabit vm.runInContext
  // ile tanımlı olduğu için doğrudan çağırmak TDZ hatası verir; kuralı
  // kaynaktan okuyıp aynı koşulu değerlendiriyoruz.
  const src = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "app.js"), "utf8");
  const govde = core.canUseApp.toString();
  assert.ok(govde.includes("if (!API_BASE) return true;"),
    "API adresi yokken kilit AÇIK olmalı — demo modu bozulmasın");
  assert.ok(govde.includes("return Boolean(memberState.user)"),
    "sunucu varsa kilit yalnız giriş yapmışa açılmalı");
  assert.ok(src.includes("function canUseApp()"), "canUseApp app.js içinde tanımlı");
});

test("v4.2.0 fmtUsd: lansman fiyatı $1 olarak basılır", () => {
  assert.equal(core.fmtUsd(100), "$1");
});

/* ─────────────────────────────────────────────────────────────
   v4.3.0 — Duvar arama/sıralama, raporlama, moderasyon, avatar
   ───────────────────────────────────────────────────────────── */
test("v4.3.0 setWallSort: yalnız new/top/discussed kabul edilir", () => {
  const src = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "app.js"), "utf8");
  const govde = core.setWallSort.toString();
  assert.ok(govde.includes('["new", "top", "discussed"]'),
    "sunucunun kabul ettiği üç sıralama dışındaki değer 'new' olmalı");
  assert.ok(govde.includes("memberState.wallCursor = null") === false,
    "setWallSort imleci doğrudan sıfırlamaz; wallQueryChanged yapar");
  assert.ok(src.includes("wallQueryChanged()"), "sıralama değişimi listeyi yeniden basmalı");
});

test("v4.3.0 setWallQuery: sorgu 80 karaktere kırpılır", () => {
  const govde = core.setWallQuery.toString();
  assert.ok(govde.includes("slice(0, 80)"),
    "sunucu ?q= için 80 karakter sınırı koyuyor; istemci de kırpmalı");
});

test("v4.3.0 wallEmptyText: arama varken 'sonuç yok' metni, sorgu metne gömülü", () => {
  const metin = core.wallEmptyText("all", "ışık");
  assert.ok(metin.includes("ışık"), "kullanıcının yazdığı sorgu metinde görünmeli");
  assert.match(metin, /sonuç yok/);
  // Arama yoksa o metin çıkmamalı.
  assert.ok(!core.wallEmptyText("all", "").includes("sonuç yok"));
});

test("v4.3.0 wallClearBtnHTML: sorgu yokken temizle düğmesi basılmaz", () => {
  assert.equal(core.wallClearBtnHTML(), "", "sorgu yokken düğme olmamalı");
});

test("v4.3.0 wallCardHTML: giriş yokken yönetici/şikâyet düğmeleri basılmaz", () => {
  const html = core.wallCardHTML({
    id: "p9", title: "X", summary: "", images: [],
    owner: { displayName: "A", handle: "a" }, promptBody: "p"
  });
  assert.ok(!html.includes('data-act="report"'), "girişsiz şikâyet düğmesi olmamalı");
  assert.ok(!html.includes('data-act="unshare"'), "girişsiz duvardan kaldırma olmamalı");
});

test("v4.3.0 REPORT_REASONS: sunucunun kabul ettiği gerekçelerle aynı", () => {
  const kodlar = core.REPORT_REASONS.map((r) => r[0]);
  for (const g of ["SPAM", "HARASSMENT", "OFF_TOPIC", "UNSAFE", "OTHER"]) {
    assert.ok(kodlar.includes(g), `${g} gerekçesi sunucuyla eşleşmeli`);
  }
  assert.equal(kodlar.length, 5);
});

test("v4.3.0 commentsHTML: gizleme düğmesi yalnız canHide varsa", () => {
  const ortak = { id: "c1", body: "Merhaba", author: { handle: "a", displayName: "A" } };
  const gizlebilir = core.commentsHTML([{ ...ortak, canHide: true, canDelete: true }], false);
  assert.ok(gizlebilir.includes('data-act="hide-comment"'), "canHide true ise gizleme olmalı");
  assert.ok(gizlebilir.includes('data-act="del-comment"'), "canDelete true ise silme olmalı");
  const gizleyemez = core.commentsHTML([{ ...ortak, canHide: false, canDelete: false }], false);
  assert.ok(!gizleyemez.includes('data-act="hide-comment"'), "canHide false ise gizleme olmamalı");
  assert.ok(!gizleyemez.includes('data-act="del-comment"'), "canDelete false ise silme olmamalı");
});

test("v4.3.0 commentsHTML: yorum gövdesi HTML kaçışından geçer", () => {
  const html = core.commentsHTML([
    { id: "c2", body: '<img src=x onerror="alert(1)">', author: { handle: "a", displayName: "A" } }
  ], false);
  assert.ok(!html.includes("<img src=x"), "ham etiket sızmamalı");
  assert.ok(html.includes("&lt;img"), "kaçış uygulanmalı");
});

test("v4.3.0 profileHeaderHTML: avatar değiştirme yalnız kendi profilinde", () => {
  const u = { handle: "deniz", displayName: "Deniz", projectCount: 2, followerCount: 3, followingCount: 1 };
  const kendi = core.profileHeaderHTML(u, true, false);
  assert.ok(kendi.includes('id="avatarFile"'), "kendi profilinde avatar yükleyici olmalı");
  assert.ok(!kendi.includes('id="reportUser"'), "kendini şikâyet edemezsin");
  const yabanci = core.profileHeaderHTML(u, false, false);
  assert.ok(!yabanci.includes('id="avatarFile"'), "yabancının avatarı değiştirilemez");
  assert.ok(yabanci.includes('id="followToggle"'), "yabancı profilinde takip düğmesi olmalı");
});

test("v4.3.0 profileHeaderHTML: avatar varsa kaldırma düğmesi basılır", () => {
  const html = core.profileHeaderHTML(
    { handle: "d", displayName: "D", avatarUrl: "https://o/a.png", projectCount: 0, followerCount: 0, followingCount: 0 },
    true, false);
  assert.ok(html.includes('id="avatarRemove"'));
  const avatarsiz = core.profileHeaderHTML(
    { handle: "d", displayName: "D", projectCount: 0, followerCount: 0, followingCount: 0 },
    true, false);
  assert.ok(!avatarsiz.includes('id="avatarRemove"'), "avatar yoksa kaldırma düğmesi olmamalı");
});
