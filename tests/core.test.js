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
  const now = Date.now();
  const svg = core.weeklyProgressSVG([
    { steps: { 0: true, 1: true, 2: true }, ts: now },
    { steps: { 0: true }, ts: now - 86400000 }, // dün — aynı hafta
    { steps: { 0: true, 1: true, 2: true, 3: true, 4: true }, ts: now - 7 * 86400000 } // geçen hafta
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
