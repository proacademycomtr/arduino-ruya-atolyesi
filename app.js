/* ═══════════════════════════════════════════════════════════
   ARDUINO RÜYA ATÖLYESİ — Uygulama Mantığı
   - Gemini / OpenAI API entegrasyonu (anahtar yalnızca tarayıcıda)
   - Anahtar yoksa yerleşik demo rehberler
   ═══════════════════════════════════════════════════════════ */

"use strict";

/* ───────────────────── Sabitler ───────────────────── */
const STORAGE_KEY = "arduinoDreamLab.settings.v1";

/* Sağlayıcı kataloğu — openaiCompat olanlar /chat/completions uç noktasını kullanır */
const PROVIDERS = [
  { id: "gemini", label: "Google Gemini", keyLabel: "API Anahtarı", keyHint: 'Gemini anahtarı almak için: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>', keyPlaceholder: "AIza... ile başlayan anahtar", defaultModel: "gemini-2.0-flash", modelPlaceholder: "gemini-2.0-flash" },
  { id: "openai", label: "OpenAI (ChatGPT)", keyLabel: "API Anahtarı", keyHint: 'OpenAI anahtarı almak için: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a>', keyPlaceholder: "sk-... ile başlayan anahtar", defaultModel: "gpt-4o-mini", modelPlaceholder: "gpt-4o-mini" },
  { id: "anthropic", label: "Anthropic (Claude)", keyLabel: "API Anahtarı", keyHint: 'Claude anahtarı almak için: <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com/settings/keys</a>', keyPlaceholder: "sk-ant-... ile başlayan anahtar", defaultModel: "claude-sonnet-4-20250514", modelPlaceholder: "claude-sonnet-4-..." },
  { id: "groq", label: "Groq (Hızlı & Ücretsiz Kota)", keyLabel: "API Anahtarı", keyHint: 'Groq anahtarı almak için: <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>', keyPlaceholder: "gsk_... ile başlayan anahtar", defaultModel: "llama-3.3-70b-versatile", modelPlaceholder: "llama-3.3-70b-versatile" },
  { id: "openrouter", label: "OpenRouter (çoklu model)", keyLabel: "API Anahtarı", keyHint: 'OpenRouter anahtarı almak için: <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener">openrouter.ai/settings/keys</a>', keyPlaceholder: "sk-or-... ile başlayan anahtar", defaultModel: "google/gemini-2.0-flash-001", modelPlaceholder: "saglayici/model-adi" },
  { id: "deepseek", label: "DeepSeek", keyLabel: "API Anahtarı", keyHint: 'DeepSeek anahtarı almak için: <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">platform.deepseek.com/api_keys</a>', keyPlaceholder: "sk-... ile başlayan anahtar", defaultModel: "deepseek-chat", modelPlaceholder: "deepseek-chat" },
  { id: "mistral", label: "Mistral AI", keyLabel: "API Anahtarı", keyHint: 'Mistral anahtarı almak için: <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener">console.mistral.ai/api-keys</a>', keyPlaceholder: "anahtar", defaultModel: "mistral-small-latest", modelPlaceholder: "mistral-small-latest" },
  { id: "custom", label: "Özel / OpenAI Uyumlu (Ollama vb.)", keyLabel: "API Anahtarı (gerekmiyorsa boş bırak)", keyHint: 'Yerel model için örnek: Ollama’yı çalıştır ve sunucu olarak <code>http://localhost:11434/v1</code> yaz. Anahtar gerekmez.', keyPlaceholder: "opsiyonel", defaultModel: "", modelPlaceholder: "llama3.2", needsBaseURL: true }
];
const providerById = (id) => PROVIDERS.find((p) => p.id === id);

const PROMPT_TEMPLATE = `Sen "Arduino Rüya Atölyesi" adlı eğitici platformun yapay zekâ öğretmenisin.
Görevin: ortaokul / lise / üniversite öğrencisinin hayalindeki Arduino projesini GERÇEKLEŞTİREBİLMESİ için eksiksiz, güvenli ve anlaşılır bir rehber üretmek.

KURALLAR:
1. Türkçe yaz. Samimi ama net bir öğretmen tonu kullan. Emojilerle sıcaklık kat (abartma).
2. Yalnızca GEÇERLİ JSON döndür. Markdown kod bloğu, açıklama veya JSON dışı HİÇBİR metin yazma. JSON şeması:
{
  "title": string,
  "difficulty": "Başlangıç" | "Orta" | "İleri",
  "summary": string,
  "materials": [ { "name": string, "quantity": string, "purpose": string } ],
  "wiring": [ { "from": string, "to": string, "note": string } ],
  "steps": [ { "title": string, "detail": string, "tip": string } ],
  "tips": [string],
  "code": string,
  "wokwiHints": [ { "match": string, "part": string, "type": string, "pins": { object } } ]
}
3. materials 5-12 parça, wiring 6-14 satır, steps 6-10 adım, tips 3-6 madde içersin.
4. Kod: setup()/loop() içeren, bilinen kütüphanelerle derlenebilir seviyede olsun, kritik satırlara Türkçe yorum ekle.
5. Bağlantılarda 5V/3.3V/GND uyarılarını unutma; gerekirse direnç değerleri ver.
6. wokwiHints: elektrikli her parça için bir öğe üret. "match": malzeme adında geçen kısa kelime (örn "DHT11"). "part": benzersiz kimlik (örn "dht1"). "type": Wokwi parça tipi — yalnızca şu geçerli tipleri kullan: "wokwi-dht22", "wokwi-hc-sr04", "wokwi-pir-motion-sensor", "wokwi-led", "wokwi-rgb-led", "wokwi-buzzer", "wokwi-pushbutton", "wokwi-potentiometer", "wokwi-photoresistor-sensor", "wokwi-servo", "wokwi-relay-module", "wokwi-lcd1602", "wokwi-ssd1306", "wokwi-slide-switch", "wokwi-analog-joystick", "wokwi-ntc-temperature-sensor". Başka tip UYDURMA — Wokwi'de olmayan parça (L298N, DC motor, nem sensörü, HC-05, ESP) için wokwiHints öğesi ÜRETME. "pins": wiring satırlarında geçen pin kelimesi → Wokwi pin adı (örn { "VCC": "VCC", "DATA": "SDA", "GND": "GND" }); LED için { "A": "A", "C": "C" }; buton için { "1": "1.l", "2": "2.l" }; röle için { "VCC": "VCC", "GND": "GND", "IN": "IN", "COM": "COM", "NO": "NO", "NC": "NC" }. Kelimeleri wiring satırlarındaki kelimelerle tutarlı yaz.`;

/* ───────────────────── DOM Referansları ───────────────────── */
const $ = (id) => document.getElementById(id);

const form = $("ideaForm");
const ideaInput = $("ideaInput");
const charCount = $("charCount");
const generateBtn = $("generateBtn");
const loader = $("loader");
const loaderText = $("loaderText");
const errorBanner = $("errorBanner");
const errorText = $("errorText");
const resultSection = $("resultSection");
const resultCard = $("resultCard");
const aiStatus = $("aiStatus");
const settingsModal = $("settingsModal");
const openSettingsBtn = $("openSettings");
const closeSettingsBtn = $("closeSettings");
const settingsForm = $("settingsForm");
const providerSelect = $("providerSelect");
const apiKeyInput = $("apiKeyInput");
const keyHint = $("keyHint");
const clearKeyBtn = $("clearKeyBtn");
const modelInput = $("modelInput");
const modelHint = $("modelHint");
const baseURLGroup = $("baseURLGroup");
const baseURLInput = $("baseURLInput");
const testConnBtn = $("testConnBtn");
const testResult = $("testResult");
const fetchModelsBtn = $("fetchModelsBtn");
const modelPicker = $("modelPicker");
const modelRows = $("modelRows");
const modelSearch = $("modelSearch");
const statsWrap = $("statsWrap");
const pricePt = $("pricePt");
const priceCt = $("priceCt");
const priceHint = $("priceHint");
const savePriceBtn = $("savePriceBtn");
const langToggle = $("langToggle");

/* ───────────────────── Ayarlar ───────────────────── */
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}
function saveSettings(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const settings = loadSettings();

function hasApiKey() {
  if (settings.provider === "custom") {
    return Boolean((settings.baseURL || "").trim());
  }
  return Boolean(settings.apiKey && settings.apiKey.trim().length >= 10);
}
function currentProvider() {
  return providerById(settings.provider) || providerById("gemini");
}
function providerDisplayName(id) {
  return providerById(id)?.label || "Yapay Zekâ";
}
function updateStatusPill() {
  if (hasApiKey()) {
    aiStatus.dataset.state = "live";
    aiStatus.querySelector(".status-label").textContent = providerDisplayName(settings.provider).split(" (")[0] + t(" Bağlı");
    aiStatus.title = getLang() === "en" ? "Live AI responses active: " + providerDisplayName(settings.provider) : "Gerçek yapay zekâ yanıtı aktif: " + providerDisplayName(settings.provider);
  } else {
    aiStatus.dataset.state = "demo";
    aiStatus.querySelector(".status-label").textContent = t("Demo Modu");
    aiStatus.title = getLang() === "en" ? "Add an API key in Settings to enable live AI" : "Ayarlar'dan API anahtarı ekleyerek gerçek AI'ı etkinleştir";
  }
}

/* ───────────────────── Ayarlar Modalı ───────────────────── */
function populateProviderSelect() {
  providerSelect.innerHTML = PROVIDERS.map((p) =>
    `<option value="${p.id}">${esc(t(p.label))}</option>`).join("");
}
function openModal() {
  populateProviderSelect();
  providerSelect.value = settings.provider || "gemini";
  apiKeyInput.value = settings.apiKey || "";
  modelInput.value = settings.model || "";
  baseURLInput.value = settings.baseURL || "";
  updateKeyHint();
  updatePriceEditor();
  updateCustomPricesEditor();
  updateRateStatus();
  renderStats();
  settingsModal.hidden = false;
  apiKeyInput.focus();
}
function closeModal() {
  settingsModal.hidden = true;
}
function updateKeyHint() {
  const p = providerById(providerSelect.value) || PROVIDERS[0];
  const en = getLang() === "en";
  keyHint.innerHTML = p.keyHint;
  apiKeyInput.placeholder = p.keyPlaceholder;
  apiKeyInput.closest(".field-group").querySelector("label").textContent = t(p.keyLabel);
  modelInput.placeholder = p.modelPlaceholder;
  modelHint.textContent = en
    ? "Leave empty → default: " + (p.defaultModel || "provider default")
    : "Boş bırak → varsayılan: " + (p.defaultModel || "sağlayıcı seçimi");
  modelPicker.hidden = true;
  baseURLGroup.hidden = !p.needsBaseURL;
  updatePriceEditor();
}

openSettingsBtn.addEventListener("click", openModal);
closeSettingsBtn.addEventListener("click", closeModal);
providerSelect.addEventListener("change", updateKeyHint);
aiStatus.addEventListener("click", openModal);
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !settingsModal.hidden) closeModal();
});

settingsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  settings.provider = providerSelect.value;
  settings.apiKey = apiKeyInput.value.trim();
  settings.model = modelInput.value.trim();
  settings.baseURL = baseURLInput.value.trim().replace(/\/+$/, "");
  saveSettings(settings);
  updateStatusPill();
  updatePriceEditor();
  closeModal();
});
clearKeyBtn.addEventListener("click", () => {
  settings.apiKey = "";
  settings.model = "";
  settings.baseURL = "";
  saveSettings(settings);
  apiKeyInput.value = "";
  modelInput.value = "";
  baseURLInput.value = "";
  updateStatusPill();
});

/* ───────────────────── Bağlantı Testi ───────────────────── */
function showTestResult(ok, msg) {
  testResult.hidden = false;
  testResult.className = "test-result" + (ok ? " ok" : " err");
  testResult.textContent = (ok ? "✅ " : "❌ ") + msg;
}

async function testConnection() {
  const provider = providerSelect.value;
  const key = apiKeyInput.value.trim();
  const model = modelInput.value.trim();
  const baseURL = baseURLInput.value.trim().replace(/\/+$/, "");
  const p = providerById(provider);

  if (provider !== "custom" && key.length < 10) {
    showTestResult(false, "Önce geçerli bir API anahtarı gir.");
    return;
  }
  if (provider === "custom") {
    if (!baseURL) { showTestResult(false, "Önce sunucu adresi (Base URL) gir."); return; }
    try { assertSecureURL(baseURL); } catch (e) { showTestResult(false, e.message); return; }
  }

  testConnBtn.disabled = true;
  testResult.hidden = false;
  testResult.className = "test-result";
  testResult.textContent = "⏳ Bağlantı test ediliyor…";

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20000);
  const t0 = performance.now();
  try {
    let detail = "";
    if (provider === "gemini") {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, { signal: ctrl.signal });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error?.message || `Gemini HTTP ${res.status}`); }
      const d = await res.json();
      detail = `${(d.models || []).length} model erişilebilir`;
    } else if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: model || p.defaultModel, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
        signal: ctrl.signal
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error?.message || `Anthropic HTTP ${res.status}`); }
      detail = model || p.defaultModel;
    } else {
      const base = p.needsBaseURL ? assertSecureURL(baseURL) : OPENAI_COMPAT_ENDPOINTS[provider];
      const headers = { "Content-Type": "application/json" };
      if (key) headers.Authorization = `Bearer ${key}`;
      const res = await fetch(base + "/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({ model: model || p.defaultModel, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
        signal: ctrl.signal
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((typeof b?.error === "string" ? b.error : b?.error?.message) || `${p.label} HTTP ${res.status}`);
      }
      const d = await res.json();
      detail = d?.model || model || p.defaultModel;
    }
    showTestResult(true, `Bağlantı başarılı — ${detail} (${fmtDur(performance.now() - t0)})`);
  } catch (e) {
    showTestResult(false, e.name === "AbortError" ? "Zaman aşımı (20 sn)" : e.message);
  } finally {
    clearTimeout(to);
    testConnBtn.disabled = false;
  }
}

/* ───────────────────── Model Listesi Getir ───────────────────── */
async function fetchModelList() {
  const provider = providerSelect.value;
  const key = apiKeyInput.value.trim();
  const baseURL = baseURLInput.value.trim().replace(/\/+$/, "");
  const p = providerById(provider);
  try {
    fetchModelsBtn.disabled = true;
    modelHint.textContent = "⏳ Modeller alınıyor…";
    let ids = [];
    if (provider === "gemini") {
      if (!key) throw new Error("Önce API anahtarını gir");
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const d = await res.json();
      ids = (d.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => (m.name || "").replace(/^models\//, ""));
    } else if (provider === "anthropic") {
      if (!key) throw new Error("Önce API anahtarını gir");
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }
      });
      if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
      const d = await res.json();
      ids = (d.data || []).map((m) => m.id);
    } else {
      const base = p.needsBaseURL ? assertSecureURL(baseURL) : OPENAI_COMPAT_ENDPOINTS[provider];
      if (!base) throw new Error("Uç nokta bulunamadı");
      const headers = {};
      if (key) headers.Authorization = `Bearer ${key}`;
      const res = await fetch(base + "/models", { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status} — bu sağlayıcı model listesini desteklemiyor olabilir`);
      const d = await res.json();
      ids = (d.data || d.models || []).map((m) => m.id || m.name).filter(Boolean);
    }
    ids = [...new Set(ids)].sort();
    fetchedModels = ids;
    modelHint.textContent = ids.length
      ? `${ids.length} model bulundu — model kutusuna tıkla, ara ve seç`
      : "Model listesi boş döndü";
    if (ids.length) { modelPicker.hidden = false; renderModelRows(); }
  } catch (e) {
    modelHint.textContent = "❌ " + e.message;
  } finally {
    fetchModelsBtn.disabled = false;
  }
}

testConnBtn.addEventListener("click", testConnection);
fetchModelsBtn.addEventListener("click", fetchModelList);

/* ───────────────────── Model Favorileri & Seçici ───────────────────── */
const FAVS_KEY = "arduinoDreamLab.modelFavs.v1";
let fetchedModels = [];

function loadFavs() {
  try { return JSON.parse(localStorage.getItem(FAVS_KEY)) || {}; } catch { return {}; }
}
function favKey() { return providerSelect.value || "gemini"; }
function favSet(provider, name, on) {
  const all = loadFavs();
  const set = new Set(all[provider] || []);
  if (on) set.add(name); else set.delete(name);
  all[provider] = [...set];
  localStorage.setItem(FAVS_KEY, JSON.stringify(all));
}
function renderModelRows() {
  const q = (modelSearch.value || "").toLowerCase().trim();
  const favs = new Set(loadFavs()[favKey()] || []);
  let rows = fetchedModels.map((id) => ({ id, fav: favs.has(id) }));
  if (q) rows = rows.filter((r) => r.id.toLowerCase().includes(q));
  rows.sort((a, b) => (b.fav - a.fav) || a.id.localeCompare(b.id));
  if (!rows.length) {
    modelRows.innerHTML = '<div class="model-empty">Model yok — önce "⬇️ Getir" ile listeyi çek.</div>';
    return;
  }
  modelRows.innerHTML = rows.slice(0, 100).map((r) =>
    `<div class="model-row${r.fav ? " fav" : ""}" role="button" tabindex="0" data-mid="${esc(r.id)}">
      <span class="name" title="${esc(r.id)}">${esc(r.id)}</span>
      <button class="star" data-star="${esc(r.id)}" type="button" aria-label="Favori">★</button>
    </div>`).join("");
  modelRows.querySelectorAll(".model-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-star]")) return;
      modelInput.value = row.dataset.mid;
      modelPicker.hidden = true;
      modelHint.textContent = "✅ " + row.dataset.mid;
    });
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); modelInput.value = row.dataset.mid; modelPicker.hidden = true; }
    });
  });
  modelRows.querySelectorAll("[data-star]").forEach((st) => {
    st.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = st.dataset.star;
      const nowFav = !st.closest(".model-row").classList.contains("fav");
      favSet(favKey(), id, nowFav);
      renderModelRows();
    });
  });
}
modelInput.addEventListener("focus", () => {
  modelPicker.hidden = false;
  renderModelRows();
  setTimeout(() => modelSearch.focus(), 0);
});
modelSearch.addEventListener("input", renderModelRows);
document.addEventListener("click", (e) => {
  if (!e.target.closest("#modelPicker") && !e.target.closest("#modelInput")) modelPicker.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modelPicker.hidden) { modelPicker.hidden = true; }
});

/* ───────────────────── Model Fiyatları & Maliyet ───────────────────── */
const PRICES_KEY = "arduinoDreamLab.prices.v1";
const KNOWN_PRICES = {
  "gpt-4o-mini": { pt: 0.15, ct: 0.6 },
  "gpt-4o": { pt: 2.5, ct: 10 },
  "gpt-4.1-mini": { pt: 0.4, ct: 1.6 },
  "gpt-4.1": { pt: 2, ct: 8 },
  "gemini-2.0-flash": { pt: 0.1, ct: 0.4 },
  "gemini-2.0-flash-lite": { pt: 0.075, ct: 0.3 },
  "gemini-1.5-flash": { pt: 0.075, ct: 0.3 },
  "gemini-1.5-pro": { pt: 1.25, ct: 5 },
  "claude-3-5-haiku": { pt: 0.8, ct: 4 },
  "claude-3-5-sonnet": { pt: 3, ct: 15 },
  "claude-sonnet-4": { pt: 3, ct: 15 },
  "claude-opus-4": { pt: 15, ct: 75 },
  "deepseek-chat": { pt: 0.27, ct: 1.1 },
  "mistral-small-latest": { pt: 0.2, ct: 0.6 },
  "llama-3.3-70b-versatile": { pt: 0.59, ct: 0.79 }
};

function loadPrices() {
  try { return JSON.parse(localStorage.getItem(PRICES_KEY)) || {}; } catch { return {}; }
}
function priceFor(model) {
  const m = String(model || "").toLowerCase();
  const custom = loadPrices();
  for (const k of Object.keys(custom)) {
    if (m.includes(k)) return { ...custom[k], source: "özel" };
  }
  for (const k of Object.keys(KNOWN_PRICES)) {
    if (m.includes(k)) return { ...KNOWN_PRICES[k], source: "tahmini" };
  }
  return null;
}
function estCost(usage, model) {
  if (!usage) return null;
  const pr = priceFor(model);
  if (!pr) return null;
  return (usage.pt || 0) / 1e6 * pr.pt + (usage.ct || 0) / 1e6 * pr.ct;
}
function fmtCost(usd) {
  if (usd == null) return "—";
  if (usd > 0 && usd < 0.01) return "$" + usd.toFixed(4);
  return "$" + usd.toFixed(2);
}
function updatePriceEditor() {
  const m = settings.model || "";
  const pr = priceFor(m);
  if (pr && pr.source === "özel") {
    pricePt.value = pr.pt; priceCt.value = pr.ct;
    priceHint.textContent = `💾 ${m}: özel fiyat kayıtlı (${pr.pt} / ${pr.ct} USD per 1M).`;
  } else if (pr) {
    priceHint.textContent = `💡 ${m || "model"} için bilinen fiyat: ${pr.pt} / ${pr.ct} USD per 1M (tahmini). Üste yazabilirsin.`;
  } else {
    priceHint.textContent = m ? `"${m}" için fiyat bilinmiyor — girersen maliyet hesaplanır.` : "Model seç ya da fiyat gir; bilinen modellerde maliyet otomatik hesaplanır.";
  }
}
savePriceBtn.addEventListener("click", () => {
  const m = (settings.model || "").trim();
  if (!m) { priceHint.textContent = "Önce bir model adı gir/kaydet."; return; }
  const pt = parseFloat(pricePt.value), ct = parseFloat(priceCt.value);
  if (isNaN(pt) && isNaN(ct)) { priceHint.textContent = "Fiyat kutularına sayı gir."; return; }
  const all = loadPrices();
  all[m.toLowerCase()] = { pt: isNaN(pt) ? 0 : pt, ct: isNaN(ct) ? 0 : ct };
  localStorage.setItem(PRICES_KEY, JSON.stringify(all));
  priceHint.textContent = `✅ ${m} fiyatı kaydedildi. Tablo güncellendi.`;
  renderStats();
});

/* ── Öğretmen malzeme fiyat kataloğu editörü (v2.11.0) ── */
const customPricesInput = $("customPricesInput");
const saveCustomPricesBtn = $("saveCustomPricesBtn");
const clearCustomPricesBtn = $("clearCustomPricesBtn");
const customPricesHint = $("customPricesHint");
const exportCatalogBtn = $("exportCatalogBtn");
const importCatalogBtn = $("importCatalogBtn");
const catalogFileInput = $("catalogFile");
const budgetInput = $("budgetInput");
function updateCustomPricesEditor() {
  if (!customPricesInput) return;
  const map = loadCustomPrices();
  customPricesInput.value = Object.entries(map).map(([k, v]) => `${k}: ${v}`).join("\n");
  if (budgetInput) {
    budgetInput.value = loadBudget() || "";
    const fb = fileCatalogBudget();
    budgetInput.placeholder = fb ? `${t("depo")}: ${fb}` : "örn. 25";
  }
  if (customPricesHint) customPricesHint.textContent = Object.keys(map).length ? `✅ ${Object.keys(map).length} özel fiyat aktif — katalog fiyatını override eder.` : "";
}
if (saveCustomPricesBtn) saveCustomPricesBtn.addEventListener("click", () => {
  const map = parseCustomPrices(customPricesInput.value);
  const tried = customPricesInput.value.split(/\n+/).filter((l) => l.trim()).length;
  saveCustomPrices(map);
  if (customPricesHint) customPricesHint.textContent = tried && !Object.keys(map).length
    ? t("Hiç satır okunamadı — 'Parça adı: fiyat' biçimini kontrol et.")
    : `✅ ${t("özel fiyat kaydedildi")}: ${Object.keys(map).length}`;
  updateCustomPricesEditor();
  if (currentGuide) renderGuide(currentGuide, undefined, { scroll: false });
});
if (clearCustomPricesBtn) clearCustomPricesBtn.addEventListener("click", () => {
  saveCustomPrices({});
  updateCustomPricesEditor();
  if (customPricesHint) customPricesHint.textContent = t("Özel fiyatlar temizlendi — katalog fiyatları kullanılıyor.");
});
/* Katalog JSON paylaşımı + bütçe sınırı (v2.12.0) */
if (exportCatalogBtn) exportCatalogBtn.addEventListener("click", () => {
  const payload = { app: "arduino-ruya-atolyesi", kind: "fiyat-katalogu", version: 1, prices: loadCustomPrices(), budget: loadBudget() };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  a.download = "fiyat-katalogu.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
if (importCatalogBtn) importCatalogBtn.addEventListener("click", () => catalogFileInput && catalogFileInput.click());
if (catalogFileInput) catalogFileInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseCatalogJSON(reader.result);
    if (!parsed) {
      if (customPricesHint) customPricesHint.textContent = t("Katalog okunamadı — {prices: {...}} biçiminde olmalı.");
      return;
    }
    saveCustomPrices(parsed.prices);
    localStorage.setItem(BUDGET_KEY, String(parsed.budget || ""));
    updateCustomPricesEditor();
    if (customPricesHint) customPricesHint.textContent = `✅ ${t("Katalog içe aktarıldı")}: ${Object.keys(parsed.prices).length}${parsed.budget ? " + " + t("bütçe") + " " + fmtTL(parsed.budget) : ""}`;
    if (currentGuide) renderGuide(currentGuide, undefined, { scroll: false });
  };
  reader.readAsText(file);
  e.target.value = "";
});if (budgetInput) budgetInput.addEventListener("change", () => {
  const v = parseFloat(budgetInput.value);
  localStorage.setItem(BUDGET_KEY, isFinite(v) && v > 0 ? String(v) : "");
  if (currentGuide) renderGuide(currentGuide, undefined, { scroll: false });
});

/* ── Çevrimiçi kur (v2.15.0) ── */
const rateStatus = $("rateStatus");
const updateRateBtn = $("updateRateBtn");
const classSizeInput = $("classSizeInput");
function updateRateStatus() {
  if (!rateStatus) return;
  const o = loadRate();
  const age = rateAgeHours();
  const ageTxt = o.ts ? (age < 1 ? t("az önce") : age < 24 ? Math.round(age) + " " + t("saat önce") : Math.round(age / 24) + " " + t("gün önce")) : t("hiç");
  rateStatus.textContent = `1 USD = ${o.rate.toFixed(2)}₺ (${ageTxt} ${t("güncellendi")})`;
  if (classSizeInput) classSizeInput.value = loadClassSize() || "";
}
if (updateRateBtn) updateRateBtn.addEventListener("click", async () => {
  if (rateStatus) rateStatus.textContent = t("⏳ Kur güncelleniyor…");
  const r = await updateRateFromWeb();
  updateRateStatus();
  if (r.ok) {
    if (customPricesHint) customPricesHint.textContent = `✅ ${t("Kur güncellendi")}: 1 USD = ${r.rate.toFixed(2)}₺`;
    if (currentGuide) renderGuide(currentGuide, undefined, { scroll: false });
  } else if (customPricesHint) {
    customPricesHint.textContent = t("❌ Kur alınamadı — internet bağlantısını kontrol et. Saklanan kur kullanılıyor.");
  }
});
/* Sınıf mevcudu (v2.17.0): sınıf raporundaki bütçe planlayıcısı için */
if (classSizeInput) classSizeInput.addEventListener("change", () => {
  const v = parseInt(classSizeInput.value, 10);
  localStorage.setItem(CLASS_SIZE_KEY, isFinite(v) && v > 0 ? String(v) : "");
});

/* ───────────────────── Sağlayıcı İstatistikleri ───────────────────── */
const STATS_KEY = "arduinoDreamLab.stats.v1";

function loadStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY)) || []; } catch { return []; }
}
function recordStats(e) {
  const list = loadStats();
  list.push({ ...e, ts: Date.now() });
  localStorage.setItem(STATS_KEY, JSON.stringify(list.slice(-100)));
}
function fmtDur(ms) {
  return ms < 1000 ? Math.round(ms) + " ms" : (ms / 1000).toFixed(1) + " sn";
}
function renderStats() {
  const wrap = statsWrap;
  if (!wrap) return;
  const list = loadStats();
  if (!list.length) {
    wrap.innerHTML = '<p class="field-hint">Henüz üretim kaydı yok. Rehber oluşturdukça süre ve token kullanımı burada birikir.</p>';
    return;
  }
  const oks = list.filter((x) => x.ok);
  const avg = oks.length ? oks.reduce((s, x) => s + x.ms, 0) / oks.length : 0;
  const tokens = oks.reduce((s, x) => s + ((x.usage?.pt || 0) + (x.usage?.ct || 0)), 0);
  const costKnown = oks.filter((x) => estCost(x.usage, x.model) != null);
  const totCost = costKnown.reduce((s, x) => s + estCost(x.usage, x.model), 0);
  const rows = [...list].reverse().slice(0, 8).map((x) => {
    const d = new Date(x.ts);
    const when = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const tok = x.usage ? `${x.usage.pt || 0}+${x.usage.ct || 0}` : "—";
    const cost = estCost(x.usage, x.model);
    const costTxt = cost != null ? fmtCost(cost) : "—";
    return `<tr><td>${esc(when)}</td><td>${esc(providerDisplayName(x.provider).split(" (")[0])}</td><td>${esc(x.model || "—")}</td><td class="num">${fmtDur(x.ms)}</td><td class="num">${tok}</td><td class="num">${costTxt}</td><td>${x.ok ? "✅" : "❌"}</td></tr>`;
  }).join("");
  wrap.innerHTML = `
    <div class="stats-summary">
      <span>Üretim: <strong>${list.length}</strong></span>
      <span>Başarılı: <strong>${oks.length}</strong></span>
      <span>Ort. süre: <strong>${fmtDur(avg)}</strong></span>
      <span>Toplam token: <strong>${tokens.toLocaleString("tr-TR")}</strong></span>
      <span>Tahmini maliyet: <strong>${costKnown.length ? fmtCost(totCost) + " (" + costKnown.length + "/" + oks.length + ")" : "—"}</strong></span>
    </div>
    <div style="overflow-x:auto">
      <table class="stats-table">
        <thead><tr><th>Zaman</th><th>Sağlayıcı</th><th>Model</th><th>Süre</th><th>Token (g+ç)</th><th>Maliyet</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ───────────────────── Form & Çipler ───────────────────── */
const costHint = $("costHint");
let costHintTimer = null;
let costHintSeq = 0;
ideaInput.addEventListener("input", () => {
  charCount.textContent = `${ideaInput.value.length} / 1200`;
  // Canlı maliyet ipucu (v2.14.0 demo / v2.16.0 AI): yazarken 400ms gecikmeli tahmin.
  // Yarış koşulu koruması: yalnızca en yeni girişin sonucu basılır.
  if (!costHint) return;
  clearTimeout(costHintTimer);
  costHintTimer = setTimeout(() => {
    const seq = ++costHintSeq;
    const val = ideaInput.value;
    costHint.classList.add("thinking");
    liveCostHint(val, (msg) => {
      if (seq !== costHintSeq) return; // bu arada kullanıcı yeniden yazdı
      costHint.textContent = msg || "";
      costHint.classList.remove("thinking");
    });
  }, 400);
});

/* ───────────────────── Sesli Fikir Girişi (Web Speech API) ───────────────────── */
const voiceRow = $("voiceRow");
const voiceBtn = $("voiceBtn");
const voiceStatus = $("voiceStatus");
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let recog = null;
let recogActive = false;
let baseIdeaValue = "";
if (SR) voiceRow.hidden = false;
voiceBtn.addEventListener("click", () => {
  if (!SR) {
    voiceStatus.textContent = t("Tarayıcın sesli girişi desteklemiyor — Chrome veya Edge dene.");
    return;
  }
  if (recogActive) { try { recog.stop(); } catch {} return; }
  recog = new SR();
  recog.lang = getLang() === "en" ? "en-US" : "tr-TR";
  recog.interimResults = true;
  recog.continuous = true;
  baseIdeaValue = ideaInput.value ? ideaInput.value + " " : "";
  let finalText = "";
  recog.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      if (res.isFinal) finalText += res[0].transcript + " ";
      else interim += res[0].transcript;
    }
    ideaInput.value = (baseIdeaValue + finalText + interim).trimStart().slice(0, 1200);
    ideaInput.dispatchEvent(new Event("input"));
  };
  recog.onerror = (ev) => {
    voiceStatus.textContent = ev.error === "not-allowed"
      ? t("Mikrofon izni reddedildi.")
      : t("❌ Ses tanıma hatası: ") + ev.error;
  };
  recog.onend = () => {
    recogActive = false;
    voiceBtn.classList.remove("listening");
    if (!voiceStatus.textContent.startsWith("❌") && voiceStatus.textContent !== t("Mikrofon izni reddedildi.")) {
      voiceStatus.textContent = "";
    }    ideaInput.focus();
  };
  voiceStatus.textContent = t("🎤 Mikrofonla anlat…");
  voiceBtn.classList.add("listening");
  recogActive = true;
  try { recog.start(); } catch (e) { recogActive = false; voiceBtn.classList.remove("listening"); }
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    ideaInput.value = chip.textContent.replace(/^\S+\s/, "");
    ideaInput.dispatchEvent(new Event("input"));
    ideaInput.focus();
  });
});
$("dismissError").addEventListener("click", () => {
  errorBanner.hidden = true;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const idea = ideaInput.value.trim();
  currentIdea = idea;
  if (idea.length < 5) {
    showError("Lütfen proje fikrini biraz daha detaylı yaz 🙂");
    return;
  }
  errorBanner.hidden = true;
  setLoading(true);
  scrollToResults();
  try {
    const guide = hasApiKey() ? await fetchAIGuide(idea) : makeDemoGuide(idea);
    renderGuide(guide);
  } catch (err) {
    console.error(err);
    showError(
      `Yapay zekâ yanıtı alınamadı: ${err.message}. ` +
      "API anahtarını Ayarlar'dan kontrol edebilir, ya da demo moduyla devam edebilirsin."
    );
    renderGuide(makeDemoGuide(idea));
  } finally {
    setLoading(false);
  }
});

function setLoading(on) {
  generateBtn.disabled = on;
  loader.hidden = !on;
  if (on) scrollToResults();
}
let loaderTimer = null;
function startLoaderMessages() {
  const msgs = [
    "Hayalin analiz ediliyor…",
    "Malzemeler seçiliyor…",
    "Devre bağlantıları çiziliyor…",
    "Kod yazılıyor ve yorumlanıyor…",
    "Son rötuşlar…"
  ];
  let i = 0;
  loaderText.textContent = msgs[0];
  loaderTimer = setInterval(() => {
    i = (i + 1) % msgs.length;
    loaderText.textContent = msgs[i];
  }, 2500);
}
function stopLoaderMessages() {
  clearInterval(loaderTimer);
}
function showError(msg) {
  errorText.textContent = msg;
  errorBanner.hidden = false;
}
function scrollToResults() {
  resultSection.hidden = false;
  setTimeout(() => resultSection.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
}

/* ───────────────────── AI Çağrıları ───────────────────── */
let lastAIUsage = null;

async function fetchAIGuide(idea) {
  startLoaderMessages();
  lastAIUsage = null;
  const p = currentProvider();
  const modelUsed = settings.model || p.defaultModel || "(varsayılan)";
  const t0 = performance.now();
  try {
    let guide;
    if (p.id === "gemini") guide = await askGemini(idea);
    else if (p.id === "anthropic") guide = await askAnthropic(idea);
    else guide = await askOpenAICompat(idea);
    recordStats({ ok: true, provider: p.id, model: modelUsed, ms: performance.now() - t0, usage: lastAIUsage });
    return guide;
  } catch (e) {
    recordStats({ ok: false, provider: p.id, model: modelUsed, ms: performance.now() - t0, usage: null });
    throw e;
  } finally {
    stopLoaderMessages();
  }
}

function buildUserPrompt(idea) {
  return `Öğrencinin proje fikri: """${idea}"""

Bu fikri yukarıdaki kurallara göre gerçekleştirilebilir bir Arduino projesine dönüştür ve SADECE JSON döndür.`;
}

async function askGemini(idea) {
  const model = settings.model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${PROMPT_TEMPLATE}\n\n${buildUserPrompt(idea)}` }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: "application/json" }
    })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Gemini HTTP ${res.status}`);
  }
  const data = await res.json();
  lastAIUsage = data?.usageMetadata ? { pt: data.usageMetadata.promptTokenCount, ct: data.usageMetadata.candidatesTokenCount } : null;
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return parseGuideJSON(text);
}

/* Anthropic Messages API — CORS'un açıldığı anthropic-dangerous-direct-browser-access başlığıyla */
async function askAnthropic(idea) {
  const model = settings.model || "claude-sonnet-4-20250514";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.7,
      system: PROMPT_TEMPLATE,
      messages: [{ role: "user", content: buildUserPrompt(idea) }]
    })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Anthropic HTTP ${res.status}`);
  }
  const data = await res.json();
  lastAIUsage = data?.usage ? { pt: data.usage.input_tokens, ct: data.usage.output_tokens } : null;
  const text = (data?.content || []).map((b) => b.text || "").join("");
  return parseGuideJSON(text);
}

/* OpenAI uyumlu /chat/completions: OpenAI, Groq, OpenRouter, DeepSeek, Mistral, Ollama, LM Studio... */
const OPENAI_COMPAT_ENDPOINTS = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  deepseek: "https://api.deepseek.com/v1",
  mistral: "https://api.mistral.ai/v1"
};

function assertSecureURL(urlString) {
  let u;
  try { u = new URL(urlString); } catch { throw new Error("Geçersiz sunucu adresi"); }
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|.*\.local)$/.test(u.hostname);
  if (u.protocol !== "https:" && !isLocal) {
    throw new Error("Sunucu adresi https:// olmalı (ya da yerel adres)");
  }
  return u.toString();
}

async function askOpenAICompat(idea) {
  const p = currentProvider();
  const base = p.needsBaseURL
    ? assertSecureURL(settings.baseURL || "")
    : OPENAI_COMPAT_ENDPOINTS[p.id];
  if (!base) throw new Error("Sağlayıcı uç noktası bulunamadı");
  const model = settings.model || p.defaultModel;
  if (!model) throw new Error("Bu sağlayıcı için bir model adı gir (örn. llama3.2)");

  const headers = { "Content-Type": "application/json" };
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
  if (p.id === "openrouter") {
    headers["HTTP-Referer"] = location.origin || "https://arduino-ruya-atolyesi.local";
    headers["X-Title"] = "Arduino Ruya Atolyesi";
  }

  const res = await fetch(base.replace(/\/+$/, "") + "/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 8192,
      messages: [
        { role: "system", content: PROMPT_TEMPLATE },
        { role: "user", content: buildUserPrompt(idea) }
      ]
    })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || body?.error || `${p.label} HTTP ${res.status}`);
  }
  const data = await res.json();
  lastAIUsage = data?.usage ? { pt: data.usage.prompt_tokens, ct: data.usage.completion_tokens } : null;
  return parseGuideJSON(data?.choices?.[0]?.message?.content || "");
}

function parseGuideJSON(text) {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model JSON döndürmedi");
  const guide = JSON.parse(raw.slice(start, end + 1));
  for (const k of ["title", "difficulty", "summary", "materials", "wiring", "steps", "tips", "code"]) {
    if (!(k in guide)) throw new Error(`Model yanıtta '${k}' alanı eksik`);
  }
  return guide;
}

/* ── AI'lı canlı maliyet tahmini (v2.16.0) ──
   Kullanıcı fikir yazarken API anahtarı varsa fikri AI'a KISA bir istemle gönderir;
   AI yalnızca parça listesi (materials) döndürür, estimateCost ile fiyatlanır.
   Anahtar yoksa/istek başarısızsa mevcut demo-şablon ipucusuna düşer (liveCostHint).
   Sonuç 10 dk önbelleklenir (aynı metin için tekrar çağrı atmaz). */
const AI_COST_TTL = 10 * 60 * 1000;
function buildCostPrompt(idea) {
  return `Öğrencinin Arduino proje fikri: """${idea}"""

Bu fikir için gereken MALZEME listesini tahmin et. SADECE şu JSON'u döndür, başka hiçbir metin yazma:
{"materials":[{"name":"parça adı","quantity":"adet"}]}

Kurallar:
- 4-10 parça; Arduino kartını mutlaka ekle ("Arduino Uno" gibi standart adla).
- Parça adları yaygın satış adları olsun ("SG90 servo motor", "HC-SR04", "220Ω direnç"…).
- quantity: "1", "2", "1+10" gibi kısa yazım; açıklama yazma.`;
}
async function askAICostMaterials(idea) {
  const p = currentProvider();
  const sys = "Sen bir Arduino malzeme uzmanısın. Yalnızca istenen JSON'u döndürürsün, başka hiçbir metin yazmazsın.";
  const user = buildCostPrompt(idea);
  let text = "";
  if (p.id === "gemini") {
    const model = settings.model || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: sys + "\n\n" + user }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: "application/json" }
      })
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = await res.json();
    text = data?.candidates?.[0]?.content?.parts?.map((x) => x.text).join("") || "";
  } else {
    const base = p.needsBaseURL ? assertSecureURL(settings.baseURL || "") : OPENAI_COMPAT_ENDPOINTS[p.id];
    if (!base) throw new Error("uç nokta yok");
    const model = settings.model || p.defaultModel;
    if (!model) throw new Error("model yok");
    const headers = { "Content-Type": "application/json" };
    if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
    const res = await fetch(base.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1024,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }]
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    text = data?.choices?.[0]?.message?.content || "";
  }
  let raw = String(text).trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON yok");
  const parsed = JSON.parse(raw.slice(start, end + 1));
  const mats = Array.isArray(parsed && parsed.materials) ? parsed.materials : null;
  const clean = mats ? mats.filter((m) => m && m.name) : [];
  if (!clean.length) throw new Error("malzeme yok");
  return clean.map((m) => ({ name: String(m.name).slice(0, 60), quantity: String(m.quantity || "1").slice(0, 12) }));
}

/* ───────────────────── Demo Rehber Üretici ───────────────────── */
function makeDemoGuide(idea) {
  const title = idea.length > 60 ? idea.slice(0, 57) + "…" : idea;
  const s = idea.toLowerCase();

  if (s.includes("çizgi") || s.includes("araba") || s.includes("araç")) return demoLineFollower(title);
  if (s.includes("saksı") || s.includes("sula") || s.includes("bitki")) return demoPlantWaterer(title);
  if (s.includes("gece") || s.includes("ldr") || s.includes("fotorezist")) return demoNightLight(title);
  if (s.includes("zar") || s.includes("random") || s.includes("yazı tura")) return demoDice(title);
  if (s.includes("oled") || s.includes("mesafe ölç") || s.includes("cetvel")) return demoOledRuler(title);
  if (s.includes("sıcak") || s.includes("termostat") || s.includes("oda")) return demoThermostat(title);
  if (s.includes("güvenlik") || s.includes("hareket") || s.includes("alarm")) return demoSecurity(title);
  if (s.includes("7 segment") || s.includes("7-segment") || s.includes("yedi segment") || s.includes("sayaç")) return demoSevenSeg(title);
  if (s.includes("park") || s.includes("mesafe")) return demoParkSensor(title);
  if (s.includes("piyano") || s.includes("nota") || s.includes("müzik")) return demoPiano(title);
  if (s.includes("saat") || s.includes("lcd")) return demoLcdClock(title);
  if (s.includes("rgb") || s.includes("mood") || s.includes("lamba")) return demoRgbLamp(title);
  if (s.includes("kilit") || s.includes("kapı") || s.includes("servo")) return demoServoLock(title);
  if (s.includes("ışık") || s.includes("aydınlat")) return demoNightLight(title);
  return demoGeneric(title, idea);
}

const demoMeta = (title, diff, summary) => ({ title, difficulty: diff, summary, ai: false });
/* İleri seviye bölümü: rehberin sonunda katlanabilir kutu olarak gösterilir */
const ADVANCED_META = { title: "🚀 İleri Seviye", emoji: "🚀" };

function demoLineFollower(title) {
  return {
    ...demoMeta(title, "Başlangıç",
      "İki infrared sensörle siyah çizgiyi takip eden, iki tekerlekli mini bir yarış arabası. " +
      "Sensörler çizgiyi görünce motor hızları değişir — araç virajları kendiliğinden döner!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Beyin — tüm kararları verir" },
      { name: "L298N motor sürücü", quantity: "1", purpose: "Motorlara güç ve yön komutu verir" },
      { name: "TCRT5000 IR sensör", quantity: "2", purpose: "Siyah/beyaz çizgiyi ayırt eder" },
      { name: "DC motor + tekerlek", quantity: "2", purpose: "Aracı hareket ettirir" },
      { name: "Serbest teker (kasta tekeri)", quantity: "1", purpose: "Dengeyi sağlar" },
      { name: "Şasi kit", quantity: "1", purpose: "Parçaları üzerine monte ederiz" },
      { name: "18650 pil + yuva", quantity: "2", purpose: "Mobil güç kaynağı" },
      { name: "Jumper kablolar", quantity: "20", purpose: "Bağlantılar" }
    ],
    wiring: [
      { from: "IR sensör SOL VCC / GND", to: "Arduino 5V / GND", note: "Sensörü besle" },
      { from: "IR sensör SOL OUT", to: "Arduino D2", note: "Siyah görürse HIGH verir" },
      { from: "IR sensör SAĞ VCC / GND", to: "Arduino 5V / GND", note: "Sensörü besle" },
      { from: "IR sensör SAĞ OUT", to: "Arduino D3", note: "Aynı şekilde sağ sensör" },
      { from: "L298N IN1 / IN2", to: "Arduino D6 / D7", note: "Sol motor yönü" },
      { from: "L298N IN3 / IN4", to: "Arduino D8 / D9", note: "Sağ motor yönü" },
      { from: "L298N ENA / ENB", to: "Arduino D5 / D10 (PWM)", note: "Hız kontrolü — jumperları çıkar!" },
      { from: "L298N +12V", to: "Pil (+)", note: "Motor gücü pilden gelir" },
      { from: "L298N GND", to: "Pil (−) + Arduino GND", note: "Tüm topraklar birleşmeli" }
    ],
    wokwiHints: [
      { match: "IR sensör SOL", part: "irs1", type: "wokwi-potentiometer", pins: { "VCC": "VCC", "GND": "GND", "OUT": "SIG" } },
      { match: "IR sensör SAĞ", part: "irs2", type: "wokwi-potentiometer", pins: { "VCC": "VCC", "GND": "GND", "OUT": "SIG" } }
    ],
    steps: [
      { title: "Şasiyi kur", detail: "İki motoru şasiye vidala, serbest tekeri arkaya tak. Arduino ve L298N'yi çift taraflı bantla sabitle.", tip: "Motor kablolarını önce lehimle, sonra monte et — dar alanda iş zorlaşır!" },
      { title: "Sensörleri yerleştir", detail: "İki IR sensörü ön tarafa, aralarında 2-3 cm olacak şekilde, yerden 5-8 mm yukarıya monte et.", tip: "Çok yakınsa hep siyah okur, çok uzaksa hiç okumaz — 7 mm ideal." },
      { title: "Devreyi bağla", detail: "Yukarıdaki bağlantı tablosuna göre kabloları tak. Pil bağlantısını en sona bırak.", tip: "Her kabloyu bağladıktan sonra listeye çentik at!" },
      { title: "Kodu yükle", detail: "Aşağıdaki kodu Arduino IDE'ye yapıştır ve yükle. Tekerlekler havada kalacak şekilde tut.", tip: "Yükleme sırasında motorlara güç vermeyin." },
      { title: "Sensörleri kalibre et", detail: "Seri monitörü aç (9600 baud). Sensörleri siyah ve beyaz yüzeye tut, eşik değerini not al.", tip: "Ortam ışığı değeri etkiler — aynı gün test et." },
      { title: "Pistte test et", detail: "Bantla siyah bir oval çiz. Arabayı çizginin üzerine koy ve pili tak!", tip: "Virajda takla atıyorsa hız değerini düşür." }
    ],
    tips: [
      "Pili devreye bağlamadan önce kısa devre olmadığından emin olmak için multimetre kullan.",
      "Motorları doğrudan Arduino pinlerine ASLA bağlama — sürücü şart!",
      "IR sensörler güneş ışığından etkilenir; testi kapalı alanda yap.",
      "Tekerleklerde kayma varsa lastiklere silikon bant sarabilirsin."
    ],
    code: [
      "// 🚗 Çizgi İzleyen Araç — Demo Rehber Kodu",
      "// 2 IR sensör + L298N motor sürücü",
      "",
      "const int PIN_IR_SOL = 2;   // Sol IR sensör",
      "const int PIN_IR_SAG = 3;   // Sağ IR sensör",
      "const int PIN_ENA   = 5;    // Sol motor hız (PWM)",
      "const int PIN_IN1   = 6;",
      "const int PIN_IN2   = 7;",
      "const int PIN_IN3   = 8;",
      "const int PIN_IN4   = 9;",
      "const int PIN_ENB   = 10;   // Sağ motor hız (PWM)",
      "",
      "const int HIZ = 150;        // 0-255 arası",
      "",
      "void setup() {",
      "  pinMode(PIN_IR_SOL, INPUT);",
      "  pinMode(PIN_IR_SAG, INPUT);",
      "  pinMode(PIN_ENA, OUTPUT);  pinMode(PIN_IN1, OUTPUT);  pinMode(PIN_IN2, OUTPUT);",
      "  pinMode(PIN_IN3, OUTPUT);  pinMode(PIN_IN4, OUTPUT);  pinMode(PIN_ENB, OUTPUT);",
      "  Serial.begin(9600);",
      "}",
      "",
      "void sur(int solHiz, int sagHiz) {  // Her motora ayrı hız ver",
      "  digitalWrite(PIN_IN1, solHiz >= 0); digitalWrite(PIN_IN2, solHiz < 0);",
      "  digitalWrite(PIN_IN3, sagHiz >= 0); digitalWrite(PIN_IN4, sagHiz < 0);",
      "  analogWrite(PIN_ENA, abs(solHiz)); analogWrite(PIN_ENB, abs(sagHiz));",
      "}",
      "",
      "void dur() { analogWrite(PIN_ENA, 0); analogWrite(PIN_ENB, 0); }",
      "",
      "void loop() {",
      "  bool solSiyah = digitalRead(PIN_IR_SOL);   // true = siyah çizgi üstünde",
      "  bool sagSiyah = digitalRead(PIN_IR_SAG);",
      "",
      "  if (!solSiyah && !sagSiyah) sur(HIZ, HIZ);       // İkisi de beyaz → düz git",
      "  else if (solSiyah && !sagSiyah) sur(-HIZ, HIZ);  // Sol çizgide → sola dön",
      "  else if (!solSiyah && sagSiyah) sur(HIZ, -HIZ);  // Sağ çizgide → sağa dön",
      "  else dur();                                       // İkisi de siyah → dur",
      "",
      "  delay(20);",
      "}"
    ].join("\n")
  };
}

function demoPlantWaterer(title) {
  return {
    ...demoMeta(title, "Başlangıç",
      "Toprak nem sensörüyle bitkinin susuz kalıp kalmadığını anlayan, susuzsa küçük su pompasını çalıştıran akıllı saksı. " +
      "LCD ekranda nem yüzdesi görünecek, LED durum bildirecek!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Kontrol merkezi" },
      { name: "Toprak nem sensörü", quantity: "1", purpose: "Nem yüzdesini ölçer" },
      { name: "Mini 5V su pompası", quantity: "1", purpose: "Su deposundan bitkiye taşır" },
      { name: "Röle modülü (veya MOSFET)", quantity: "1", purpose: "Pompayı güvenle açıp kapatır" },
      { name: "16x2 I2C LCD", quantity: "1", purpose: "Nem değerini gösterir" },
      { name: "LED + 220Ω direnç", quantity: "1+1", purpose: "Durum bildirimi" },
      { name: "Silikon hortum", quantity: "50 cm", purpose: "Su yolu" },
      { name: "5V adaptör veya güç bankası", quantity: "1", purpose: "Güç" }
    ],
    wiring: [
      { from: "Nem sensörü VCC / GND", to: "Arduino 5V / GND", note: "AO pinini kullanacağız (analog)" },
      { from: "Nem sensörü AO", to: "Arduino A0", note: "0-1023 arası değer döner" },
      { from: "LCD SDA / SCL / VCC / GND", to: "Arduino A4 / A5 / 5V / GND", note: "I2C haberleşme" },
      { from: "Röle IN / VCC / GND", to: "Arduino D7 / 5V / GND", note: "HIGH = pompa açık" },
      { from: "Pompa (+)", to: "Röle NO", note: "Pompa röle üzerinden beslenir" },
      { from: "Röle COM", to: "Arduino 5V", note: "Pompanın güç kaynağı" },
      { from: "Pompa (−)", to: "Arduino GND", note: "Ortak toprak" },
      { from: "LED anot (A)", to: "Arduino D13 (220Ω ile)", note: "Su azalınca yanar" },
      { from: "LED katot (C)", to: "Arduino GND", note: "Ortak toprak" }
    ],
    wokwiHints: [
      { match: "Nem", part: "nem1", type: "wokwi-potentiometer", pins: { "VCC": "VCC", "GND": "GND", "AO": "SIG" } },
      { match: "LCD", part: "lcd1", type: "wokwi-lcd1602", attrs: { pins: "i2c" }, pins: { "SDA": "SDA", "SCL": "SCL", "VCC": "VCC", "GND": "GND" } },
      { match: "Röle", part: "role1", type: "wokwi-relay-module", pins: { "IN": "IN", "VCC": "VCC", "GND": "GND", "NO": "NO", "COM": "COM" } },
      { match: "LED", part: "led1", type: "wokwi-led", attrs: { color: "green" }, pins: { "A": "A", "C": "C" } }
    ],
    steps: [
      { title: "Sensörü tanı", detail: "Nem sensörünü kuru toprağa batır, seri monitörden değeri oku. Sonra ıslak toprakta tekrar oku. Bu iki değer senin kalibrasyon aralığın.", tip: "Sensörün metal kısmı tamamen gömülmeli ama elektronik kısmı kuru kalmalı." },
      { title: "Devreyi kur", detail: "Breadboard üzerine LCD, röle ve LED'i bağla. Bağlantı tablosunu adım adım takip et.", tip: "I2C LCD'nin adresi genelde 0x27'dir; çalışmazsa 0x3F dene." },
      { title: "Pompayı bağla", detail: "Pompa kablosunu rölenin NO ve COM uçlarına tak. Hortumu su deposundan saksıya uzat.", tip: "Pompa kuru çalıştırılırsa bozulur — depoda mutlaka su olsun!" },
      { title: "Kodu yükle ve eşik belirle", detail: "Kodu yükle. KURU_ESIK değerini 1. adımda bulduğun kalibrasyon değerlerine göre ayarla.", tip: "Kuru toprak değeri ~800+, ıslak toprak ~300 civarı olur (modele göre değişir)." },
      { title: "Tam sistem testi", detail: "Saksıyı kurut, sistemi çalıştır. Pompa otomatik devreye girene kadar bekle.", tip: "Günde 1 kez kontrol et, ilk hafta pompaya gözün üstünde olsun." }
    ],
    tips: [
      "Nem sensörü zamanla paslanır — paslanmaz kaplamalı model al ya da sensörü sulama sonrası sil.",
      "Pompa hortumunu saksı drenaj deliğinden uzağa tut, su birikintisi yapmasın.",
      "Elektronik kutusunu saksıdan en az 20 cm uzağa yerleştir.",
      "Tatil için ideal: 2 litre depo ile 2 hafta yeter!"
    ],
    code: [
      "// 🌱 Akıllı Saksı — Demo Rehber Kodu",
      "#include <Wire.h>",
      "#include <LiquidCrystal_I2C.h>",
      "",
      "LiquidCrystal_I2C lcd(0x27, 16, 2);",
      "",
      "const int PIN_NEM  = A0;",
      "const int PIN_ROLE = 7;",
      "const int PIN_LED  = 13;",
      "const int KURU_ESIK = 700;   // Bu değerin üstünde = toprak kuru",
      "const unsigned long ARALIK = 600000UL; // 10 dk'da bir ölç",
      "",
      "unsigned long sonOlcum = 0;",
      "",
      "void setup() {",
      "  pinMode(PIN_ROLE, OUTPUT); digitalWrite(PIN_ROLE, LOW); // Pompa kapalı başlasın",
      "  pinMode(PIN_LED, OUTPUT);",
      "  lcd.init(); lcd.backlight();",
      "  lcd.print(\"Akilli Saksi v1\");",
      "  Serial.begin(9600);",
      "}",
      "",
      "void loop() {",
      "  if (millis() - sonOlcum < ARALIK) return;",
      "  sonOlcum = millis();",
      "",
      "  int ham = analogRead(PIN_NEM);            // 0-1023",
      "  int nemYuzde = map(ham, 1023, 300, 0, 100); // Islak = yüksek %",
      "  nemYuzde = constrain(nemYuzde, 0, 100);",
      "",
      "  lcd.clear();",
      "  lcd.setCursor(0, 0);",
      "  lcd.print(\"Nem: \");",
      "  lcd.print(nemYuzde);",
      "  lcd.print(\"%\");",
      "",
      "  if (ham > KURU_ESIK) {                    // Toprak kuru!",
      "    digitalWrite(PIN_LED, HIGH);",
      "    lcd.setCursor(0, 1);",
      "    lcd.print(\"Sulaniyorum...\");",
      "    digitalWrite(PIN_ROLE, HIGH);           // Pompayı çalıştır",
      "    delay(5000);                             // 5 sn sula",
      "    digitalWrite(PIN_ROLE, LOW);            // Durdur",
      "    lcd.clear(); lcd.print(\"Sulama tamam!\");",
      "    delay(2000);",
      "    digitalWrite(PIN_LED, LOW);",
      "  } else {",
      "    lcd.setCursor(0, 1);",
      "    lcd.print(\"Toprak saglikli :)\");",
      "  }",
      "}"
    ].join("\n")
  };
}

function demoThermostat(title) {
  return {
    ...demoMeta(title, "Başlangıç",
      "Oda sıcaklığını DHT11 sensörüyle ölçen, sıcaklık senin belirlediğin aralığın dışına çıkınca fanı otomatik çalıştıran akıllı termostat. LCD'de anlık sıcaklık görünecek!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Beyin" },
      { name: "DHT11 sıcaklık-nem sensörü", quantity: "1", purpose: "Sıcaklık ve nemi ölçer" },
      { name: "Röle modülü", quantity: "1", purpose: "Fanı güvenle kontrol eder" },
      { name: "5V USB fan", quantity: "1", purpose: "Soğutma" },
      { name: "16x2 I2C LCD", quantity: "1", purpose: "Sıcaklık ekranı" },
      { name: "Buzzer", quantity: "1", purpose: "Aşırı sıcakta alarm" },
      { name: "Breadboard + jumperlar", quantity: "1+20", purpose: "Kurulum" }
    ],
    wiring: [
      { from: "DHT11 VCC / GND / DATA", to: "Arduino 5V / GND / D2", note: "Modül değilse DATA-5V arasına 10kΩ direnç" },
      { from: "LCD SDA / SCL / VCC / GND", to: "Arduino A4 / A5 / 5V / GND", note: "I2C" },
      { from: "Röle IN / VCC / GND", to: "Arduino D7 / 5V / GND", note: "Fan kontrolü" },
      { from: "Fan (+)", to: "Röle NO", note: "Fan röle üzerinden beslenir" },
      { from: "Röle COM", to: "Arduino 5V", note: "Fanın güç kaynağı" },
      { from: "Fan (−)", to: "Arduino GND", note: "Ortak toprak" },
      { from: "Buzzer (+)", to: "Arduino D8", note: "Alarm" },
      { from: "Buzzer (−)", to: "Arduino GND", note: "Ortak toprak" }
    ],
    wokwiHints: [
      { match: "DHT11", part: "dht1", type: "wokwi-dht22", pins: { "VCC": "VCC", "DATA": "SDA", "GND": "GND" } },
      { match: "LCD", part: "lcd1", type: "wokwi-lcd1602", attrs: { pins: "i2c" }, pins: { "SDA": "SDA", "SCL": "SCL", "VCC": "VCC", "GND": "GND" } },
      { match: "Röle", part: "role1", type: "wokwi-relay-module", pins: { "IN": "IN", "VCC": "VCC", "GND": "GND", "NO": "NO", "COM": "COM" } },
      { match: "Buzzer", part: "bz1", type: "wokwi-buzzer", pins: { "+": "1", "−": "2" } }
    ],
    steps: [
      { title: "DHT11'i test et", detail: "Kütüphaneyi kur (DHT sensor library by Adafruit), örnek sketch'i çalıştır, değerlerin geldiğini gör.", tip: "Kablolar gevşekse sensör NaN döndürür — kabloları bastır." },
      { title: "LCD'yi bağla", detail: "I2C LCD'yi A4/A5'e bağla, adresi tarama sketch'iyle bul.", tip: "I2C Scanner sketch'i adresi 1 saniyede bulur." },
      { title: "Röle ve fanı bağla", detail: "Röleyi D7'ye, fanı röle çıkışına bağla.", tip: "Fanı önce doğrudan 5V'ta test et, çalışıyor mu gör." },
      { title: "Kodu yükle", detail: "Aşağıdaki kodu yükle, LCD'de sıcaklık akışını izle.", tip: "Sensörü elinle ısıt — fanın devreye girdiğini gör!" },
      { title: "Eşiği ayarla", detail: "SICAKLIK_ESIK değerini kendi konforuna göre değiştir (örn. 26°C).", tip: "Kışın 22, yazın 26 iyi bir başlangıç." }
    ],
    tips: [
      "Isıtıcı gibi yüksek akım çeken cihazları ASLA doğrudan Arduino'ya bağlama — mutlaka röle kullan ve röle kontaktının akım sınırını kontrol et.",
      "DHT11 ±2°C hassasiyetindedir; daha hassas istersen DHT22 al.",
      "Sensörü pencere kenarından uzak tut, güneş direkt değmesin.",
      "Uzun süreli kullanımda LCD arka ışığını kapatmak güç tasarrufu sağlar."
    ],
    code: [
      "// 🌡️ Akıllı Termostat — Demo Rehber Kodu",
      "#include <Wire.h>",
      "#include <LiquidCrystal_I2C.h>",
      "#include <DHT.h>",
      "",
      "#define DHT_PIN 2",
      "#define DHT_TIP DHT11",
      "",
      "DHT dht(DHT_PIN, DHT_TIP);",
      "LiquidCrystal_I2C lcd(0x27, 16, 2);",
      "",
      "const int PIN_ROLE   = 7;",
      "const int PIN_BUZZER = 8;",
      "const float SICAKLIK_ESIK = 26.0;  // Bu değerin üstünde fan çalışır",
      "",
      "void setup() {",
      "  dht.begin();",
      "  pinMode(PIN_ROLE, OUTPUT); digitalWrite(PIN_ROLE, LOW);",
      "  pinMode(PIN_BUZZER, OUTPUT);",
      "  lcd.init(); lcd.backlight();",
      "  lcd.print(\"Akilli Termostat\");",
      "}",
      "",
      "void loop() {",
      "  float sicaklik = dht.readTemperature();",
      "  float nem = dht.readHumidity();",
      "",
      "  if (isnan(sicaklik)) {                   // Sensör okunamadı",
      "    lcd.clear(); lcd.print(\"Sensor hatasi!\");",
      "    delay(2000);",
      "    return;",
      "  }",
      "",
      "  lcd.clear();",
      "  lcd.setCursor(0, 0);",
      "  lcd.print(sicaklik, 1); lcd.print((char)223); lcd.print(\"C  \"); lcd.print(nem, 0); lcd.print(\"%\");",
      "",
      "  bool sicak = sicaklik > SICAKLIK_ESIK;",
      "  digitalWrite(PIN_ROLE, sicak ? HIGH : LOW);",
      "  lcd.setCursor(0, 1);",
      "  lcd.print(sicak ? \"FAN: ACIK\" : \"FAN: kapali\");",
      "",
      "  if (sicaklik > SICAKLIK_ESIK + 4) {      // Çok sıcak → alarm",
      "    tone(PIN_BUZZER, 1000, 200);",
      "  }",
      "",
      "  delay(2000);                              // DHT11 her 2 sn'de bir ölçebilir",
      "}"
    ].join("\n")
  };
}

function demoSecurity(title) {
  return {
    ...demoMeta(title, "Başlangıç",
      "PIR hareket sensörüyle odana gireni fark eden, buzzer öten ve LED yakan mini güvenlik sistemi. Seri monitörden kim ne zaman girdi kaydını da tutabilirsin!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Beyin" },
      { name: "HC-SR501 PIR sensör", quantity: "1", purpose: "Hareketi algılar" },
      { name: "Buzzer", quantity: "1", purpose: "Alarm sesi" },
      { name: "Kırmızı LED + 220Ω", quantity: "1+1", purpose: "Alarm ışığı" },
      { name: "Breadboard + jumperlar", quantity: "1+15", purpose: "Kurulum" }
    ],
    wiring: [
      { from: "PIR VCC / GND / OUT", to: "Arduino 5V / GND / D2", note: "OUT hareket varsa HIGH olur" },
      { from: "Buzzer pozitif (+)", to: "Arduino D8", note: "Alarm tonu" },
      { from: "Buzzer negatif (−)", to: "Arduino GND", note: "Toprak" },
      { from: "LED anot (A)", to: "Arduino D13 (220Ω ile)", note: "Alarm göstergesi" },
      { from: "LED katot (C)", to: "Arduino GND", note: "Ortak toprak" }
    ],
    wokwiHints: [
      { match: "PIR", part: "pir1", type: "wokwi-pir-motion-sensor", pins: { "VCC": "VCC", "GND": "GND", "OUT": "OUT" } },
      { match: "Buzzer", part: "bz1", type: "wokwi-buzzer", pins: { "+": "1", "−": "2" } },
      { match: "LED", part: "led1", type: "wokwi-led", attrs: { color: "red" }, pins: { "A": "A", "C": "C" } }
    ],
    steps: [
      { title: "PIR'yi ayarla", detail: "Sensördeki iki potu çevir: biri süre (5 sn civarı), biri hassasiyet. Önce kapalı kutuda test et.", tip: "PIR açıldıktan sonra 30-60 sn isınma süresi vardır, bu sırada yanlış alarm verebilir." },
      { title: "Devreyi kur", detail: "Buzzer ve LED'i bağla. LED'e mutlaka 220Ω direnç koy!", tip: "LED'in uzun bacağı (+) dijital pine gider." },
      { title: "Kodu yükle", detail: "Aşağıdaki kodu yükle, seri monitörü aç (9600 baud).", tip: "Elini sensör önünde salla — alarm tetiklenmeli." },
      { title: "Kapsama alanı ayarla", detail: "PIR'nin baktığı yönü belirle. Beyaz Fresnel mercek 7 metre, 110° açı ile görür.", tip: "Kedi/evcil hayvan varsa sensörü alçak monte etme." },
      { title: "Kutula ve gizle", detail: "Tüm sistemi küçük bir kutuya yerleştir, sensöre dışarı bakacak şekilde bir delik aç.", tip: "Kablo girişlerini bantla sabitle, gece gezinmesin." }
    ],
    tips: [
      "PIR sensör cam arkasından iyi görmez — camın önüne değil, yanına monte et.",
      "Isı kaynakları (radyatör, güneş) yanlış alarma yol açar; konumunu buna göre seç.",
      "Şifreli kapatma için 4x4 keypad ve I2C LCD harika bir sonraki adımdır.",
      "Gerçek bir projeye dönüştürmek istersen GSM modülüyle telefona SMS atabilirsin!"
    ],
    code: [
      "// 🚨 Hareket Algılayan Güvenlik Sistemi — Demo Rehber Kodu",
      "const int PIN_PIR    = 2;",
      "const int PIN_BUZZER = 8;",
      "const int PIN_LED    = 13;",
      "const unsigned long ALARM_SURESI = 8000UL;  // 8 sn alarm",
      "",
      "unsigned long alarmBaslangic = 0;",
      "bool alarmAktif = false;",
      "",
      "void setup() {",
      "  pinMode(PIN_PIR, INPUT);",
      "  pinMode(PIN_BUZZER, OUTPUT);",
      "  pinMode(PIN_LED, OUTPUT);",
      "  Serial.begin(9600);",
      "  Serial.println(\"Guvenlik sistemi hazir...\");",
      "  delay(30000);                             // PIR isınma süresi",
      "  Serial.println(\"Izleme basladi!\");",
      "}",
      "",
      "void loop() {",
      "  bool hareket = digitalRead(PIN_PIR);",
      "",
      "  if (hareket && !alarmAktif) {",
      "    alarmAktif = true;",
      "    alarmBaslangic = millis();",
      "    Serial.print(\"HAREKET! Saniye: \");",
      "    Serial.println(millis() / 1000);",
      "  }",
      "",
      "  if (alarmAktif) {",
      "    digitalWrite(PIN_LED, HIGH);",
      "    tone(PIN_BUZZER, 1200, 300);            // Ötücü ses",
      "    delay(350);",
      "    digitalWrite(PIN_LED, LOW);",
      "    noTone(PIN_BUZZER);",
      "    delay(150);",
      "    if (millis() - alarmBaslangic > ALARM_SURESI) {",
      "      alarmAktif = false;                   // Alarm süresi doldu",
      "      Serial.println(\"Alarm sustu.\");",
      "    }",
      "  }",
      "}"
    ].join("\n")
  };
}

function demoGeneric(title, idea) {
  return {
    ...demoMeta(title, "Orta",
      `"${idea}" fikrini temel alan bir başlangıç platformu: Arduino ile sensör okuma, LED ile geri bildirim ve seri monitör üzerinden izleme. ` +
      "Demo modunda genel bir şablon sunuyoruz — API anahtarını Ayarlar'dan ekleyerek tamamen projene özel bir rehber alabilirsin!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Ana kontrol kartı" },
      { name: "Breadboard", quantity: "1", purpose: "Lehimsiz devre kurulumu" },
      { name: "LED + 220Ω direnç", quantity: "3+3", purpose: "Durum göstergeleri" },
      { name: "Buton", quantity: "2", purpose: "Kullanıcı girişi" },
      { name: "Potansiyometre 10kΩ", quantity: "1", purpose: "Ayarlanabilir giriş" },
      { name: "Jumper kablolar", quantity: "20", purpose: "Bağlantı" },
      { name: "USB kablosu", quantity: "1", purpose: "Program yükleme + güç" }
    ],
    wiring: [
      { from: "LED1 anot (A)", to: "Arduino D8 (220Ω ile)", note: "Durum LED'i" },
      { from: "LED1 katot (C)", to: "Arduino GND", note: "Ortak toprak" },
      { from: "LED2 anot (A)", to: "Arduino D9 (220Ω ile)", note: "Aktivite LED'i" },
      { from: "LED2 katot (C)", to: "Arduino GND", note: "Ortak toprak" },
      { from: "Buton1 bacak 1 / 2", to: "Arduino D2 / GND", note: "INPUT_PULLUP kullan" },
      { from: "Potansiyometre SIG / VCC / GND", to: "Arduino A0 / 5V / GND", note: "Analog değer okuma" }
    ],
    wokwiHints: [
      { match: "LED1", part: "led1", type: "wokwi-led", pins: { "A": "A", "C": "C" } },
      { match: "LED2", part: "led2", type: "wokwi-led", attrs: { color: "green" }, pins: { "A": "A", "C": "C" } },
      { match: "Buton1", part: "btn1", type: "wokwi-pushbutton", pins: { "1": "1.l", "2": "2.l" } },
      { match: "Potansiyometre", part: "pot1", type: "wokwi-potentiometer", pins: { "SIG": "SIG", "VCC": "VCC", "GND": "GND" } }
    ],
    steps: [
      { title: "Fikrini parçalara ayır", detail: `"${idea}" projesini 'girdi → işlem → çıktı' şeklinde düşün. Hangi sensörler girdi, ne karar veriyor, hangi motor/LED çıktı?`, tip: "Kâğıda üç sütun çiz: Girdi / İşlem / Çıktı." },
      { title: "Temel devreyi kur", detail: "Breadboard üzerinde LED ve buton bağlantılarını yap. Bu, her projenin iskeletidir.", tip: "Önce LED'i yak, sonra butonu oku — adım adım ilerle." },
      { title: "Kodu yükle", detail: "Aşağıdaki şablon kodu yükle ve seri monitörden değerleri izle.", tip: "Kod yükleme hatası alırsan doğru portu (Tools > Port) seçtiğini kontrol et." },
      { title: "Kendi bileşenlerini ekle", detail: "Projenin gerçek sensörlerini (mesafe, sıcaklık, nem vb.) ekleyerek şablonu büyüt.", tip: "Her yeni bileşeni ekledikten sonra önce tek başına test et." },
      { title: "Geliştir ve paylaş", detail: "Proje çalışınca arkadaşlarına göster, video çek, geliştirme günlüğü tut!", tip: "Kod versiyonlarını kaydet — 'calisan_v1', 'calisan_v2' gibi." }
    ],
    tips: [
      "Her projede ilk kural: GND'ler ortak olsun, güç polaritesini iki kez kontrol et.",
      "Arduino pinleri toplam ~40 mA verir — motor gibi yüksek akımlı yükler için sürücü kullan.",
      "Seri monitör en iyi arkadaşındır; her adımda değerleri yazdır.",
      "API anahtarı ekleyerek bu şablonun yerine tamamen projene özel rehber alabilirsin!"
    ],
    code: [
      "// 🤖 Genel Başlangıç Şablonu — Demo Rehber Kodu",
      "// Fikir: " + idea.replace(/[\r\n]+/g, " ").slice(0, 80),
      "",
      "const int PIN_LED1  = 8;",
      "const int PIN_LED2  = 9;",
      "const int PIN_BUTON = 2;    // INPUT_PULLUP: basılı = LOW",
      "const int PIN_POT   = A0;",
      "",
      "void setup() {",
      "  pinMode(PIN_LED1, OUTPUT);",
      "  pinMode(PIN_LED2, OUTPUT);",
      "  pinMode(PIN_BUTON, INPUT_PULLUP);",
      "  Serial.begin(9600);",
      "  Serial.println(\"Proje basladi!\");",
      "}",
      "",
      "void loop() {",
      "  int potDeger = analogRead(PIN_POT);   // 0-1023",
      "  bool butonBasili = digitalRead(PIN_BUTON) == LOW;",
      "",
      "  Serial.print(\"Pot: \"); Serial.print(potDeger);",
      "  if (butonBasili) Serial.print(\" | BUTON BASILI\");",
      "  Serial.println();",
      "",
      "  analogWrite(PIN_LED2, potDeger / 4);  // Pot ne kadar çevriliyse o kadar parlak",
      "",
      "  if (butonBasili) {",
      "    digitalWrite(PIN_LED1, HIGH);       // Butona basılı tutunca LED yanar",
      "  } else {",
      "    digitalWrite(PIN_LED1, LOW);",
      "  }",
      "",
      "  delay(100);",
      "}"
    ].join("\n")
  };
}

/* 7 segment göstergede 0-9 sayan mini sayaç — wokwi-7segment (ortak katot) */
function demoSevenSeg(title) {
  return {
    ...demoMeta(title, "Başlangıç",
      "7 segment göstergede 0'dan 9'a kadar sayan mini sayaç. Her rakamın hangi segmentleri yakacağını kodda öğren — dijital saatlerin ve sayaçların temeli!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Beyin" },
      { name: "7 segment display (ortak katot)", quantity: "1", purpose: "Rakamları gösterir" },
      { name: "220Ω direnç", quantity: "8", purpose: "Segment akımını sınırlar" },
      { name: "Breadboard + jumperlar", quantity: "1+20", purpose: "Kurulum" }
    ],
    wiring: [
      { from: "Display A / B / C / D", to: "Arduino D2 / D3 / D4 / D5", note: "a-d segmentleri (her birine 220Ω)" },
      { from: "Display E / F / G", to: "Arduino D6 / D7 / D8", note: "e-g segmentleri" },
      { from: "Display COM", to: "Arduino GND", note: "Ortak katot — toprağa" }
    ],
    wokwiHints: [
      { match: "Display", part: "seg1", type: "wokwi-7segment", attrs: { common: "cathode" }, pins: { "A": "A", "B": "B", "C": "C", "D": "D", "E": "E", "F": "F", "G": "G", "DP": "DP", "COM": "COM" } }
    ],
    steps: [
      { title: "Segmentleri tanı", detail: "Display'i cama bakacak şekilde tut: soldan sağa üst segment a, saat yönünde b c d, alt e f g ve ortadaki g. DP ise sağ alttaki noktadır.", tip: "Emin olamıyorsan 3V + dirençle tek tek segmentleri yakarak test et." },
      { title: "Devreyi kur", detail: "Her segment bacağına bir 220Ω direnç bağla, dirençlerin diğer ucunu D2-D8 pinlerine götür. COM bacağını GND'ye bağla.", tip: "Ortak katot display'de COM mutlaka GND'ye gider — ortak anotsa 5V'e gider, kod ters döner!" },
      { title: "Kodu yükle", detail: "Aşağıdaki kodu yükle ve seri monitörü aç (9600 baud). Sayaç 0'dan 9'a saymaya başlayacak.", tip: "Rakamlar bozuk görünüyorsa RAKAM tablosundaki 0/1'leri kendi diziliminle karşılaştır." },
      { title: "Sayaç testi", detail: "Her rakamın geçişini izle: 1 sadece b-c, 8 tüm segmentleri yakar. Desen tablosunu elle doğrula.", tip: "Bir segment hiç yanmıyorsa o harfin direncini ve kablosunu kontrol et." },
      { title: "Ötesi: butonla kontrol", detail: "Bir buton ekleyip sayacı durdur/başlat yap, ya da ikinci display ekleyerek 0-99 say.", tip: "İkinci display için pinler yetmezse 74HC595 shift register kullan!" }
    ],
    tips: [
      "8 segment × 20mA = 160mA — tüm segmentleri sürekli yakarsan Uno pinleri ısınır; dirençsiz bağlama!",
      "Ortak katot/ortak anot karışımı en sık hatadır: display'i alırken yanındaki yazıya bak.",
      "Kodda HIGH segment yakar (katot için); anot display kullanırsan desenleri ters çevir.",
      "Dijital saat yapmak istersen 4 haneli display + colon noktası harika bir sonraki adım."
    ],
    code: [
      "// 🔢 7 Segment Sayaç — Demo Rehber Kodu",
      "// Ortak katot display — segment HIGH olunca yanar",
      "const int SEG[7] = {2, 3, 4, 5, 6, 7, 8};   // a b c d e f g",
      "",
      "// 0-9 rakamlarının segment desenleri (a b c d e f g)",
      "const bool RAKAM[10][7] = {",
      "  {1,1,1,1,1,1,0},  // 0",
      "  {0,1,1,0,0,0,0},  // 1",
      "  {1,1,0,1,1,0,1},  // 2",
      "  {1,1,1,1,0,0,1},  // 3",
      "  {0,1,1,0,0,1,1},  // 4",
      "  {1,0,1,1,0,1,1},  // 5",
      "  {1,0,1,1,1,1,1},  // 6",
      "  {1,1,1,0,0,0,0},  // 7",
      "  {1,1,1,1,1,1,1},  // 8",
      "  {1,1,1,1,0,1,1}   // 9",
      "};",
      "",
      "int sayi = 0;",
      "",
      "void setup() {",
      "  for (int i = 0; i < 7; i++) pinMode(SEG[i], OUTPUT);",
      "  Serial.begin(9600);",
      "}",
      "",
      "void rakamYaz(int n) {",
      "  for (int i = 0; i < 7; i++) digitalWrite(SEG[i], RAKAM[n][i] ? HIGH : LOW);",
      "}",
      "",
      "void loop() {",
      "  rakamYaz(sayi);",
      "  Serial.println(sayi);",
      "  sayi = (sayi + 1) % 10;",
      "  delay(1000);",
      "}"
    ].join("\n"),
    advanced: [
      { title: "İkinci display ile 0-99 say", detail: "Aynı a-g segment hatlarını iki display'e paralel bağla; her display'in COM'unu ayrı bir pinle (örn. D9-D10) sür. Saniyede 100 kez hangi haneyi göstereceğini değiştir — göz artık ikisini de yakar!", tip: "Bu tekniğe 'multiplexing' denir; Wokwi'de wokwi-7segment partını digits: \"2\" ekleyerek deneyebilirsin.", wiring: [
        { from: "Display2 COM", to: "Arduino D9", note: "Hane seçimi (multiplexing)" }
      ], code: "const int HANE[2] = {9, 10};\n// loop içinde: her 5 ms'de hane değiştir,\n// rakamYaz(sayi / onlar), COM pini LOW ile o hane açılır." },
      { title: "Butonla durdur/başlat", detail: "Bir butonu D11 + GND'ye bağla (INPUT_PULLUP). Basınca sayi değişkenini dondur; tekrar basınca kaldığı yerden sürsün.", tip: "bool calisiyor = !calisiyor; kalıbı tek satırda anahtar yapar.", wiring: [
        { from: "DurTusu bir / iki", to: "Arduino D11 / GND", note: "Durdur-başlat (INPUT_PULLUP)" }
      ], code: "const int PIN_DUR = 11;\n// setup: pinMode(PIN_DUR, INPUT_PULLUP);\n// loop: if (digitalRead(PIN_DUR) == LOW) calisiyor = !calisiyor;" }
    ]
  };
}

/* HC-SR04 mesafe ölçümü ile yaklaştıkça hızlanan bipli park sensörü */
function demoParkSensor(title) {
  return {
    ...demoMeta(title, "Başlangıç",
      "HC-SR04 ultrasonik sensörle mesafeyi ölçüp buna göre önce uyarıp sonra çalan park sensörü. Mesafe azaldıkça bip sesi hızlanır — gerçek park dedektörü mantığı!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Beyin" },
      { name: "HC-SR04 ultrasonik sensör", quantity: "1", purpose: "Mesafeyi ses dalgasıyla ölçer" },
      { name: "Buzzer", quantity: "1", purpose: "Yaklaşınca öter" },
      { name: "Kırmızı LED + 220Ω", quantity: "1+1", purpose: "Çok yakın ışığı" },
      { name: "Breadboard + jumperlar", quantity: "1+15", purpose: "Kurulum" }
    ],
    wiring: [
      { from: "Sensör VCC / GND", to: "Arduino 5V / GND", note: "Besleme" },
      { from: "HC-SR04 Trig / Echo", to: "Arduino D2 / D3", note: "Tetik + yankı pini" },
      { from: "Buzzer pozitif (+)", to: "Arduino D8", note: "Yaklaşma sesi" },
      { from: "Buzzer negatif (−)", to: "Arduino GND", note: "Toprak" },
      { from: "LED anot (A)", to: "Arduino D13 (220Ω ile)", note: "Çok yakın uyarısı" },
      { from: "LED katot (C)", to: "Arduino GND", note: "Ortak toprak" }
    ],
    wokwiHints: [
      { match: "Sensör", part: "ultrasonic1", type: "wokwi-hc-sr04", pins: { "VCC": "VCC", "GND": "GND", "TRIG": "TRIG", "ECHO": "ECHO" } },
      { match: "Buzzer", part: "bz1", type: "wokwi-buzzer", pins: { "+": "1", "−": "2" } },
      { match: "LED", part: "led1", type: "wokwi-led", attrs: { color: "red" }, pins: { "A": "A", "C": "C" } }
    ],
    steps: [
      { title: "Sensör mantığını anla", detail: "Trig pini 10 mikrosaniye HIGH yapılırsa sensör 40 kHz ses atar; Echo pini ses dönene kadar HIGH kalır. Süre ÷ 58 = santimetre!", tip: "pulseIn'e 30 ms zaman aşımı ver — sensör bağlantısı kopsa bile kod takılıp kalmaz." },
      { title: "Devreyi kur", detail: "Sensörün 4 pinini tabloya göre bağla, buzzer ve LED'i ekle. LED'e 220Ω direnç koymayı unutma.", tip: "Echo pini 5V çıkarır; Arduino Uno için sorun yok ama 3.3V kartlarda bölücü direnç gerekir." },
      { title: "Kodu yükle", detail: "Kodu yükle, seri monitörü aç (9600 baud). Elini sensörün önüne getir: mesafe santimetre olarak aksın.", tip: "Değer -1 veya 0 çıkıyora zaman aşımı aşılmış demektir; hedefi sensöre 4 cm'den yakın tutma." },
      { title: "Eşikleri ayarla", detail: "YAKIN_CM (20 cm) ve COK_YAKIN_CM (10 cm) değerlerini kendi kutuna göre değiştir. Buzzer hızının mesafeyle nasıl değiştiğini dinle.", tip: "map(cm, 10, 20, 80, 500) satırı bip aralığını ölçekler — eşikleri değiştirirsen map sınırlarını da güncelle." },
      { title: "Montaj", detail: "Sensörü kutunun ön yüzüne, gözler dışarı bakacak şekilde yapıştır. Buzzer'ı arkaya; güç için 9V pil kullan.", tip: "Sensör gözlerinin önünde kablo kalmazsa okumalar sapmaz." }
    ],
    tips: [
      "HC-SR04 yumuşak yüzeyleri (perde, kumaş) iyi ölçemez — ses yansımaz.",
      "İki sensör yan yana çalışırsa birbirini dinler; tetikleri sırayla gönder.",
      "Sıcaklık ses hızını değiştirir: hassas iş için cm = sure × (331 + 0.6×°C) / 20000.",
      "LCD ekleyip mesafeyi ekranda göstermek harika bir sonraki adım!"
    ],
    code: [
      "// 🚗 Ultrasonik Park Sensörü — Demo Rehber Kodu",
      "const int PIN_TRIG   = 2;",
      "const int PIN_ECHO   = 3;",
      "const int PIN_BUZZER = 8;",
      "const int PIN_LED    = 13;",
      "const long YAKIN_CM     = 20;  // altında uyarı başlar",
      "const long COK_YAKIN_CM = 10;  // altında ışık + sürekli bip",
      "",
      "long mesafeOlc() {",
      "  digitalWrite(PIN_TRIG, LOW);",
      "  delayMicroseconds(2);",
      "  digitalWrite(PIN_TRIG, HIGH);",
      "  delayMicroseconds(10);",
      "  digitalWrite(PIN_TRIG, LOW);",
      "  long sure = pulseIn(PIN_ECHO, HIGH, 30000);  // en fazla 30 ms bekle",
      "  return sure / 58;                            // mikro-saniye → santimetre",
      "}",
      "",
      "void setup() {",
      "  pinMode(PIN_TRIG, OUTPUT);",
      "  pinMode(PIN_ECHO, INPUT);",
      "  pinMode(PIN_BUZZER, OUTPUT);",
      "  pinMode(PIN_LED, OUTPUT);",
      "  Serial.begin(9600);",
      "}",
      "",
      "void loop() {",
      "  long cm = mesafeOlc();",
      "  Serial.print(\"Mesafe: \"); Serial.print(cm); Serial.println(\" cm\");",
      "",
      "  if (cm > 0 && cm < COK_YAKIN_CM) {",
      "    digitalWrite(PIN_LED, HIGH);       // Çok yakın: ışık + sürekli bip",
      "    tone(PIN_BUZZER, 1400);",
      "  } else if (cm > 0 && cm < YAKIN_CM) {",
      "    digitalWrite(PIN_LED, LOW);",
      "    // Mesafe azaldıkça bip aralığı kısalır",
      "    int aralik = map(cm, 10, 20, 80, 500);",
      "    tone(PIN_BUZZER, 1000, 60);",
      "    delay(aralik);",
      "    noTone(PIN_BUZZER);",
      "  } else {",
      "    digitalWrite(PIN_LED, LOW);",
      "    noTone(PIN_BUZZER);",
      "  }",
      "  delay(60);",
      "}"
    ].join("\n")
  };
}

/* 4 butonla 4 nota çalan, INPUT_PULLUP ile dirençsiz mini piyano */
function demoPiano(title) {
  return {
    ...demoMeta(title, "Başlangıç",
      "4 butonla 4 nota çalan mini piyano. Buzzer'a tone() komutuyla frekans göndermeyi, birden çok butonu okumayı öğren — bitirince kendi melodini besteleyebilirsin!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Beyin" },
      { name: "Buzzer", quantity: "1", purpose: "Nota seslerini çalar" },
      { name: "Buton", quantity: "4", purpose: "Do Re Mi Fa tuşları" },
      { name: "Breadboard + jumperlar", quantity: "1+20", purpose: "Kurulum" }
    ],
    wiring: [
      { from: "DoTusu bir / iki", to: "Arduino D2 / GND", note: "Do — bacak 'bir' D2'ye, 'iki' GND'ye (INPUT_PULLUP)" },
      { from: "ReTusu uc / dort", to: "Arduino D3 / GND", note: "Re" },
      { from: "MiTusu bes / alti", to: "Arduino D4 / GND", note: "Mi" },
      { from: "FaTusu yedi / sekiz", to: "Arduino D5 / GND", note: "Fa" },
      { from: "Buzzer pozitif (+)", to: "Arduino D8", note: "Nota sesi — artı bacak" },
      { from: "Buzzer negatif (−)", to: "Arduino GND", note: "Eksi bacak — toprak" }
    ],
    wokwiHints: [
      { match: "DoTusu", part: "btn1", type: "wokwi-pushbutton", attrs: { color: "red" }, pins: { "bir": "1.l", "iki": "2.l" } },
      { match: "ReTusu", part: "btn2", type: "wokwi-pushbutton", attrs: { color: "orange" }, pins: { "uc": "1.l", "dort": "2.l" } },
      { match: "MiTusu", part: "btn3", type: "wokwi-pushbutton", attrs: { color: "green" }, pins: { "bes": "1.l", "alti": "2.l" } },
      { match: "FaTusu", part: "btn4", type: "wokwi-pushbutton", attrs: { color: "blue" }, pins: { "yedi": "1.l", "sekiz": "2.l" } },
      { match: "Buzzer", part: "bz1", type: "wokwi-buzzer", pins: { "+": "1", "−": "2" } }
    ],
    steps: [
      { title: "Frekansları öğren", detail: "Ses perdeye göre titreşir: Do=262, Re=294, Mi=330, Fa=349 Hz. tone() komutu pine tam bu frekansta kare dalga gönderir.", tip: "Bir oktav yukarı çıkmak istersen frekansı 2 ile çarp: Do5 = 523 Hz." },
      { title: "Devreyi kur", detail: "Dört butonu breadboard'a yay, her birinin bir bacağını D2-D5'e, diğer bacağını GND rayına bağla. Buzzer'ı D8 + GND'ye tak.", tip: "INPUT_PULLUP sayesinde harici direnç gerekmez — pin içinden 5V çeker, buton basılınca GND'ye düşer." },
      { title: "Kodu yükle", detail: "Kodu yükle ve seri monitörü aç. Butonlara bas: dört nota duyulmalı.", tip: "Bir nota gelmiyorsa o butonun bacaklarını çapraz mı taktığını kontrol et — buton 4 bacaklıdır!" },
      { title: "Melodi çal", detail: "Yeni bir fonksiyon yaz: doğa otomatik çalan küçük bir melodi (Do-Mi-Sol-Do). delay'lerle nota sürelerini ayarla.", tip: "tone(8, frekans, süre) üçüncü parametreyle nota otomatik biter." },
      { title: "Kendi besteni yap", detail: "NOTA dizisine kendi notalarını ekle, buton sayısını artır, hatta iki butona aynı anda basınca akor çal!", tip: "Birden çok notayı aynı anda tone ile çalamazsın — akor için farklı pinlere 2. buzzer gerekir." }
    ],
    tips: [
      "tone() yalnızca tek pinde çalışabilir; aynı anda iki nota için ikinci bir buzzer pin lazım.",
      "Buzzer pasif (tone ile çalan) tip olmalı — aktif buzzer sadece tek ses çıkarır.",
      "Buton titreşimi (debounce) notayı titretiyorsa küçük bir delay(20) ekle.",
      "Potansiyometre ekleyip oktav değiştirmek süper bir geliştirme!"
    ],
    code: [
      "// 🎹 Mini Piyano — Demo Rehber Kodu",
      "// 4 buton + 1 buzzer, INPUT_PULLUP ile dirençsiz kurulum",
      "const int BUTONPIN[4] = {2, 3, 4, 5};",
      "const int NOTA[4] = {262, 294, 330, 349};  // Do Re Mi Fa",
      "",
      "void setup() {",
      "  for (int i = 0; i < 4; i++) pinMode(BUTONPIN[i], INPUT_PULLUP);",
      "  Serial.begin(9600);",
      "}",
      "",
      "void loop() {",
      "  bool caliniyor = false;",
      "  for (int i = 0; i < 4; i++) {",
      "    if (digitalRead(BUTONPIN[i]) == LOW) {  // Basılı = GND'ye çeker",
      "      tone(8, NOTA[i]);",
      "      caliniyor = true;",
      "      Serial.print(\"Nota: \"); Serial.println(i + 1);",
      "    }",
      "  }",
      "  if (!caliniyor) noTone(8);",
      "}",
      "",
      "// Bonus: otomatik melodi — çağırmak için loop'ta melodiCal();",
      "void melodiCal() {",
      "  int melodi[] = {262, 330, 392, 523};     // Do Mi Sol Do",
      "  for (int i = 0; i < 4; i++) {",
      "    tone(8, melodi[i], 250);",
      "    delay(300);",
      "  }",
      "  noTone(8);",
      "}"
    ].join("\n"),
    advanced: [
      { title: "Kayıt ve çalma modu", detail: "Bir buton 'kayıt' (basılan notaları bir diziye + millis() zaman damgalarıyla sakla), ikinci buton 'çal' olsun. Artık piyanon kendi melodini kaydedip geri çalıyor!", tip: "Dizi dolunca (örn. 64 nota) kaydı otomatik durdur — taşmayı önler.", wiring: [
        { from: "KayitTusu bir / iki", to: "Arduino D6 / GND", note: "Kayıt butonu (INPUT_PULLUP)" },
        { from: "CalTusu bir / iki", to: "Arduino D7 / GND", note: "Çalma butonu (INPUT_PULLUP)" }
      ], code: "const int PIN_KAYIT = 6, PIN_CAL = 7;\nint kayit[64]; unsigned long zaman[64]; int kayitSayisi = 0;\n// Kayıt: basılan notayı kayit[kayitSayisi] = i; zaman[kayitSayisi++] = millis();\n// Çalma: her nota arası delay(zaman[i+1] - zaman[i]);" },
      { title: "Potansiyometre ile oktav", detail: "Pot'u A0'a bağla; okunan değere göre notaların frekansını 1, 2 veya 4 ile çarparak oktav değiştir. Tek potla piyanon üç oktav olur!", tip: "pot > 700 ise ×4, > 300 ise ×2, değilse ×1 — eşikler en akıcı hissi verir.", wiring: [
        { from: "Pot SIG / VCC / GND", to: "Arduino A0 / 5V / GND", note: "Oktav seçimi" }
      ], code: "int pot = analogRead(A0);\nint kat = pot > 700 ? 4 : (pot > 300 ? 2 : 1);\ntone(8, NOTA[i] * kat);" }
    ]
  };
}

/* I2C LCD'de çalışan, millis() tabanlı dijital saat */
function demoLcdClock(title) {
  return {
    ...demoMeta(title, "Başlangıç",
      "I2C LCD ekranda çalışan dijital saat. Sadece 4 kablo ile LCD sürmeyi, millis() ile sayaç tutmayı ve ekrana biçimli yazı yazmayı öğren — bitirince alarmla genişletebilirsin!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Beyin" },
      { name: "LCD1602 ekran (I2C)", quantity: "1", purpose: "Saati 2 satırda gösterir" },
      { name: "Breadboard + jumperlar", quantity: "1+10", purpose: "Kurulum" }
    ],
    wiring: [
      { from: "LCD VCC / GND", to: "Arduino 5V / GND", note: "Besleme" },
      { from: "LCD SDA / SCL", to: "Arduino A4 / A5", note: "I2C veri + saat hattı — yalnızca 2 kablo!" }
    ],
    wokwiHints: [
      { match: "LCD", part: "lcd1", type: "wokwi-lcd1602", attrs: { pins: "i2c" }, pins: { "VCC": "VCC", "GND": "GND", "SDA": "SDA", "SCL": "SCL" } }
    ],
    steps: [
      { title: "I2C sihirini anla", detail: "Klasik LCD 6 kablo ister; I2C modüllü LCD yalnızca 4 kablo (besleme + SDA/SCL) ile çalışır. Arduino'nun A4=SDA, A5=SCL pinleri sabittir.", tip: "Ekranda hiçbir şey görünmüyorsa önce potansiyometreyi (arkadaki mavi kutu) çevirerek kontrastı ayarla." },
      { title: "Devreyi kur", detail: "LCD'nin 4 pinini tabloya göre bağla. I2C adresi genelde 0x27'dir; Wokwi'de de 0x27 kullanılır.", tip: "Birden fazla I2C cihaz aynı hatta bağlanabilir — adresleri farklı olmak zorunda." },
      { title: "Kodu yükle", detail: "LiquidCrystal_I2C kütüphanesini ekle (Wokwi'de Library Manager'dan otomatik gelir) ve kodu yükle. Saat 00:00:00'dan saymaya başlar.", tip: "millis() 50 günden sonra taşar; gerçek saat projelerinde RTC modülü (DS3231) kullanılır." },
      { title: "Biçimlendirme hilesini gör", detail: "yaz2() fonksiyonu 9'u 09 olarak yazar: if (n < 10) lcd.print('0'). Dijital ekranların sırrı budur!", tip: "sprintf de olur ama char tamponu gerekir — yaz2() daha öğretici." },
      { title: "Gerçek zaman", detail: "Geri sayım ya da kronometre modu ekle: butonla başlat/durdur, LCD'de saniyeleri göster.", tip: "millis() farklarını unsigned long ile hesapla — negatif süre tuzağına düşme." }
    ],
    tips: [
      "LCD.address() ile I2C tarayıcı kodu çalıştırıp gerçek adresi bulabilirsin (0x27 veya 0x3F).",
      "lcd.clear() her karede ekranı titretir — sadece değişen karakterleri yeniden yaz.",
      "I2C hattı uzun kablolarda kararsızlaşır; 30 cm'yi geçme.",
      "DS3231 RTC modülü ekleyerek pili çıkarıp taksan bile saati doğru tutan gerçek bir saat yapabilirsin."
    ],
    code: [
      "// 🕐 LCD Dijital Saat — Demo Rehber Kodu",
      "#include <Wire.h>",
      "#include <LiquidCrystal_I2C.h>",
      "LiquidCrystal_I2C lcd(0x27, 16, 2);   // I2C adresi, 16 sütun, 2 satır",
      "",
      "void yaz2(int n) {                    // 9 → 09 biçiminde yazar",
      "  if (n < 10) lcd.print('0');",
      "  lcd.print(n);",
      "}",
      "",
      "void setup() {",
      "  lcd.init();",
      "  lcd.backlight();",
      "  lcd.setCursor(0, 1);",
      "  lcd.print(\"Ruya Atolyesi\");       // ikinci satırda imza",
      "}",
      "",
      "void loop() {",
      "  unsigned long sn = millis() / 1000; // açılıştan beri saniye",
      "  int hh = (sn / 3600) % 24;",
      "  int mm = (sn / 60) % 60;",
      "  int ss = sn % 60;",
      "  lcd.setCursor(4, 0);",
      "  yaz2(hh); lcd.print(':'); yaz2(mm); lcd.print(':'); yaz2(ss);",
      "  delay(250);                         // ekran titremesin",
      "}"
    ].join("\n"),
    advanced: [
      { title: "Butonla ayar modu", detail: "İki buton ekle: biri saati, biri dakikayı artırsın. Saat değerlerini değişkende tut; millis() sayaçla birleştir.", tip: "Ayar modundayken iki nokta üst üste yanıp sönsün — gerçek saatlerin ayar ekranı gibi!", wiring: [
        { from: "SaatTusu bir / iki", to: "Arduino D2 / GND", note: "Saat artırma (INPUT_PULLUP)" },
        { from: "DakTusu bir / iki", to: "Arduino D3 / GND", note: "Dakika artırma (INPUT_PULLUP)" }
      ], code: "int ayarHH = 0, ayarMM = 0;\n// butonlara basılınca: ayarHH = (ayarHH + 1) % 24;\n// toplam saniye = ayarHH*3600 + ayarMM*60 + sn" },
      { title: "Buzzer alarmı", detail: "Belirli saate gelince buzzer 10 saniye ötsün. Alarm saatini bir değişkende tut, butonla değiştir.", tip: "Alarm çalarken herhangi bir buton sustursun — kullanıcı dostu davranış.", wiring: [
        { from: "Buzzer pozitif (+)", to: "Arduino D8", note: "Alarm sesi" },
        { from: "Buzzer negatif (−)", to: "Arduino GND", note: "Toprak" }
      ], code: "const int PIN_BZ = 8;\nif (hh == ALARM_HH && mm == ALARM_MM && ss < 10) tone(PIN_BZ, 1000);\nelse noTone(PIN_BZ);" }
    ]
  };
}

/* 🌙 Işık sensörlü otomatik gece lambası: karanlıkta kendiliğinden yanar */
function demoNightLight(title) {
  return {
    ...demoMeta(title, "Başlangıç",
      "Oda karardığında kendiliğinden yanan akıllı gece lambası. LDR ile ışığı ölçmeyi, analogRead ile eşik (threshold) karşılaştırmayı ve histeresis ile titremeyi önlemeyi öğren!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Beyin" },
      { name: "LDR fotorezistör", quantity: "1", purpose: "Oda ışığını ölçer" },
      { name: "LED + 220Ω direnç", quantity: "1+1", purpose: "Gece ışığı" },
      { name: "10kΩ direnç", quantity: "1", purpose: "LDR için gerilim bölücü" },
      { name: "Breadboard + jumperlar", quantity: "1+10", purpose: "Kurulum" }
    ],
    wiring: [
      { from: "LDR VCC / SIG / GND", to: "Arduino 5V / A0 / GND", note: "SIG ayak A0'a — ışık arttıkça değer değişir" },
      { from: "LED anot (A)", to: "Arduino D9 (220Ω ile)", note: "Gece ışığı — PWM'li pin, karartma yapabilirsin" },
      { from: "LED katot (C)", to: "Arduino GND", note: "Ortak toprak" }
    ],
    wokwiHints: [
      { match: "LDR", part: "ldr1", type: "wokwi-photoresistor-sensor", pins: { "VCC": "VCC", "GND": "GND", "AO": "AO" } },
      { match: "LED", part: "led1", type: "wokwi-led", attrs: { color: "amber" }, pins: { "A": "A", "C": "C" } }
    ],
    steps: [
      { title: "Işığı ölç", detail: "LDR bir dirençtir: ışık arttıkça direnci düşer. Gerilim bölücüyle A0'da 0-1023 arası bir değer okursun — Wokwi'de LDR'nin Lux kaydırıcısıyla oyna!", tip: "Serial Plotter'ı aç: değeri çizgi olarak izlemek eşiği seçmeyi kolaylaştırır." },
      { title: "Eşiği belirle", detail: "Odanın aydınlık ve karanlık değerlerini not et: aydınlıkta 800+, karanlıkta 200- olabilir. Araya bir eşik çiz: ESCIK = 500.", tip: "Eşiği kodu değiştirmeden ayarlamak istersen potla karşılaştırma yap — ama önce sabit eşikle çalışmayı öğren." },
      { title: "Kararı ver", detail: "if (isik < ESCIK) → LED yan. analogRead + if: tüm sensör projelerinin kalbi budur.", tip: "Ters mantığa dikkat: LDR'de düşük değer = karanlık (modüle göre değişir) — kendi ölçümüne güven." },
      { title: "Histeresis ekle", detail: "Eşik tam sınırındaysa LED yanıp söner (titrer). Çözüm: açmak için 500, kapatmak için 600 kullan — iki eşik arası tampon bölge.", tip: "Termostat projenle aynı ilke: ısıtıcı aç/kapa eşikleri farklıydı, hatırla!" },
      { title: "Yumuşak geçiş", detail: "LED'i anında yakmak yerine analogWrite ile 0'dan 255'e 2 saniyede aç — göz yormayan doğal bir şafak efekti.", tip: "for döngüsüyle kademeli analogWrite en basit yol; millis() tabanlısı en şık." }
    ],
    tips: [
      "LDR'yi elinle kapatıp A0 değerini izle: kalibrasyon en hızlı böyle yapılır.",
      "10kΩ direnç LDR'nin GND ayağına seri: bölücü ters bağlanırsa değer mantığı tersine döner.",
      "Wokwi'de wokwi-photoresistor-sensor'ün Lux özniteliğini simülasyon sırasında değiştirebilirsin.",
      "Gerçek projede LED yerine 5V şerit LED sürerken transistör (2N2222) gerekir — pinden doğrudan çekme!"
    ],
    code: [
      "// 🌙 Otomatik Gece Lambası — Demo Rehber Kodu",
      "const int PIN_LDR = A0;",
      "const int PIN_LED = 9;",
      "const int ESCIK_AC = 500;   // karanlık → yanan",
      "const int ESCIK_KAPAT = 600; // aydınlık → sönen (histeresis)",
      "",
      "void setup() {",
      "  pinMode(PIN_LED, OUTPUT);",
      "  Serial.begin(9600);",
      "}",
      "",
      "void loop() {",
      "  int isik = analogRead(PIN_LDR);          // 0-1023",
      "  Serial.print(\"isik: \"); Serial.println(isik);",
      "  if (isik < ESCIK_AC) digitalWrite(PIN_LED, HIGH);        // karanlık",
      "  else if (isik > ESCIK_KAPAT) digitalWrite(PIN_LED, LOW); // aydınlık",
      "  // aradaki bölge: son durum korunur — titreme yok!",
      "  delay(200);",
      "}"
    ].join("\\n"),
    advanced: [
      { title: "PWM ile karartma", detail: "Karanlığa göre parlaklık: isik 400'ün altına düştükçe LED'i kademeli yak — lamba gün batımına göre kısılır.", tip: "map(isik, 400, 200, 255, 0) + constrain ile 0-255 arasına sıkıştır.", wiring: [], code: "int parlaklik = constrain(map(isik, 400, 200, 255, 0), 0, 255);\nanalogWrite(PIN_LED, parlaklik);" },
      { title: "Butonla kilitleme", detail: "Gece lambasını el ile zorla aç/kapat: mod değişkeni OTOMATIK / ZORLA_ACIK / ZORLA_KAPALI değerleri alır.", tip: "Tek butonla üç durumu geçiş yapmak için edge detection + durum makinesi kullan.", wiring: [
        { from: "ModTusu bir / iki", to: "Arduino D2 / GND", note: "Mod değiştirme (INPUT_PULLUP)" }
      ], code: "// her yeni basışta: mod = (mod + 1) % 3;\n// 0=otomatik, 1=zorla açık, 2=zorla kapalı" }
    ]
  };
}

/* 🎲 Butonla atan dijital zar: random seed + LED noktaları */
function demoDice(title) {
  return {
    ...demoMeta(title, "Başlangıç",
      "Butona basınca 1-6 arasında sayı atan dijital zar. random() fonksiyonunun tohumlama (seed) sırrını, rastgeleliği LED'lerle göstermeyi ve zar yüzlerini kodlamak için ikili sayı sistemini öğren!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Beyin" },
      { name: "Buton", quantity: "1", purpose: "Zarı at" },
      { name: "LED + 220Ω", quantity: "6+6", purpose: "Zar noktaları" },
      { name: "Breadboard + jumperlar", quantity: "1+20", purpose: "Kurulum" }
    ],
    wiring: [
      { from: "AtTusu bir / iki", to: "Arduino D2 / GND", note: "Zar atma butonu (INPUT_PULLUP)" },
      { from: "LED1 A", to: "Arduino D3", note: "Köşe noktası 1 — anot (220Ω)" },
      { from: "LED1 C", to: "Arduino GND", note: "Ortak toprak" },
      { from: "LED2 A", to: "Arduino D4", note: "Köşe noktası 2 — anot (220Ω)" },
      { from: "LED2 C", to: "Arduino GND", note: "Ortak toprak" },
      { from: "LED3 A", to: "Arduino D5", note: "Orta nokta — anot (220Ω)" },
      { from: "LED3 C", to: "Arduino GND", note: "Ortak toprak" },
      { from: "LED4 A", to: "Arduino D6", note: "Köşe noktası 3 — anot (220Ω)" },
      { from: "LED4 C", to: "Arduino GND", note: "Ortak toprak" },
      { from: "LED5 A", to: "Arduino D7", note: "Köşe noktası 4 — anot (220Ω)" },
      { from: "LED5 C", to: "Arduino GND", note: "Ortak toprak" },
      { from: "LED6 A", to: "Arduino D8", note: "Kenar noktası (6 yüzü) — anot (220Ω)" },
      { from: "LED6 C", to: "Arduino GND", note: "Ortak toprak" }
    ],
    wokwiHints: [
      { match: "AtTusu", part: "btn1", type: "wokwi-pushbutton", attrs: { color: "red" }, pins: { "bir": "1.l", "iki": "2.l" } },
      { match: "LED1", part: "led1", type: "wokwi-led", pins: { "A": "A", "C": "C" } },
      { match: "LED2", part: "led2", type: "wokwi-led", pins: { "A": "A", "C": "C" } },
      { match: "LED3", part: "led3", type: "wokwi-led", pins: { "A": "A", "C": "C" } },
      { match: "LED4", part: "led4", type: "wokwi-led", pins: { "A": "A", "C": "C" } },
      { match: "LED5", part: "led5", type: "wokwi-led", pins: { "A": "A", "C": "C" } },
      { match: "LED6", part: "led6", type: "wokwi-led", pins: { "A": "A", "C": "C" } }
    ],
    steps: [
      { title: "Zar yüzlerini kodla", detail: "Gerçek zarda sadece 3 nokta konumu var: 4 köşe + orta. 6'yı göstermek için köşe LED'leri çift olarak (üst-sol + alt-sağ gibi) gruplarsın.", tip: "Kâğıda zar yüzlerini çizip hangi LED'in hangi yüzde yanacağını tablo yap — kod ona göre." },
      { title: "Rastgelelik tuzağı", detail: "random(1, 7) her açılışta AYNI diziyi üretir! Çünkü Arduino'nun rastgele sayısı aslında öngörülebilir bir listedir.", tip: "randomSeed() olmadan her güç verişinde ilk atış hep aynı gelir — deneyip gör!" },
      { title: "Tohumlamayı çöz", detail: "randomSeed(analogRead(A0)): boştaki analog pin havadaki gürültüyü okur — her açılışta farklı tohum, gerçek rastgelelik!", tip: "Boş pini havada bırakmak burada bir HACK'tir ve tamamen meşrudur." },
      { title: "Kanırtma animasyonu", detail: "Butona basınca 1 saniye boyunca 50 ms'de bir rastgele yüz göster, sonra sonucu sabitle — gerçek zar atma hissi.", tip: "for döngüsü + kısa delay en basit yol; kalan süreyi kısaltarak yavaşlayan kanırtma daha gerçekçi." },
      { title: "İstatistik topla", detail: "100 atışın sonucunu saydır: 1-6 dağılımı neredeyse eşit mi? Rastgeleliğin kanıtını Serial'den izle.", tip: "int sayac[7] dizisi kullan — indeks 0 boşta kalır, 1-6 sayar." }
    ],
    tips: [
      "random(1, 7) 1-6 verir: üst sınır HARİÇTİR — random(1, 6) asla 6 vermez.",
      "6 LED × 20mA = 120mA: hepsi aynı anda yanar (yüz 6) pin başına 20mA sınırını aşmaz ama toplam 200mA'yi zorlar.",
      "LED sayısını azaltmak için 7 segment display'i zar olarak kullan — zaten bilmediğin bir proje değil!",
      "randomSeed()i loop'ta değil setup'ta çağır: her seferinde tohumlamak rastgeleliği bozar."
    ],
    code: [
      "// 🎲 Dijital Zar — Demo Rehber Kodu",
      "const int PIN_TUS = 2;",
      "const int PINLER[6] = {3, 4, 5, 6, 7, 8}; // LED pinleri",
      "// Zar yüzleri: her sayıda yanan LED listesi (pin dizisi indeksleri)",
      "const int YUZ[6][6] = {",
      "  {4, -1, -1, -1, -1, -1},        // 1 → orta (LED5, indeks 4)",
      "  {0, 3, -1, -1, -1, -1},         // 2 → çapraz köşeler",
      "  {0, 3, 4, -1, -1, -1},          // 3",
      "  {0, 1, 3, 4, -1, -1},           // 4",
      "  {0, 1, 3, 4, 4, -1},            // 5",
      "  {0, 1, 2, 3, 4, 5}              // 6",
      "};",
      "",
      "void yuzGoster(int n) {",
      "  for (int i = 0; i < 6; i++) digitalWrite(PINLER[i], LOW);",
      "  for (int i = 0; i < 6; i++) { int k = YUZ[n - 1][i]; if (k >= 0) digitalWrite(PINLER[k], HIGH); }",
      "}",
      "",
      "void setup() {",
      "  for (int i = 0; i < 6; i++) pinMode(PINLER[i], OUTPUT);",
      "  pinMode(PIN_TUS, INPUT_PULLUP);",
      "  randomSeed(analogRead(A0));  // boş pin gürültüsü = tohum",
      "  yuzGoster(6);                // açılışta 6 göster",
      "}",
      "",
      "void loop() {",
      "  if (digitalRead(PIN_TUS) == LOW) {",
      "    for (int i = 0; i < 12; i++) { yuzGoster(random(1, 7)); delay(60 + i * 8); } // kanırtma",
      "    yuzGoster(random(1, 7));   // sonuç",
      "    delay(400);                // debounce",
      "  }",
      "}"
    ].join("\n"),
    advanced: [
      { title: "İki zar modu", detail: "İkinci bir butonla çift atış yap: iki zarın toplamını seri monitörde göster — masa oyunlarına hazırlık!", tip: "Toplam için iki ayrı random(1, 7) çağır ve topla — tek random(2, 13) dağılımı bozar (zarlar bağımsızdır).", wiring: [
        { from: "CiftAtisTusu bir / iki", to: "Arduino D12 / GND", note: "Çift atış butonu (INPUT_PULLUP)" }
      ], code: "if (digitalRead(PIN_CIFT) == LOW) {\n  int z1 = random(1, 7), z2 = random(1, 7);\n  Serial.print(z1); Serial.print(\"+\"); Serial.print(z2);\n  Serial.print(\"=\"); Serial.println(z1 + z2);\n}" },
      { title: "İstatistik sayacı", detail: "Her sonucu dizide say; 100 atış sonrası seri monitörde yüzde dağılımını yazdır — zarın adil olup olmadığını ölç!", tip: "Yüzde hesabında float kullan: sayac[i] * 100.0 / toplam — tamsayı bölmesi hep 0 verir.", wiring: [], code: "unsigned long sayac[7];\n// her atışta: sayac[sonuc]++;\n// yüzde: sayac[i] * 100.0 / toplamAtis" }
    ]
  };
}

/* 📏 OLED ekranda canlı mesafe ölçer: HC-SR04 + SSD1306 */
function demoOledRuler(title) {
  return {
    ...demoMeta(title, "Orta",
      "HC-SR04 ile mesafeyi ölçüp SSD1306 OLED ekranda santimetre cinsinden canlı gösteren ölçüm aracı. İki kütüphaneyi birden yönetmeyi, ekran çerçevesi çizmeyi ve ölçüm hatalarını filtrelemeyi öğren!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Beyin" },
      { name: "HC-SR04 ultrasonik sensör", quantity: "1", purpose: "Mesafeyi ölçer" },
      { name: "SSD1306 OLED ekran (I2C)", quantity: "1", purpose: "Sonucu gösterir" },
      { name: "Breadboard + jumperlar", quantity: "1+12", purpose: "Kurulum" }
    ],
    wiring: [
      { from: "HC-SR04 Trig / Echo", to: "Arduino D9 / D10", note: "Tetik + yankı pinleri" },
      { from: "HC-SR04 VCC / GND", to: "Arduino 5V / GND", note: "Besleme" },
      { from: "OLED VCC", to: "Arduino 5V", note: "I2C besleme" },
      { from: "OLED GND", to: "Arduino GND", note: "Ortak toprak" },
      { from: "OLED SDA", to: "Arduino A4", note: "I2C veri hattı — LCD ile aynı" },
      { from: "OLED SCL", to: "Arduino A5", note: "I2C saat hattı — LCD ile aynı" }
    ],
    wokwiHints: [
      { match: "HC-SR04", part: "ultrasonic1", type: "wokwi-hc-sr04", pins: { "VCC": "VCC", "TRIG": "TRIG", "ECHO": "ECHO", "GND": "GND" } },
      { match: "OLED", part: "oled1", type: "wokwi-ssd1306", pins: { "VCC": "VCC", "GND": "GND", "SDA": "SDA", "SCL": "SCL" } }
    ],
    steps: [
      { title: "Sesin yolculuğunu ölç", detail: "Trig'a 10µs'lik darbe ver; sensör 40kHz ses yayar, Echo pini ses geri gelene kadar HIGH kalır. pulseIn() bu süreyi mikrosaniyeyle ölçer.", tip: "Ses 343 m/s: mesafe = süre × 0.0343 / 2 (gidis-dönus iki yol!)." },
      { title: "I2C ekrana katıl", detail: "OLED de LCD gibi A4/A5'e bağlanır — Wire hattında adresler (0x3C) farklı olduğu için çakışmaz. display.begin(SSD1306_SWITCHCAPVCC, 0x3C).", tip: "Wokwi'de wokwi-ssd1306 varsayılan adresi 0x3C'dir; 0x3D ise parametreyi değiştir." },
      { title: "Kodu yükle", detail: "Kodu yükle: ekranda mesafe cm cinsinden canlı akar. Wokwi'de sensörün önündeki kaydırıcıyla engeli yaklaştırıp uzaklaştır!", tip: "Ekran boş kalırsa Wire kütüphanesini ve adresi kontrol et — en sık hata budur." },
      { title: "Çerçeve çiz", detail: "display.drawRectangle(0, 0, 128, 64) ile ekran çerçevesi, içine drawCircle ile bir hedef işareti — ölçüm aracı estetiği!", tip: "Adafruit GFX çizim fonksiyonları (çizgi, daire, metin) hepsi draw ile başlar." },
      { title: "Hataları filtrele", detail: "Sensör bazen 0 ya da saçma değer okur. Son 5 ölçümün ortalamasını al (kayan ortalama) ve 400 cm üzerini yok say.", tip: "int tampon[5] döngüsel tamponu + toplam/5 — proje bitince deniz seviyesindeki güvenilir ölçer!" }
    ],
    tips: [
      "HC-SR04 en iyi 2-200 cm aralığında çalışır; 2 cm altı kör bölgedir.",
      "pulseIn(timeout) ver: ölçüm yokken kod sonsuz beklemesin — pulseIn(ECHO, HIGH, 30000) 30 ms yeter.",
      "Echo pini 5V'tur; 3.3V kartlarda (ESP32) gerilim bölücü kullan.",
      "I2C hattına LDR'yi de eklersen gece lambası mantığıyla akıllı park Sensörü yaparsın."
    ],
    code: [
      "// 📏 OLED Mesafe Ölçer — Demo Rehber Kodu",
      "#include <Wire.h>",
      "#include <Adafruit_GFX.h>",
      "#include <Adafruit_SSD1306.h>",
      "#define EKRAN_GENISLIK 128",
      "#define EKRAN_YUKSEKLIK 64",
      "Adafruit_SSD1306 display(EKRAN_GENISLIK, EKRAN_YUKSEKLIK, &Wire, -1);",
      "const int PIN_TRIG = 9;",
      "const int PIN_ECHO = 10;",
      "",
      "float mesafeOlc() {",
      "  digitalWrite(PIN_TRIG, LOW); delayMicroseconds(2);",
      "  digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(10);",
      "  digitalWrite(PIN_TRIG, LOW);",
      "  long sure = pulseIn(PIN_ECHO, HIGH, 30000);   // 30 ms zaman aşımı",
      "  if (sure == 0) return -1;                     // ölçüm yok",
      "  return sure * 0.0343 / 2;                     // cm",
      "}",
      "",
      "void setup() {",
      "  pinMode(PIN_TRIG, OUTPUT); pinMode(PIN_ECHO, INPUT);",
      "  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);",
      "  display.setTextColor(SSD1306_WHITE);",
      "}",
      "",
      "void loop() {",
      "  float mesafe = mesafeOlc();",
      "  display.clearDisplay();",
      "  display.drawRectangle(0, 0, 128, 64, SSD1306_WHITE);",
      "  display.setTextSize(2); display.setCursor(16, 20);",
      "  if (mesafe > 0) { display.print(mesafe, 1); display.print(\" cm\"); }",
      "  else display.print(\"-- cm\");",
      "  display.display();",
      "  delay(150);",
      "}"
    ].join("\\n"),
    advanced: [
      { title: "Yakınlık alarmı", detail: "20 cm altına inince buzzer ötsün ve ekran kenarı kırmızıya dönsün — park sensörüne doğru ilk adım.", tip: "Araç park sensörleri de aynı ilkeyle 'bip' hızını mesafeye bağlı artırır.", wiring: [
        { from: "Buzzer pozitif (+)", to: "Arduino D8", note: "Yakınlık uyarısı" },
        { from: "Buzzer negatif (−)", to: "Arduino GND", note: "Toprak" }
      ], code: "const int PIN_BZ = 8;\nif (mesafe > 0 && mesafe < 20) tone(PIN_BZ, 1200); else noTone(PIN_BZ);" },
      { title: "Min/maks kaydı", detail: "Butonla ölçülen en küçük ve en büyük mesafeyi kaydet; ekranda alt satırda göster — atölyede rekor avına dönüştür!", tip: "İki global değişken + min()/max() karşılaştırması; EEPROM'a yazarsan güç kesilse de kalır.", wiring: [
        { from: "KayitTusu bir / iki", to: "Arduino D2 / GND", note: "Kayıt sıfırlama (INPUT_PULLUP)" }
      ], code: "if (mesafe > 0) { if (mesafe < enKucuk) enKucuk = mesafe; if (mesafe > enBuyuk) enBuyuk = mesafe; }" }
    ]
  };
}

/* Potansiyometreyle gökkuşağı tonlarında renk veren RGB lamba */
function demoRgbLamp(title) {
  return {
    ...demoMeta(title, "Başlangıç",
      "Potansiyometreyi çevirdikçe gökkuşağının tüm renkleri arasında geçiş yapan RGB lamba. analogWrite ile renk karıştırmayı ve 0-767 ton haritasını öğren — Wokwi'de canlı denenebilir!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Beyin" },
      { name: "RGB LED (ortak katot)", quantity: "1", purpose: "Üç rengi tek gövdede karıştırır" },
      { name: "220Ω direnç", quantity: "3", purpose: "R, G, B bacakları için" },
      { name: "Potansiyometre", quantity: "1", purpose: "Renk tonunu seçer" },
      { name: "Breadboard + jumperlar", quantity: "1+15", purpose: "Kurulum" }
    ],
    wiring: [
      { from: "RGB R / G / B", to: "Arduino D9 / D10 / D11 (PWM)", note: "Her bacağa 220Ω direnç" },
      { from: "RGB COM (ortak katot)", to: "Arduino GND", note: "Ortak bacak — en uzun ayak" },
      { from: "Pot VCC / GND", to: "Arduino 5V / GND", note: "Pot beslemesi" },
      { from: "Pot SIG", to: "Arduino A0", note: "Renk tonu okuması" }
    ],
    wokwiHints: [
      { match: "RGB", part: "rgb1", type: "wokwi-rgb-led", attrs: { common: "cathode" }, pins: { "R": "R", "G": "G", "B": "B", "COM": "COM" } },
      { match: "Pot", part: "pot1", type: "wokwi-potentiometer", pins: { "VCC": "VCC", "GND": "GND", "SIG": "SIG" } }
    ],
    steps: [
      { title: "Renk karıştırma mantığı", detail: "RGB LED'in içinde 3 ayrı LED var: kırmızı, yeşil, mavi. Her birine farklı PWM değeri (0-255) verirsen 16 milyondan fazla renk çıkar!", tip: "Ortak katot LED'de COM bacağı GND'ye gider; ortak anotsa 5V'e — tersine çevirirsen renkler ters çalışır." },
      { title: "Devreyi kur", detail: "R, G, B bacaklarını 220Ω dirençlerle PWM pinlerine (D9-D11) bağla. Potansiyometrenin SIG ayağını A0'a ver.", tip: "PWM işareti (~) olan pinleri kullan — digitalWrite HIGH/LOW yalnızca 7 renk verir." },
      { title: "Kodu yükle", detail: "Kodu yükle ve potu çevir: 0'da kırmızı, ortada yeşil, uçta mavi tonları akan gökkuşağı izlenimi verir.", tip: "Wokwi'de simülasyonu başlatıp potu sürükleyerek renk geçişini canlı izle." },
      { title: "Ton haritasını anla", detail: "A0 değeri 0-1023; biz bunu 0-767'ye açıyoruz: 0-255 kırmızıdan yeşile, 256-511 yeşilden... Her bölge bir kanalı artırıp diğerini azaltır.", tip: "map() sonrası sınır değerlerini Serial'den yazdırarak her bölgeyi tek tek doğrula." },
      { title: "Oda ışığı modu", detail: "Tonu sabitleyip parlaklığı ikinci bir potla ayarla — gerçek mood lambası deneyimi.", tip: "Parlaklık = renk değerini ölçeklemek: r = r * parlaklik / 255." }
    ],
    tips: [
      "PWM pinleri Uno'da yalnızca 3, 5, 6, 9, 10, 11'dir — R/G/B'yi buralara bağla.",
      "Ortak anot RGB LED kullanırsan değerleri 255 - x ile tersle.",
      "Dirençsiz bağlarsan LED ömrü kısalır — 3 bacağa da ayrı ayrı 220Ω koy.",
      "Yumuşak geçişler için delay yerine millis() tabanlı karıştırma kullan."
    ],
    code: [
      "// 🌈 RGB Mood Lambası — Demo Rehber Kodu",
      "const int PIN_R = 9, PIN_G = 10, PIN_B = 11;",
      "const int PIN_POT = A0;",
      "",
      "void setup() {",
      "  pinMode(PIN_R, OUTPUT); pinMode(PIN_G, OUTPUT); pinMode(PIN_B, OUTPUT);",
      "  Serial.begin(9600);",
      "}",
      "",
      "void loop() {",
      "  int ton = analogRead(PIN_POT);        // 0-1023",
      "  int i = map(ton, 0, 1023, 0, 767);    // 3 renk bölgesi",
      "  int r = 0, g = 0, b = 0;",
      "  if (i < 256)      { r = 255;     g = i;       b = 0; }",
      "  else if (i < 512) { r = 511 - i; g = 255;     b = 0; }",
      "  else              { r = 0;       g = 767 - i; b = i - 512; }",
      "  analogWrite(PIN_R, r); analogWrite(PIN_G, g); analogWrite(PIN_B, b);",
      "  Serial.print(\"ton: \"); Serial.println(i);",
      "  delay(50);",
      "}"
    ].join("\n"),
    advanced: [
      { title: "Butonla beyaz mod", detail: "Bir buton ekleyip basılınca tüm kanalları 255'e çek — beyaz ışık. Tekrar basınca pot kontrolüne dön.", tip: "bool mod değişkeniyle iki davranış arasında geçiş yap; loop'ta mod'a göre dal üret.", wiring: [
        { from: "ModTusu bir / iki", to: "Arduino D2 / GND", note: "Beyaz mod anahtarı (INPUT_PULLUP)" }
      ], code: "const int PIN_MOD = 2;\nbool beyaz = false;\n// butona basılınca: beyaz = !beyaz;\n// beyaz ise r=g=b=255, değilse pot haritası" },
      { title: "Yumuşak nefes efekti", detail: "Pot ortadayken sabit kalmak yerine parlaklığı sinüs gibi yavaşça artırıp azalt — lamba 'nefes' alır.", tip: "millis() ile 0-255 arası üçgen dalga üret: her 20 ms'de +1, uçta yön değiştir.", wiring: [], code: "int parlaklik = 0; int yon = 1;\nunsigned long son = 0;\n// loop: if (millis() - son > 20) { parlaklik += yon;\n//   if (parlaklik >= 255 || parlaklik <= 0) yon = -yon; son = millis(); }" }
    ]
  };
}

/* Servo ile açılıp kapanan, buton kontrollü kapı kilidi */
function demoServoLock(title) {
  return {
    ...demoMeta(title, "Orta",
      "Butona basınca kolunu 90° döndürüp kilidi açan, tekrar basınca kapatan servo kapı kilidi. Servo kütüphanesini, kenar algılamayı (edge detection) ve durum makinesi mantığını öğren!"),
    materials: [
      { name: "Arduino Uno", quantity: "1", purpose: "Beyin" },
      { name: "SG90 servo motor", quantity: "1", purpose: "Kilit kolunu döndürür" },
      { name: "Buton", quantity: "1", purpose: "Kilit aç/kapat anahtarı" },
      { name: "Yeşil LED + 220Ω", quantity: "1+1", purpose: "Kilit açık göstergesi" },
      { name: "Breadboard + jumperlar", quantity: "1+15", purpose: "Kurulum" }
    ],
    wiring: [
      { from: "Servo PWM / V+ / GND", to: "Arduino D9 / 5V / GND", note: "Turuncu=PWM, kırmızı=V+, kahverengi=GND" },
      { from: "KilitTusu bir / iki", to: "Arduino D2 / GND", note: "Kilit aç/kapat (INPUT_PULLUP)" },
      { from: "LED anot (A)", to: "Arduino D13 (220Ω ile)", note: "Kilit açık ışığı" },
      { from: "LED katot (C)", to: "Arduino GND", note: "Ortak toprak" }
    ],
    wokwiHints: [
      { match: "Servo", part: "servo1", type: "wokwi-servo", pins: { "PWM": "PWM", "V+": "V+", "GND": "GND" } },
      { match: "KilitTusu", part: "btn1", type: "wokwi-pushbutton", attrs: { color: "green" }, pins: { "bir": "1.l", "iki": "2.l" } },
      { match: "LED", part: "led1", type: "wokwi-led", attrs: { color: "green" }, pins: { "A": "A", "C": "C" } }
    ],
    steps: [
      { title: "Servoyu tanı", detail: "Servo, içine motor + redüktör + kontrol kartı gömülü bir motor: kendisi açıyı tutar. 0° kapalı, 90° açık kabul edeceğiz.", tip: "Servo3 kablo: turuncu sinyal, kırmızı 5V, kahverengi GND — renkler üreticiye göre değişebilir, kablo sayısı değişmez." },
      { title: "Devreyi kur", detail: "Servoyu D9'a, butonu D2 + GND'ye, LED'i D13'e bağla. INPUT_PULLUP sayesinde buton dirençsiz çalışır.", tip: "Gerçek devrede birden fazla servo sürerken 5V pini yetersiz kalır — harici besleme şart." },
      { title: "Kodu yükle", detail: "Kodu yükle, seri monitörü aç (9600). Butona her basışta kilit değişmeli: KACIK ↔ KAPALI.", tip: "Servo.attach(9) ile sinyal pini tanımlanır; write(90) açıyı verir." },
      { title: "Kenar algılamayı anla", detail: "Kod, butonun YENİ basıldığı anı yakalar: simdi && !onceki koşulu. Böylece basılı tutmak kilidi sürekli çevirmez.", tip: "Bu kalıbın adı edge detection — tüm butonlu arayüzlerin temelidir." },
      { title: "Gerçek kapıya monte et", detail: "Karton bir kapı yap, servo kolunu kapı mandalına bağla. LED'i kapının yanına yerleştir.", tip: "Servo kolunu vida yerine sıcak silikonla sabitlemek denemelerde kolaylık sağlar." }
    ],
    tips: [
      "Servo ilk hareket anında akım çeker — 5V pini ile beslerken kablo kalınlığına dikkat.",
      "delay(300) debounce'u basitçe çözer; profesyonel çözüm millis() tabanlıdır.",
      "Servo.write(0) ile write(90) arasındaki geçiş hızını Servo kütüphanesi ayarlayamaz — kol yolu mekanik olarak kısalt.",
      "Keypad + LCD ile şifreli kilit, bu projenin doğal devamıdır."
    ],
    code: [
      "// 🔐 Servo Kapı Kilidi — Demo Rehber Kodu",
      "#include <Servo.h>",
      "Servo kilit;",
      "const int PIN_SERVO = 9;",
      "const int PIN_TUS   = 2;",
      "const int PIN_LED   = 13;",
      "bool kilitAcik = false;",
      "bool onceki = false;                 // butonun önceki durumu",
      "",
      "void setup() {",
      "  kilit.attach(PIN_SERVO);",
      "  kilit.write(0);                    // kapalı başla",
      "  pinMode(PIN_TUS, INPUT_PULLUP);",
      "  pinMode(PIN_LED, OUTPUT);",
      "  Serial.begin(9600);",
      "}",
      "",
      "void loop() {",
      "  bool simdi = digitalRead(PIN_TUS) == LOW;   // basılı mı?",
      "  if (simdi && !onceki) {            // yeni basış algılandı",
      "    kilitAcik = !kilitAcik;",
      "    kilit.write(kilitAcik ? 90 : 0);",
      "    digitalWrite(PIN_LED, kilitAcik);",
      "    Serial.println(kilitAcik ? \"KACIK\" : \"KAPALI\");",
      "    delay(300);                      // debounce",
      "  }",
      "  onceki = simdi;",
      "}"
    ].join("\n"),
    advanced: [
      { title: "Otomatik kapanma", detail: "Kilit açıldıktan 5 saniye sonra kendiliğinden kapansın — gerçek kapı kilitleri gibi. millis() ile süre tut.", tip: "acilisZamani = millis(); koşulu kilitlenme anında kaydet; millis() - acilisZamani > 5000 olduğunda kilitle.", wiring: [], code: "unsigned long acilisZamani = 0;\n// açılınca: acilisZamani = millis();\n// if (kilitAcik && millis() - acilisZamani > 5000) kilitle();" },
      { title: "Şifreli giriş", detail: "İki butonla ikili şifre: belirli bir basış dizisi (örn. sol-sağ-sağ) doğruysa kilit açılsın, yanlışsa LED 3 kez yanıp sönsün.", tip: "Basışları bir dizide biriktirip her basışta karşılaştır — dizi dolunca sıfırla.", wiring: [
        { from: "SifreSol bir / iki", to: "Arduino D3 / GND", note: "Şifre butonu 1 (INPUT_PULLUP)" },
        { from: "SifreSag bir / iki", to: "Arduino D4 / GND", note: "Şifre butonu 2 (INPUT_PULLUP)" }
      ], code: "const int DOGRU[3] = {1, 2, 2};   // 1=sol 2=sağ\nint giris[3]; int sira = 0;\n// her yeni basışta giris[sira++] = butonNo;\n// sira == 3 olunca diziyi DOGRU ile karşılaştır" }
    ]
  };
}

/* ───────────────────── Rehber Render ───────────────────── */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* Sertifika adını hatırla (arşivden sertifika üretiminde de kullanılır) */
const CERT_NAME_KEY = "arduinoDreamLab.certName.v1";
function loadCertName() {
  try { return localStorage.getItem(CERT_NAME_KEY) || ""; } catch { return ""; }
}
function saveCertName(name) {
  try { localStorage.setItem(CERT_NAME_KEY, name); } catch {}
}

/* ══════════════════ ÖĞRENCİ BAŞARILARI ══════════════════
   Kazanılan sertifikalar + okunan öğretmen geri bildirimleri + tamamlanan
   gönderiler tek yerde: header'daki 🏅 düğmesiyle açılan modal. */
const BADGES_KEY = "arduinoDreamLab.badges.v1";
function loadBadges() {
  try { const v = JSON.parse(localStorage.getItem(BADGES_KEY)); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveBadges(list) {
  try { localStorage.setItem(BADGES_KEY, JSON.stringify(list.slice(-50))); } catch {}
}
function recordCertificate(g, studentName) {
  if (!g || !studentName) return;
  const list = loadBadges();
  const title = g.title || "—";
  if (list.some((b) => b.type === "cert" && b.project === title && b.student === studentName)) return;
  /* guide snapshot'ı saklanır → Portfolyo.zip sertifikalı projelerin paketlerini üretebilir */
  list.push({ type: "cert", project: title, student: String(studentName).slice(0, 60), difficulty: g.difficulty || "", classCode: loadClassroom().code || "", ts: Date.now(), guide: g });
  saveBadges(list);
  updateBadgeCount();
}
/* 🏅 Rozet kademeleri: bronz ≥3, gümüş ≥5, altın = tüm demo rehber sayısı */
/* 🏅 Kademe eşiği: demo rehber sayısından türetilir (altın = hepsi) */
function demoGuideCount() {
  return ["çizgi", "saksı", "termostat", "güvenlik", "robot kol", "7 segment", "park", "piyano",
    "dijital saat", "mood lambası", "kapı kilidi", "gece lambası", "dijital zar", "mesafe ölçer"]
    .map((k) => makeDemoGuide(k)).filter((g) => g && !g.ai && g.title).length;
}
const DEMO_GUIDE_COUNT = demoGuideCount();
function badgeTiers() {
  const certs = loadBadges().filter((b) => b.type === "cert");
  const tiers = [
    { name: "Bronz", icon: "🥉", goal: 3, css: "tier-bronze" },
    { name: "Gümüş", icon: "🥈", goal: 5, css: "tier-silver" },
    { name: "Altın", icon: "🥇", goal: DEMO_GUIDE_COUNT, css: "tier-gold" }
  ];
  let earned = null;
  tiers.forEach((tr) => { if (certs.length >= tr.goal) earned = tr; });
  return { certs: certs.length, all: DEMO_GUIDE_COUNT, tiers, earned };
}
function openBadgesModal() {
  const en = getLang() === "en";
  const modal = document.getElementById("badgesModal");
  const body = document.getElementById("badgesBody");
  if (!modal || !body) return;
  const items = loadBadges().slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const certs = items.filter((b) => b.type === "cert");
  const fbs = items.filter((b) => b.type === "fb");
  /* 🏅 Kademeler: bronz ≥3, gümüş ≥5, altın = tüm demo rehber sayısı (11) */
  const bt = badgeTiers();
  const next = bt.tiers.find((tr) => certs.length < tr.goal);
  const nextText = next
    ? (en
      ? `Next goal: <strong>${next.icon} ${next.name}</strong> — <strong>${next.goal - certs.length}</strong> more certificate${next.goal - certs.length > 1 ? "s" : ""} to go!`
      : `Sonraki hedef: <strong>${next.icon} ${next.name}</strong> — <strong>${next.goal - certs.length}</strong> sertifika kaldı!`)
    : (en
      ? "🎉 All demos completed — you reached the <strong>Gold</strong> tier! You're an Arduino master now."
      : "🎉 Tüm demoları bitirdin — <strong>Altın</strong> kademeye ulaştın! Artık bir Arduino ustasısın.");
  const tierCard = `
    <div class="tier-row">${bt.tiers.map((tr) => `
      <div class="tier-cell ${tr.css}${certs.length >= tr.goal ? " earned" : ""}">
        <div class="tier-icon">${tr.icon}</div>
        <div class="tier-name">${esc(tr.name)}</div>
        <div class="tier-goal">${Math.min(certs.length, tr.goal)}/${tr.goal}</div>
      </div>`).join("")}
    </div>
    <div class="tier-next">${nextText}</div>`;
  const card = (icon, label, b) => `
    <div class="archive-item badge-item">
      <h4>${icon} ${esc(label)}</h4>
      <div class="arch-meta"><span class="arch-badge">${esc(b.project || "—")}</span><span class="arch-date">📅 ${new Date(b.ts).toLocaleDateString(en ? "en-US" : "tr-TR")}</span></div>
      ${b.student ? `<div class="badge-student">👤 ${esc(b.student)}</div>` : ""}
      ${b.comment ? `<div class="fb-shown">${esc(b.comment)}</div>` : ""}
    </div>`;
  const anyCerts = certs.length > 0;
  body.innerHTML = `
    ${tierCard}
    <h3 style="margin:1rem 0 .6rem">${t("🏅 Sertifikalar")} <span class="count-badge">${certs.length}</span></h3>
    ${certs.length ? `<div class="archive-grid">${certs.map((b) => card("🏅", en ? "Certificate" : "Sertifika", b)).join("")}</div>` : `<p class="modal-desc">${t("Henüz sertifikan yok — bir rehberin tüm adımlarını bitirip sertifika oluştur!")}</p>`}
    <h3 style="margin:1rem 0 .6rem">${t("💬 Öğretmen geri bildirimleri")} <span class="count-badge">${fbs.length}</span></h3>
    ${fbs.length ? `<div class="archive-grid">${fbs.map((b) => card("💬", en ? "Feedback" : "Geri bildirim", b)).join("")}</div>` : `<p class="modal-desc">${t("Henüz geri bildirim okunmadı — öğretmeninden .geribildirim dosyası alıp rehberde \"Geri Bildirimi Göster\" ile aç.")}</p>`}
    <div class="modal-actions" style="margin-top:1rem">
      <button class="btn btn-ghost btn-small" id="portfolioBtn" type="button" ${anyCerts ? "" : "disabled"} title="${t("Sertifikalı tüm rehberlerin Wokwi paketlerini tek zip'te indir")}">📦 ${t("Portfolyo.zip")} (${certs.length})</button>
    </div>`;
  const pbtn = document.getElementById("portfolioBtn");
  if (pbtn && !pbtn.disabled) pbtn.addEventListener("click", downloadPortfolio);
  modal.hidden = false;
}
function closeBadgesModal() {
  const modal = document.getElementById("badgesModal");
  if (modal) modal.hidden = true;
}
function updateBadgeCount() {
  const el = document.getElementById("badgesCount");
  if (el) el.textContent = String(loadBadges().length);
}

function highlightArduino(code) {
  let html = esc(code);
  html = html.replace(/(\/\/[^\n]*)/g, '<span class="cm">$1</span>');
  const kw = /\b(void|int|const|bool|float|unsigned|long|if|else|return|true|false|HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|define|include|delay|map|constrain|abs|isnan)\b/g;
  html = html.replace(kw, '<span class="kw">$1</span>');
  html = html.replace(/\b(pinMode|digitalWrite|digitalRead|analogWrite|analogRead|Serial\.begin|Serial\.print|Serial\.println|tone|noTone|millis|setup|loop|init|backlight|print|setCursor|clear|begin|readTemperature|readHumidity)\b(?=\()/g, '<span class="fn">$1</span>');
  return html;
}

/* ───────────────────── Malzeme Fiyat Kataloğu ─────────────────────
   Öğrencilerin bütçe planlaması için yaklaşık Türkiye perakende
   fiyatları (USD cinsinden; ₺ fiyatı kur ile hesaplanır).
   Anahtarlar: foldTR ile katlanıp "İÇERİR" mantığıyla eşleşir —
   en uzun anahtar önce denenir ("10kΩ direnç" → "220Ω direnç"ten önce). */
const PRICE_CATALOG = [
  { k: ["SG90", "SERVO MOTOR"], usd: 2.5, note: "SG90" },
  { k: ["L298N"], usd: 3.5, note: "L298N" },
  { k: ["LDR", "FOTOREZIST"], usd: 0.25, note: "LDR" },
  { k: ["DHT11"], usd: 2.0, note: "DHT11" },
  { k: ["DHT22"], usd: 4.0, note: "DHT22" },
  { k: ["HC-SR04", "ULTRASONIK"], usd: 1.5, note: "HC-SR04" },
  { k: ["HC-SR501", "PIR"], usd: 2.0, note: "PIR" },
  { k: ["TCRT5000", "IR SENSOR"], usd: 0.75, note: "TCRT5000" },
  { k: ["RGB LED"], usd: 0.4, note: "RGB LED" },
  { k: ["7 SEGMENT"], usd: 1.0, note: "7 segment" },
  { k: ["SSD1306", "OLED"], usd: 3.5, note: "OLED" },
  { k: ["LCD1602", "16X2 I2C LCD"], usd: 4.0, note: "LCD1602" },
  { k: ["SU POMPASI"], usd: 3.0, note: "pompa" },
  { k: ["5V USB FAN"], usd: 2.5, note: "fan" },
  { k: ["ROLE MODULU"], usd: 1.5, note: "röle" },
  { k: ["DC MOTOR"], usd: 2.0, note: "DC motor" },
  { k: ["NTC"], usd: 0.5, note: "NTC" },
  { k: ["TOPRAK NEM"], usd: 1.0, note: "nem sensörü" },
  { k: ["JOYSTICK"], usd: 1.5, note: "joystick" },
  { k: ["POTANSIYOMETRE 10"], usd: 0.5, note: "10k pot" },
  { k: ["POTANSIYOMETRE"], usd: 0.4, note: "pot" },
  { k: ["BREADBOARD + JUMPER"], usd: 4.0, note: "breadboard+kablo" },
  { k: ["JUMPER"], usd: 2.0, note: "jumper" },
  { k: ["BREADBOARD"], usd: 2.5, note: "breadboard" },
  { k: ["18650"], usd: 2.5, note: "18650" },
  { k: ["ADAPTOR", "GUC BANKASI"], usd: 5.0, note: "adaptör" },
  { k: ["USB KABLOSU"], usd: 1.5, note: "USB kablo" },
  { k: ["SILIKON HORTUM"], usd: 1.0, note: "hortum" },
  { k: ["SASI KIT"], usd: 8.0, note: "şasi" },
  { k: ["KASTA TEKER"], usd: 1.0, note: "kasta teker" },
  { k: ["KIRMIZI LED +"], usd: 0.25, note: "LED" },
  { k: ["YESIL LED +"], usd: 0.25, note: "LED" },
  { k: ["LED +"], usd: 0.25, note: "LED" },
  { k: ["10KΩ"], usd: 0.1, note: "10kΩ" },
  { k: ["220Ω"], usd: 0.1, note: "220Ω" },
  { k: ["BUTON"], usd: 0.25, note: "buton" },
  { k: ["BUZZER"], usd: 0.5, note: "buzzer" },
  { k: ["ARDUINO UNO"], usd: 10.0, note: "Uno" },
  { k: ["ARDUINO NANO"], usd: 6.0, note: "Nano" }
];
const USD_TRY_RATE = 34; // varsayılan kur — çevrimiçi güncellenebilir (v2.15.0)

/* ── Çevrimiçi kur (v2.15.0): exchangerate.host'tan USD→TRY çekilir;
   localStorage'da saklanır, 24 saatten eskiyse önerilir. Tüm ₺ gösterimleri
   rate() üzerinden hesaplanır — API hatalarında saklanan/varsayılan değer kullanılır. */
const RATE_KEY = "arduinoDreamLab.rate.v1";
function loadRate() {
  try {
    const o = JSON.parse(localStorage.getItem(RATE_KEY));
    if (o && isFinite(o.rate) && o.rate > 0 && o.rate < 1000) return { rate: o.rate, ts: o.ts || 0 };
  } catch {}
  return { rate: USD_TRY_RATE, ts: 0 };
}
function rate() { return loadRate().rate; }
function rateAgeHours() {
  const o = loadRate();
  return o.ts ? (Date.now() - o.ts) / 3600000 : Infinity;
}
async function updateRateFromWeb() {
  const endpoints = [
    "https://api.exchangerate.host/latest?base=USD&symbols=TRY",
    "https://open.er-api.com/v6/latest/USD"
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const r = Number(data && data.rates && data.rates.TRY);
      if (isFinite(r) && r > 0 && r < 1000) {
        localStorage.setItem(RATE_KEY, JSON.stringify({ rate: r, ts: Date.now() }));
        return { ok: true, rate: r };
      }
    } catch {}
  }
  return { ok: false, rate: rate() };
}

/* ── Öğretmen özel fiyat kataloğu (v2.11.0) ──
   Okulun kataloğu farklıysa öğretmen Ayarlar'dan "Parça adı: fiyat (USD)"
   satırları girer; en uzun eşleşen ad katalog fiyatının YERİNE geçer. */
const CUSTOM_PRICES_KEY = "arduinoDreamLab.customPrices.v1";
function loadCustomPrices() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_PRICES_KEY)) || {}; } catch { return {}; }
}
function saveCustomPrices(map) {
  localStorage.setItem(CUSTOM_PRICES_KEY, JSON.stringify(map || {}));
  if (typeof currentGuide !== "undefined" && currentGuide) renderGuide(currentGuide, undefined, { scroll: false });
}
/* Metin alanını sözlüğe çevirir: "Arduino Uno: 8" / "SG90 servo = 2,75" */
function parseCustomPrices(text) {
  const out = {};
  String(text || "").split(/\n+/).forEach((ln) => {
    const m = ln.match(/^\s*(.+?)\s*[:=]\s*([\d.,]+)\s*$/);
    if (!m) return;
    const usd = parseFloat(m[2].replace(",", "."));
    if (!isFinite(usd) || usd < 0) return;
    out[m[1].trim()] = usd;
  });
  return out;
}

/* ── Bütçe sınırı (v2.12.0): öğretmen USD cinsinden üst sınır girer;
   toplam aşılırsa malzeme tablosunda kırmızı uyarı çıkar ── */
const BUDGET_KEY = "arduinoDreamLab.budget.v1";
function loadBudget() {
  const v = parseFloat(localStorage.getItem(BUDGET_KEY));
  return isFinite(v) && v > 0 ? v : 0;
}
function isOverBudget(totalUSD) {
  const b = loadBudget();
  return b > 0 && totalUSD > b;
}

/* Katalog JSON paylaşımı (v2.12.0): { prices: {ad: usd}, budget: usd } —
   öğretmen katalogunu dosya olarak dışa aktarır / başka cihazda içe aktarır. */
function parseCatalogJSON(text) {
  try {
    const o = JSON.parse(String(text || ""));
    const prices = {};
    if (o && typeof o === "object" && o.prices && typeof o.prices === "object") {
      for (const k of Object.keys(o.prices)) {
        const v = Number(o.prices[k]);
        if (k && isFinite(v) && v >= 0) prices[k] = v;
      }
    }
    if (!Object.keys(prices).length) return null;
    const budget = Number(o.budget);
    return { prices, budget: isFinite(budget) && budget > 0 ? budget : 0 };
  } catch { return null; }
}

/* ── Depoda tutulan varsayılan katalog (v2.14.0) ──
   build.py fiyat-katalogu.json'u FILE_CATALOG olarak JS'in başına gömer
   (kaynak app.js'te bildirilmez; testler ve derlemesiz kullanım için
   typeof ile savunmacı erişilir).
   Öncelik: öğretmen özel (localStorage) → depo (FILE_CATALOG) → gömülü PRICE_CATALOG. */
function loadFileCatalog() {
  let fc = null;
  try { fc = typeof FILE_CATALOG !== "undefined" ? FILE_CATALOG : null; } catch { fc = null; }
  if (!fc || typeof fc !== "object") return null;
  const prices = {};
  const src = (fc && fc.prices) || {};
  for (const k of Object.keys(src)) {
    const v = Number(src[k]);
    if (k && isFinite(v) && v >= 0) prices[k] = v;
  }
  if (!Object.keys(prices).length) return null;
  const budget = Number(fc.budget);
  return { prices, budget: isFinite(budget) && budget > 0 ? budget : 0 };
}
function fileCatalogBudget() {
  const fc = loadFileCatalog();
  return fc ? fc.budget : 0;
}
/* Bütçe aşımı önerisi: Uno ↔ Nano çifti (v2.14.0) */
function budgetSuggestion(totalUSD) {
  if (!isOverBudget(totalUSD)) return "";
  const f = loadCustomPrices();
  const unoP = f["Arduino Uno"] != null ? Number(f["Arduino Uno"]) : 10.0;
  const nanoP = f["Arduino Nano"] != null ? Number(f["Arduino Nano"]) : 6.0;
  return `💡 ${t("Bütçe önerisi")}: ${t("Arduino Uno yerine Arduino Nano kullan")} ($${unoP.toFixed(2)} → $${nanoP.toFixed(2)})`;
}
/* Fikir yazarken canlı maliyet ipucu (v2.14.0): metni makeDemoGuide'a verip
   tahmini fiyatlarız — v2.16.0'da API anahtarı varsa AI'a gerçek parça listesi
   sorulur, başarısızlıkta demo şablonuna düşer. */
const aiCostCache = new Map(); // normalize metin → { ts, materials }
function liveCostHintSync(text) {
  const s = String(text || "").trim();
  if (s.length < 30) return "";
  try {
    const g = makeDemoGuide(s);
    if (!g || !g.materials || !g.materials.length) return "";
    const est = estimateCost(g);
    if (est.totalUSD <= 0) return "";
    return t("💡 Bu fikre benzer proje") + " ≈ " + fmtTL(est.totalUSD);
  } catch { return ""; }
}
/* Eşzamansız sürüm: AI varsa gerçek parça listesi, yoksa/iffa'da demo ipucu.
   onDone çıktıyı DOM'a basar (eski bir yanıt geç kalyorsa en yeni metin kazanır). */
async function liveCostHint(text, onDone) {
  const s = String(text || "").trim();
  const sync = liveCostHintSync(s);
  if (s.length < 30) { if (onDone) onDone(""); return ""; }
  // Hemen demo ipucunu göster (bekletmesin)
  if (onDone) onDone(sync);
  // AI yoksa senkron ipucu nihai
  if (!hasApiKey()) return sync;
  const norm = s.toLowerCase().replace(/\s+/g, " ").trim();
  const hit = aiCostCache.get(norm);
  if (hit && Date.now() - hit.ts < AI_COST_TTL) {
    const est = estimateCost({ materials: hit.materials });
    if (est.totalUSD > 0) {
      const msg = t("✨ AI tahmini") + " ≈ " + fmtTL(est.totalUSD) + (est.anyUnknown ? "" : "");
      if (onDone) onDone(msg);
      return msg;
    }
  }
  try {
    const mats = await askAICostMaterials(s);
    aiCostCache.set(norm, { ts: Date.now(), materials: mats });
    const est = estimateCost({ materials: mats });
    if (est.totalUSD > 0) {
      const msg = t("✨ AI tahmini") + " ≈ " + fmtTL(est.totalUSD) + (est.anyUnknown ? ` · ${t("bazı parçalar fiyatlanmadı")}` : "");
      if (onDone) onDone(msg);
      return msg;
    }
  } catch { /* sessizce demo ipucunda kal */ }
  return sync;
}

/* Malzeme adını katalogdaki en uzun eşleşen anahtarla fiyatlandır.
   Dönen değer: { usd, note } | null (katalogda yok — fiyat bilinmiyor) */
function priceOf(name) {
  const f = foldTR(String(name || ""));
  if (!f) return null;
  // Öncelik sırası (v2.14.0): öğretmen özel → depo kataloğu → gömülü PRICE_CATALOG.
  // Her katman kendi içinde en uzun eşleşen adı seçer.
  const custom = loadCustomPrices();
  let bestUsd = null, bestLen = 0;
  for (const nm of Object.keys(custom)) {
    const kf = foldTR(nm);
    const usd = Number(custom[nm]);
    if (kf && f.includes(kf) && kf.length > bestLen && isFinite(usd) && usd >= 0) {
      bestUsd = usd; bestLen = kf.length;
    }
  }
  if (bestUsd != null) return { usd: bestUsd, note: "özel" };
  const fileCat = loadFileCatalog();
  if (fileCat) {
    let fBest = null, fLen = 0;
    for (const nm of Object.keys(fileCat.prices)) {
      const kf = foldTR(nm);
      if (kf && f.includes(kf) && kf.length > fLen) { fBest = fileCat.prices[nm]; fLen = kf.length; }
    }
    if (fBest != null) return { usd: fBest, note: "depo" };
  }
  for (const e of PRICE_CATALOG) {
    if (e.k.some((kk) => f.includes(kk))) return { usd: e.usd, note: e.note };
  }
  return null;
}

/* Rehberin malzeme listesinden ortalama proje fiyatı tahmini.
   Birim fiyatlar ortalama perakende; katalogda olmayanlar hariç tutulur.
   Dönen: { rows: [{name, qty, unit, total, unitText, note, known}], totalUSD, anyUnknown } */
function estimateCost(g, qtyOv) {
  const rows = [];
  let totalUSD = 0;
  let anyUnknown = false;
  for (const m of (g && g.materials) || []) {
    const rawQty = qtyOv && qtyOv[m.name] != null ? qtyOv[m.name] : m.quantity;
    const qtyNum = parseFloat(String(rawQty).replace(",", ".")) || 0;
    const p = priceOf(m.name);
    if (!p) {
      rows.push({ name: m.name, qty: rawQty, unit: null, total: null, note: "", known: false });
      anyUnknown = true;
      continue;
    }
    const total = p.usd * qtyNum;
    totalUSD += total;
    rows.push({ name: m.name, qty: rawQty, unit: p.usd, total, note: p.note, known: true });
  }
  return { rows, totalUSD, anyUnknown };
}

/* Fiyatı hem ₺ hem $ olarak gösterir (v2.12.0: ₺ ana birim; kur rate() — v2.15.0 çevrimiçi) */
function fmtTL(usd) {
  const tl = usd * rate();
  const r2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
  return `${r2(tl)}₺ ($${r2(usd)})`;
}

/* Tablo satırlarını fiyata göre sıralar (v2.13.0): "desc" pahalıdan ucuza,
   "asc" ucuza pahalıya, "" orijinal sıra. Bilinmeyen fiyatlılar (null) her zaman sonda. */
function sortCostRows(rows, mode) {
  const arr = rows.slice();
  if (!mode) return arr;
  const known = arr.filter((r) => r.total != null);
  const unknown = arr.filter((r) => r.total == null);
  known.sort((a, b) => (mode === "asc" ? a.total - b.total : b.total - a.total));
  return known.concat(unknown);
}

function renderGuide(g, idea) {
  stopAmbient();
  if (typeof idea === "string") currentIdea = idea;
  const aiTag = g.ai === true
    ? '<span class="diff-tag" data-level="AI" style="background:var(--teal-soft);color:var(--teal)">✨ AI Üretimi</span>'
    : '<span class="diff-tag" data-level="Demo" style="background:rgba(245,165,36,.15);color:#f5a524">📦 Demo Rehber</span>';

  const en = getLang() === "en";
  const qtyOverride = (() => { try { return JSON.parse(localStorage.getItem("arduinoDreamLab.costQty.v1")) || {}; } catch { return {}; } })();
  const cost = estimateCost(g, qtyOverride);
  const costQtyKey = "arduinoDreamLab.costQty.v1";
  const wireQtyInputs = () => {
    document.querySelectorAll(".qty-input").forEach((inp) => {
      inp.addEventListener("change", () => {
        try {
          const ov = JSON.parse(localStorage.getItem(costQtyKey)) || {};
          ov[inp.dataset.mat] = inp.value;
          localStorage.setItem(costQtyKey, JSON.stringify(ov));
        } catch {}
        renderGuide(g, undefined, { scroll: false });
      });
    });
  };
  const budget = loadBudget();
  const over = isOverBudget(cost.totalUSD);
  const costSortKey = "arduinoDreamLab.costSort.v1";
  const costSortMode = localStorage.getItem(costSortKey) || "";
  const displayRows = sortCostRows(cost.rows, costSortMode);
  const sortGlyph = costSortMode === "desc" ? "↓" : costSortMode === "asc" ? "↑" : "⇅";
  const materialsRows = displayRows.map((r) => {
    const purpose = esc((g.materials || []).find((m) => m.name === r.name)?.purpose || "");
    if (!r.known) {
      return `<tr class="cost-unknown"><td>${esc(r.name)}</td><td>${esc(r.qty)}</td><td class="cost-cell">—</td><td class="cost-cell">—</td><td>${purpose}</td></tr>`;
    }
    return `<tr><td>${esc(r.name)}${r.note === "özel" ? ` <span class="cost-note" title="${t("Öğretmen fiyatı")}">✏️</span>` : ` <span class="cost-note" title="${t("Ortalama perakende fiyatı")}">≈</span>`}</td><td><span class="qty-wrap"><button class="qty-btn" type="button" data-qdir="-1" data-mat="${esc(r.name)}" aria-label="−">−</button><input class="qty-input" type="text" inputmode="decimal" value="${esc(r.qty)}" data-mat="${esc(r.name)}" aria-label="${t("Adet")}" /><button class="qty-btn" type="button" data-qdir="1" data-mat="${esc(r.name)}" aria-label="+">+</button></span></td><td class="cost-cell">$${r.unit.toFixed(2)}</td><td class="cost-cell">$${r.total.toFixed(2)}</td><td>${purpose}</td></tr>`;
  }).join("");
  const totalRow = cost.rows.length ? `<tr class="cost-total${over ? " cost-over" : ""}"><td>${t("💰 Ortalama Proje Fiyatı")}</td><td></td><td class="cost-cell"></td><td class="cost-cell">${fmtTL(cost.totalUSD)}</td><td>${over ? `⚠️ ${t("Bütçe aşımı")} (${t("Sınır")}: ${fmtTL(budget)})<div class="cost-suggest">${budgetSuggestion(cost.totalUSD)}</div>` : cost.anyUnknown ? t("Bazı parçaların fiyatı katalogda yok") : ""}</td></tr>` : "";

  const wiringItems = (g.wiring || []).map((w) =>
    `<li><span class="wire-label">${esc(w.from)}</span><span>→ <strong>${esc(w.to)}</strong>${w.note ? ` <em style="color:var(--text-dim)">— ${esc(w.note)}</em>` : ""}</span></li>`
  ).join("");

  const skey = stepsKeyOf(g);
  const sdone = (i) => Boolean(stepsStore()[skey]?.[i]);
  const stepsItems = (g.steps || []).map((s, i) =>
    `<li class="step-item${sdone(i) ? " done" : ""}" data-step="${i}">` +
      `<input type="checkbox" class="step-check" data-step-check="${i}" aria-label="Adım ${i + 1} tamamlandı"${sdone(i) ? " checked" : ""}>` +
      `<strong class="st-title">${esc(s.title)}</strong><p>${esc(s.detail)}</p>${s.tip ? `<p class="sub">💡 ${esc(s.tip)}</p>` : ""}</li>`
  ).join("");

  const tipsItems = (g.tips || []).map((t) => `<li>${esc(t)}</li>`).join("");

  const codeId = "code_" + Math.random().toString(36).slice(2, 9);

  resultCard.innerHTML = `
    <h2>${esc(g.title)}</h2>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:1.25rem">
      <span class="diff-tag" data-level="${esc(g.difficulty)}">${esc(g.difficulty)}</span>
      ${aiTag}
    </div>
    <div class="summary-block">${esc(g.summary)}</div>

    <div class="guide-actions">
      <button class="btn btn-primary btn-small" data-act="pdf" type="button">${t("📄 PDF İndir")}</button>
      <button class="btn btn-ghost btn-small" data-act="share" type="button">${t("💬 WhatsApp'ta Paylaş")}</button>
      <button class="btn btn-ghost btn-small" data-act="cart" type="button">🛒 ${t("Alışveriş Listesi")}</button>
      <button class="btn btn-ghost btn-small" data-act="card" type="button">🖼️ ${t("Kart Oluştur")}</button>
      <button class="btn btn-ghost btn-small" data-act="save" type="button">${t("💾 Arşive Kaydet")}</button>
      <button class="btn btn-ghost btn-small wokwi-btn" data-act="wokwi" type="button">⚡ ${t("Wokwi'de Dene")}</button>
      <button class="btn btn-ghost btn-small" data-act="wokwi-zip" type="button">📦 ${t("Wokwi Paketi (.zip)")}</button>
      <button class="btn btn-ghost btn-small" data-act="speak" type="button">${t("🔊 Bana Anlat")}</button>
    </div>
    <div class="cert-row" id="certRow" hidden>
      <span class="cert-title">🎉 ${t("Tüm adımları tamamladın!")}</span>
      <span style="flex-basis:100%;font-size:0.9rem;color:var(--text-dim)">${t("Sertifikanı oluştur — adını yaz, PDF otomatik iner:")}</span>
      <input type="text" class="cert-name-input" id="certNameInput" maxlength="60" placeholder="${t("Adın")}" aria-label="${t("Adın")}" value="${esc(loadCertName())}" />
      <button class="btn btn-primary btn-small" data-act="cert" type="button">${t("🏅 Sertifika Oluştur")}</button>
    </div>

    <h3><span class="h3-icon">🧰</span> Malzeme Listesi</h3>
    <div class="table-wrap">
      <table class="materials-table">
        <thead><tr><th>${t("Parça")}</th><th>${t("Adet")}</th><th>${t("Birim Fiyat")}</th><th>${t("Tutar")} <button class="th-sort-btn" type="button" data-sort="cost" title="${t("Fiyata göre sırala")}" aria-label="${t("Fiyata göre sırala")}">${sortGlyph}</button></th><th>${t("Görevi")}</th></tr></thead>
        <tbody>${materialsRows}${totalRow}</tbody>
      </table>
    </div>

    <h3><span class="h3-icon">🔌</span> Devre Bağlantıları</h3>
    <ul class="wiring-list">${wiringItems}</ul>
    <div id="wokwiHelpSlot" hidden></div>
    <div class="diagram-wrap" id="diagramSlot" aria-label="Basitleştirilmiş bağlantı şeması"></div>
    <div class="diagram-legend" id="diagramLegend"></div>

    <h3><span class="h3-icon">🛠️</span> Adım Adım Yapım</h3>
    <ol class="steps-list">${stepsItems}</ol>
    <div class="progress-box">
      <div class="progress-track"><div class="progress-fill"></div></div>
      <div class="progress-label"></div>
    </div>
    <div class="cert-row" id="submitRow" hidden>
      <span class="cert-title">📤 ${t("Adımlarını öğretmenine gönder")}</span>
      <input type="text" id="submitNameInput" maxlength="60" placeholder="${t("Adın")}" aria-label="${t("Adın")}" />
      <button class="btn btn-primary btn-small" id="submitToClass" type="button">${t("📋 Gönderim Dosyası İndir")}</button>
      <button class="btn btn-ghost btn-small" id="fbOpenBtn" type="button">💬 ${t("Geri Bildirimi Göster")}</button>
    </div>

    <h3><span class="h3-icon">💡</span> İpuçları &amp; Güvenlik</h3>
    <div class="tips-box"><ul>${tipsItems}</ul></div>

    ${(g.advanced || []).length ? `<details class="advanced-box"><summary>${t("🚀 İleri Seviye")} <span class="adv-count">(${(g.advanced || []).length})</span></summary>` +
      (g.advanced || []).map((a) => `
        <div class="adv-item">
          <h4>${esc(a.title || "")}</h4>
          <p>${esc(a.detail || "")}</p>
          ${(a.wiring || []).length ? `<div class="adv-wiring">${(a.wiring || []).map((w) => `<div class="adv-wrow"><span class="adv-from">${esc(w.from || "")}</span><span class="adv-arrow">→</span><span class="adv-to">${esc(w.to || "")}</span>${w.note ? `<span class="adv-note">${esc(w.note)}</span>` : ""}</div>`).join("")}</div>` : ""}
          ${a.code ? `<pre class="adv-code">${esc(a.code)}</pre>` : ""}
          ${a.tip ? `<p class="adv-tip">💡 ${esc(a.tip)}</p>` : ""}
        </div>`).join("") + `</details>` : ""}

    <h3><span class="h3-icon">💻</span> Arduino Kodu</h3>
    <div class="code-head">
      <span>sketch.ino</span>
      <span style="display:flex;gap:.4rem">
        <button class="btn btn-ghost btn-small" data-act="wokwi-diagram" type="button">🧩 ${t("Wokwi Devre Taslağı")}</button>
        <button class="btn btn-ghost btn-small" data-copy="${codeId}" type="button">${t("📋 Kopyala")}</button>
      </span>
    </div>
    <pre class="code-block"><code id="${codeId}">${highlightArduino(g.code || "// Kod üretilemedi")}</code></pre>

    <div class="regenerate-row">
      <button class="btn btn-primary" onclick="window.scrollTo({top:0,behavior:'smooth'}); setTimeout(()=>document.getElementById('ideaInput').focus(),600)"      type="button">${t("🔄 Yeni Fikir Dene")}</button>
    </div>
  `;

  // Fiyata göre sıralama düğmesi: desc → asc → orijinal döngüsü (v2.13.0)
  const costSortBtn = resultCard.querySelector("[data-sort='cost']");
  if (costSortBtn) costSortBtn.addEventListener("click", () => {
    const cur = localStorage.getItem(costSortKey) || "";
    const next = cur === "desc" ? "asc" : cur === "asc" ? "" : "desc";
    if (!next) localStorage.removeItem(costSortKey);
    else localStorage.setItem(costSortKey, next);
    renderGuide(g, undefined, { scroll: false });
  });

  resultCard.querySelector(`[data-copy="${codeId}"]`).addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(g.code || "");
      btn.textContent = t("✅ Kopyalandı!");
    } catch {
      btn.textContent = t("❌ Kopyalanamadı");
    }
    setTimeout(() => { btn.textContent = t("📋 Kopyala"); }, 2000);
  });

  // Canlı adet düzenleyici: +/− düğmeleri ve input değişimi tabloyu anında günceller (v2.11.0)
  wireQtyInputs();
  resultCard.querySelectorAll(".qty-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const inp = resultCard.querySelector(`.qty-input[data-mat="${CSS.escape(b.dataset.mat)}"]`);
      if (!inp) return;
      const cur = parseFloat(String(inp.value).replace(",", ".")) || 0;
      const nv = Math.max(0, Math.round((cur + Number(b.dataset.qdir)) * 100) / 100);
      inp.value = String(nv);
      inp.dispatchEvent(new Event("change"));
    });
  });

  renderDiagram(g);
  wireGuideActions(g);
  saveToArchive(g, currentIdea);
  initStepTracking(g);

  scrollToResults();
}

/* ───────────────────── Devre Şeması (SVG) ───────────────────── */
function diagramSideOf(text) {
  const s = String(text).toUpperCase();
  if (/\bSDA\b|\bSCL\b|\bD\d{1,2}\b|PWM|SERIAL|\bRX\b|\bTX\b/.test(s)) return "digital";
  if (/\bA\d\b/.test(s)) return "analog";
  if (/\(\+\)|5V|3\.?3V|VIN|VCC|\bNO\b|\bCOM\b|POZİTİF|POZITIF/.test(s)) return "power";
  if (/GND|KATOT|TOPRAK|\(−\)|−/.test(s)) return "gnd";
  return "digital";
}

function diagramLeftLabel(from) {
  const s = String(from);
  const m = s.match(/\b(SDA|SCL|GND|5V|3V3|3\.3V|VIN|VCC|OUT|NO|COM|NC|DATA|AO|DO|ENA|ENB|IN[1-4]|TRIG|ECHO)\b/i);
  if (m) return m[1].toUpperCase();
  const first = s.split(/[—–\-/]/)[0].trim();
  return (first || "BAĞLANTI").slice(0, 14);
}

function diagramPinLabel(from, to) {
  const hay = String(to) + " " + String(from);
  let m = hay.match(/\b([DA]\d{1,2})\b/);
  if (m) return m[1].toUpperCase();
  m = hay.match(/\b(SDA|SCL)\b/i); if (m) return m[1].toUpperCase();
  m = hay.match(/\b(5V|3V3|3\.3V|VIN)\b/i); if (m) return m[1].toUpperCase().replace("3.3V", "3V3");
  m = hay.match(/\bGND\b/i); if (m) return "GND";
  m = hay.match(/\b(NO|COM|NC)\b/i); if (m) return m[1].toUpperCase();
  return "PIN";
}

function arduinoSVG(wiring) {
  const COLORS = { digital: "#00d1b2", power: "#ff8a3d", gnd: "#94a3b8", analog: "#7dd3fc" };
  const all = (wiring || [])
    .map((c) => ({ from: String(c.from || "").trim(), to: String(c.to || "").trim() }))
    .filter((c) => c.from && c.to);
  if (!all.length) return "";
  const overflow = all.length > 14;
  const conns = all.slice(0, 14);

  const rows = conns.map((c) => {
    const side = diagramSideOf(c.from + " " + c.to);
    return { ...c, side, color: COLORS[side], pin: diagramPinLabel(c.from, c.to), left: side === "digital" || side === "analog" };
  });

  const W = 760, BX = 180, BW = 400, ROW = 46, BT = 84;
  const leftRows = rows.filter((r) => r.left);
  const rightRows = rows.filter((r) => !r.left);
  const maxCol = Math.max(leftRows.length, rightRows.length, 1);
  const boardH = maxCol * ROW + 60;
  const BB = BT + boardH;
  const headY = BB + 66;
  const H = headY + 44;

  leftRows.forEach((r, i) => { r.y = BT + 34 + i * ROW; });
  rightRows.forEach((r, i) => { r.y = BT + 34 + i * ROW; });

  const wrap2 = (s, n) => {
    s = String(s);
    if (s.length <= n) return [s];
    const rest = s.slice(n);
    return [s.slice(0, n), rest.length > n ? rest.slice(0, n - 1) + "…" : rest];
  };

  const parts = [];
  // Kart gövdesi
  const dark = getTheme() === "dark";
  const C = dark
    ? { bg: "#0d1526", board: "#101a30", chip: "#141d31", chipBox: "#1a2440", label: "#c7d2ee", dim: "#7787ab", brand: "#5b6b8f", sub: "#3b4a6b", pinTxt: "#9aa7c7", pinBg: "#0b1120" }
    : { bg: "#ffffff", board: "#e9eef7", chip: "#dfe7f2", chipBox: "#d3deec", label: "#2a3a5c", dim: "#64748b", brand: "#64748b", sub: "#94a3b8", pinTxt: "#475569", pinBg: "#f8fafc" };
  parts.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Basitleştirilmiş bağlantı şeması">`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="14" fill="${C.bg}"/>`);
  parts.push(`<text x="20" y="34" font-size="14" font-weight="700" fill="${C.label}">⚡ Bağlantı Şeması</text>`);
  parts.push(`<text x="20" y="52" font-size="11" fill="${C.dim}">Renkler kablo grubunu gösterir — yerleşim temsilidir.</text>`);
  if (overflow) parts.push(`<text x="${W - 20}" y="34" text-anchor="end" font-size="11" fill="#f5a524">+${all.length - conns.length} bağlantı listelenmedi</text>`);

  // Kart gövdesi
  parts.push(`<rect x="${BX}" y="${BT}" width="${BW}" height="${boardH}" rx="12" fill="${C.board}" stroke="#26314f" stroke-width="2"/>`);
  parts.push(`<rect x="${BX + 18}" y="${BT + 12}" width="52" height="14" rx="3" fill="${C.chipBox}" stroke="#26314f"/>`);
  parts.push(`<text x="${BX + BW / 2}" y="${BT + 24}" text-anchor="middle" font-size="13" font-weight="700" fill="${C.brand}" font-family="monospace">ARDUINO UNO</text>`);
  parts.push(`<rect x="${BX + BW / 2 - 60}" y="${BT + boardH / 2 - 16}" width="120" height="32" rx="4" fill="${C.chip}" stroke="#26314f"/>`);
  parts.push(`<circle cx="${BX + BW / 2 - 48}" cy="${BT + boardH / 2}" r="4" fill="#26314f"/>`);
  parts.push(`<text x="${BX + BW / 2}" y="${BT + boardH / 2 + 4}" text-anchor="middle" font-size="11" fill="${C.sub}" font-family="monospace">ATmega328P</text>`);

  // Bağlantı satırları
  rows.forEach((r) => {
    const ry = r.y;
    const linesF = wrap2(r.from, 20);
    const lineT = wrap2(r.to, 20)[0];
    if (r.left) {
      linesF.forEach((ln, k) => parts.push(`<text x="18" y="${ry - 4 + k * 14}" font-size="12" fill="${C.label}">${esc(ln)}</text>`));
      parts.push(`<text x="18" y="${ry - 4 + linesF.length * 14}" font-size="11" fill="${C.dim}">${esc("→ " + lineT)}</text>`);
      parts.push(`<circle cx="126" cy="${ry}" r="3" fill="${r.color}"/>`);
      parts.push(`<line x1="126" y1="${ry}" x2="156" y2="${ry}" stroke="${r.color}" stroke-width="2.5"/>`);
      parts.push(`<rect x="156" y="${ry - 10}" width="48" height="20" rx="5" fill="${C.pinBg}" stroke="${r.color}" stroke-width="1.5"/>`);
      parts.push(`<text x="180" y="${ry + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="${r.color}" font-family="monospace">${esc(r.pin)}</text>`);
    } else {
      linesF.forEach((ln, k) => parts.push(`<text x="742" y="${ry - 4 + k * 14}" text-anchor="end" font-size="12" fill="${C.label}">${esc(ln)}</text>`));
      parts.push(`<text x="742" y="${ry - 4 + linesF.length * 14}" text-anchor="end" font-size="11" fill="${C.dim}">${esc(lineT + " ←")}</text>`);
      parts.push(`<circle cx="634" cy="${ry}" r="3" fill="${r.color}"/>`);
      parts.push(`<line x1="634" y1="${ry}" x2="604" y2="${ry}" stroke="${r.color}" stroke-width="2.5"/>`);
      parts.push(`<rect x="556" y="${ry - 10}" width="48" height="20" rx="5" fill="${C.pinBg}" stroke="${r.color}" stroke-width="1.5"/>`);
      parts.push(`<text x="580" y="${ry + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="${r.color}" font-family="monospace">${esc(r.pin)}</text>`);
    }
  });

  // Alt pin başlığı ve noktalı bağlantılar
  const pinMap = new Map();
  rows.forEach((r) => {
    if (!pinMap.has(r.pin)) pinMap.set(r.pin, { label: r.pin, color: r.color, count: 0 });
    pinMap.get(r.pin).count++;
  });
  const pins = [...pinMap.values()];
  const x0 = 110, x1 = W - 110;
  pins.forEach((p, i) => {
    p.x = pins.length === 1 ? W / 2 : x0 + (x1 - x0) * (i / (pins.length - 1));
  });
  rows.forEach((r) => {
    const p = pinMap.get(r.pin);
    const cx = r.left ? BX : BX + BW;
    parts.push(`<path d="M ${cx} ${BB + 8} C ${cx} ${BB + 40}, ${p.x} ${headY - 44}, ${p.x} ${headY - 15}" fill="none" stroke="${r.color}" stroke-width="1.5" stroke-dasharray="3 4" opacity="0.5"/>`);
  });
  pins.forEach((p) => {
    parts.push(`<circle cx="${p.x}" cy="${headY - 6}" r="5" fill="${p.color}"/>`);
    parts.push(`<text x="${p.x}" y="${headY + 14}" text-anchor="middle" font-size="10" fill="${C.pinTxt}" font-family="monospace">${esc(p.label)}${p.count > 1 ? " ×" + p.count : ""}</text>`);
  });

  parts.push(`</svg>`);
  return parts.join("");
}

function renderDiagram(g) {
  const slot = $("diagramSlot");
  const legend = $("diagramLegend");
  if (!slot) return;
  try {
    const svg = arduinoSVG(g.wiring || []);
    if (!svg) {
      slot.innerHTML = '<div class="empty-state"><span class="big">🔌</span><p>Bu rehber için şema verisi yok.</p></div>';
      legend.innerHTML = "";
      return;
    }
    slot.innerHTML = svg;
    legend.innerHTML = `
      <span class="key"><span class="swatch" style="background:#00d1b2"></span>Dijital pin</span>
      <span class="key"><span class="swatch" style="background:#ff8a3d"></span>Güç (5V / 3.3V)</span>
      <span class="key"><span class="swatch" style="background:#94a3b8"></span>GND</span>
      <span class="key"><span class="swatch" style="background:#7dd3fc"></span>Analog pin</span>`;
  } catch (e) {
    console.warn("Şema oluşturulamadı:", e);
  }
}

/* ── v2.20.0: CSV tarih filtresi + arşiv meta + göz serbest okuma yardımcıları ── */
const CSV_RANGE_KEY = "arduinoDreamLab.csvRange.v1";
function loadCsvRange() {
  try { const r = JSON.parse(localStorage.getItem(CSV_RANGE_KEY)) || {}; return { from: String(r.from || ""), to: String(r.to || "") }; }
  catch { return { from: "", to: "" }; }
}
function saveCsvRange(r) {
  try { localStorage.setItem(CSV_RANGE_KEY, JSON.stringify({ from: String(r.from || ""), to: String(r.to || "") })); } catch {}
}
/* Gönderileri tarih aralığına göre süzer: ISO gün dizesi (YYYY-MM-DD) karşılaştırması.
   ts → yerel gün (UTC değil; öğretmenin saat dilimi anlamlı). Aralık boşsa tümü. */
function filterSubsByRange(subs, from, to) {
  const f = String(from || "").slice(0, 10);
  const t2 = String(to || "").slice(0, 10);
  if (!f && !t2) return subs;
  return (subs || []).filter((s) => {
    const ts = Number(s.ts) || 0;
    if (!ts) return false;
    const d = new Date(ts);
    const day = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    if (f && day < f) return false;
    if (t2 && day > t2) return false;
    return true;
  });
}
/* Arşiv öğesinin favori/etiketlerini oku-yaz (eski yedeklerle uyumlu: alan yoksa varsayılan) */
function archiveMeta(item) {
  const m = item && item.meta ? item.meta : {};
  return { fav: !!m.fav, tags: Array.isArray(m.tags) ? m.tags.map((x) => String(x)).filter(Boolean).slice(0, 5) : [] };
}
function setArchiveMeta(id, patch) {
  const list = loadArchive();
  const it = list.find((x) => String(x.id) === String(id));
  if (!it) return;
  const cur = archiveMeta(it);
  const next = { fav: patch.fav === undefined ? cur.fav : !!patch.fav, tags: patch.tags === undefined ? cur.tags : patch.tags.map((x) => String(x).trim()).filter(Boolean).slice(0, 5) };
  it.meta = next;
  writeArchive(list);
}
/* v2.21.0: Arşiv arama — başlık, fikir ve etiketlerde Türkçe harf duyarsız (foldTR) süzme */
function filterArchiveItems(list, q) {
  const needle = foldTR(String(q || "").trim());
  if (!needle) return list || [];
  return (list || []).filter((item) => {
    const gg = (item && item.guide) || {};
    const meta = archiveMeta(item);
    const hay = foldTR([gg.title || "", item.idea || "", meta.tags.join(" ")].join(" "));
    return hay.includes(needle);
  });
}

/* Göz serbest modu: adımları kuyruğa alıp sırayla okur; biten adım otomatik işaretlenir.
   settings const'ı yükleme anında okunduğu için işaretlemeyi localStorage'a doğrudan yazar. */
function buildAmbientPlan(g) {
  const en = getLang() === "en";
  return (g.steps || []).map((s, i) => ({
    i,
    title: s.title || (en ? "Step " + (i + 1) : "Adım " + (i + 1)),
    detail: String(s.detail || ""),
    text: (en ? "Step " : "Adım ") + (i + 1) + ". " + (s.title || "") + ". " + String(s.detail || "")
  }));
}
function nextAmbientStep(g, idx) {
  let done = {};
  try { done = stepsStore()[stepsKeyOf(g)] || {}; } catch {}
  const total = (g.steps || []).length;
  for (let i = idx; i < total; i++) if (!done[i]) return i;
  return -1;
}
function markAmbientStep(g, idx) {
  const store = stepsStore();
  const key = stepsKeyOf(g);
  if (!store[key] || typeof store[key] !== "object") store[key] = {};
  store[key][idx] = Date.now();
  localStorage.setItem(STEPS_KEY, JSON.stringify(store));
}
function stopAmbient() {
  try { clearTimeout(ambientTimer); } catch {}
  ambientTimer = null;
}

/* ───────────────────── Rehber Eylemleri (PDF / Paylaş / Arşiv) ───────────────────── */
let ambientTimer = null;
function speakText(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = getLang() === "en" ? "en-US" : "tr-TR";
    u.rate = 0.98;
    synth.speak(u);
    return true;
  } catch { return false; }
}
function stopSpeaking() {
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {}
}

/* ─ Wokwi diagram.json yardımcıları: rehberdeki wiring satırlarından gerçek kablolar üret ─ */
function foldTR(s) {
  return String(s).toUpperCase().replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C");
}
function wokwiConnections(g, parts, pinWords, hintIds) {
  const ids = new Set(parts.map((p) => p.id));
  const PW = pinWords || {};
  const HI = hintIds || {};
  const low = (s) => foldTR(String(s));
  const squeeze = (s) => low(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  const wordToPin = (token) => {
    const wl = squeeze(token);
    if (!wl) return null;
    for (const key of Object.keys(PW)) {
      const map = PW[key];
      for (const w of Object.keys(map)) {
        if (squeeze(w) === wl) return map[w];
      }
    }
    return null;
  };
  const hintOwnerId = (token) => {
    const t2 = squeeze(token);
    if (!t2) return null;
    for (const key of Object.keys(HI)) {
      const kid = squeeze(key);
      if (kid && t2.includes(kid)) return HI[key];
    }
    return null;
  };
  // Arduino tarafı pin eşlemesi (Wokwi uno pin adları)
  const unoPinOf = (text, hint) => {
    const s = foldTR(text).replace(/[\s_()]/g, "").replace(/^P(I)?N/, "").replace(/^ARDUINO/, "");
    // "D13(220Ω ile)" / "D5PWM" gibi son ekleri at
    const stripped = s.replace(/(220|330|1K|10K|4K7|OHM|Ω|PWM|ILE|RESISTOR|DIRENC).*$/, "");
    const candidates = [s, stripped];
    for (const cand of candidates) {
      if (/^A[0-5]$/.test(cand)) return cand;
      if (/^(3\.3V|3V3|3,3V)$/.test(cand)) return "3.3V";
      if (/^(\+?5V|VCC|V\+|VIN)$/.test(cand)) return "5V";
      if (/^GND/.test(cand)) {
        const fixed = cand.match(/GND\.([123])$/);
        if (fixed) return "GND." + fixed[1];
        return hint && /^GND\.[123]$/.test(hint) ? hint : "GND.1";
      }
      const d = cand.match(/^D?(\d{1,2})$/);
      if (d) {
        const n = Number(d[1]);
        if (n >= 0 && n <= 13) return (n === 11 || n === 10 || n === 9 || n === 6 || n === 5 || n === 3 ? "~" : "") + n;
      }
    }
    return null;
  };

  // Parça türü tahmini (sıralı — önce özel, sonra genel)
  const KINDS = [
    ["hbridge", /L293|L298|SURUCU|DRIVER|KOPRU/],
    ["rgb", /RGB/],
    ["led", /\bLED/],
    ["bz", /\bBUZZER\b|\bBIP\b/],
    ["dht", /DHT/],
    ["ultrasonic", /HC-?SR04|ULTRASON/],
    ["servo", /SERVO/],
    ["lcd", /LCD|EKRAN/],
    ["pir", /\bPIR\b|HAREKET/],
    ["motor", /MOTOR/],
    ["röle", /ROLE|RELAY/],
    ["btn", /BUTON|BUTTON|\bTUS\b|SWITCH|ANAHTAR/],
    ["pot", /\bPOT\b|POTANSIYOMETRE/],
    ["ldr", /\bLDR\b|FOTOREZIST|FOTOGRAF|\bISIK\b/],
    ["sensor", /SENSOR|MODUL|MODULE/]
  ];
  const idOf = (kind) => (kind === "bz" ? "bz1" : kind === "ultrasonic" ? "ultrasonic1" : kind === "röle" ? "röle1" : kind + "1");
  /* Türden parça kimliği: standart id yoksa hint/kütüphane kimliğine bak (ör. röle → röleA) */
  const kindIdOf = (kind) => {
    const std = idOf(kind);
    if (ids.has(std)) return std;
    const k = low(kind);
    for (const key of Object.keys(HI)) {
      if (low(key) === k) {
        const hid = HI[key];
        if (hid && ids.has(hid)) return hid;
      }
    }
    return null;
  };

  const partOf = (text, rowKindOverride) => {
    const s = foldTR(text);
    // Çoklu örnek parçalar (LED1/LED2…, OLED…): token kendi hint sahibini taşıyorsa
    // doğrudan o parçaya bağlan — genel tür kimliğine (led1) değil. Pin, sahip parçanın
    // kendi pin sözlüğünden kelime-bazlı çözülür (OLED GND → oled1:GND); bulunamazsa
    // satır türü varsayılanına düş. rowKindOverride null olabilir ("OLED VCC" gibi
    // hiçbir tür regex'ine uymayan satırlar) — bu yüzden koşula bağlanmaz.
    {
      const oid = hintOwnerId(text);
      if (oid && ids.has(oid)) {
        let pin = null;
        // Token'ı KELİMELERİNE ayırıp sahip parçanın pin sözlüğüyle birebir eşleştir
        // (substring değil: "katot" içindeki 'a', A pini sanılmamalı)
        const words = String(text).split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => squeeze(w)); // squeeze zaten lower + TR fold uygular
        for (const k of Object.keys(HI)) {
          if (HI[k] !== oid) continue;
          const ksq = squeeze(k);
          const omap = PW[k];
          if (!omap) continue;
          for (const w of words) {
            if (!w) continue;
            if (ksq === w || (w.length >= 3 && (ksq.includes(w) || w.includes(ksq)))) continue; // sahip adının kendi kelimesi
            // Map key'leri doğrudan değil squeeze-eşleşmeli (hint map'leri büyük/küçük harf karışık saklanır)
            let val = null;
            for (const mk of Object.keys(omap)) {
              if (squeeze(mk) === w) { val = omap[mk]; break; }
            }
            if (val) { pin = val; break; }
          }
          if (pin) break;
        }
        if (pin) return { id: oid, pin };
        // Pin çözülemedi — token saf parça adı olabilir ya da pin tür varsayılanıyla alınmalı.
        // Sahip parçaya bağlan (pin: tür varsayılanı); null dönmek tryOwnerPin'e kaçar ve
        // satır sahibi yerine İLK eşleşen parçaya (led1) yanlış bağlantı üretir.
        return { id: oid, pin: (rowKindOverride ? wokwiCompPinOf(rowKindOverride, text) : null) || "1" };
      }
    }
    // Satırda başka bir parça adı geçiyorsa (ör. "Pompa (+) → Röle NO") bu satırın asıl
    // parçası odur; kısa satırlarda tek başına geçen "LED/pompa" kelimesi yanlış parçaya
    // bağlanmasın — owner-override: satırın gerçek parçasına yönlendir.
    const kinds = rowKindOverride ? KINDS.filter(([k]) => k === rowKindOverride) : KINDS;
    for (const [kind, re] of kinds) {
      // Satır türü zaten belirlendiyse regex'i token'da aramak yanlış sonuç verir
      // ("VCC" tek başına /LCD|EKRAN/'i geçemez ama LCD satırına aittir).
      if (!rowKindOverride && !re.test(s)) continue;
      // Çıplak rakam (buton bacağı, LDR pin no): pozisyona göre tryRowPin atar
      if (rowKindOverride && /^\d+$/.test(String(text).trim())) continue;
      const id = kindIdOf(kind);
      if (!id) return null;
      return { id, pin: wokwiCompPinOf(kind, text) };
    }
    return null;
  };

  const colorOf = (a, b) => {
    const s = foldTR(a) + " " + foldTR(b);
    if (/GND|TOPRAK|KATOT|CATHOD/.test(s)) return "black";
    if (/5V|VCC|V\+|VIN|3\.3V|POZITIF|\+/.test(s)) return "red";
    if (/SCL/.test(s)) return "purple";
    if (/SDA|DATA|VERI/.test(s)) return "blue";
    if (/A[0-5]|ANALOG/.test(s)) return "yellow";
    return "green";
  };
  const kindOf = (text) => {
    const s = foldTR(text);
    for (const [kind, re] of KINDS) if (re.test(s)) return kind;
    return null;
  };

  /* Çoklu bağlantı satırları: "DHT11 VCC / GND / DATA → 5V / GND / D2" gibi
     satırları ayraçlara böl, her belirteci çöz ve pozisyona göre eşleştir. */
  const splitSides = (s) => String(s)
    .split(/\s*(?:—|–|→|->|↔|ve|ile|and)\s*/i)
    .flatMap((part) => part.split(/\s*[/,]\s*/))
    .map((x) => x.trim())
    .filter(Boolean);
  // Parça tarafındaki çıplak rakam: satırdaki parçanın nolu pinidir (ör. "Buton 1 / 2" → btn1:1.l, btn1:2.l)
  const rowPinOf = (kind, token) => {
    const n = token.trim();
    if (kind === "btn") return n + ".l";
    if (kind === "hbridge") return n + "A";
    return n;
  };
  const resolveToken = (token, rowKind, hint, prefer, rowText, rowOwner) => {
    // Satırın ana parçasının pin sözlüğüyle doğrudan eşleşme (VCC/GND/SDA/A/bir…).
    // stripOwnerName sahibi söktüğü için ("LED2 anot (A)" → "anot (A)") pin kelimesi
    // token içinde KELİME bazında da aranır — aksi hâlde sahiplik kayılır, ilk eşleşen
    // parçaya (led1) yanlış bağlantı üretilir.
    const tryRowOwnerPin = () => {
      if (!rowOwner) return null;
      const tryMap = (wsq) => {
        if (!wsq) return null;
        for (const mk of Object.keys(rowOwner.pinMap)) {
          if (squeeze(mk) === wsq) return { id: rowOwner.id, pin: rowOwner.pinMap[mk] };
        }
        return null;
      };
      const full = tryMap(squeeze(token));
      if (full) return full;
      const words = String(token).split(/[^A-Za-z0-9]+/).filter(Boolean);
      for (const w of words) {
        const hit = tryMap(squeeze(w));
        if (hit) return hit;
      }
      return null;
    };
    const tryHintPin = () => {
      // Satır metninde adı geçen bir hint parçası bu pin kelimesine sahipse ÖNCE o parçaya bağla:
      // "OLED VCC / GND → 5V / GND" satırında VCC, satırdaki OLED parçasınındır —
      // kelime sırasına göre rastgele bir sensörün değil.
      if (rowText) {
        const rsq = squeeze(rowText);
        for (const key of Object.keys(HI)) {
          const kid = squeeze(key);
          if (!kid || kid.length < 3) continue;
          if (!rsq.includes(kid)) continue;
          const oid = HI[key];
          if (!oid || !ids.has(oid)) continue;
          const omap = PW[key];
          if (!omap) continue;
          for (const w of Object.keys(omap)) {
            if (squeeze(w) === squeeze(token)) return { id: oid, pin: omap[w] };
          }
        }
      }
      const hit = wordToPin(token);
      if (!hit) return null;
      // Hangi parçaya ait? token satırında geçen bir hint parçası bul
      const ownerId = hintOwnerId(token);
      if (ownerId && ids.has(ownerId)) return { id: ownerId, pin: hit };
      // Satırda parça yoksa: kelimenin ait olduğu parçayı bul
      // (PW anahtarları kelime, parça id'si HI[kelime] üzerinden alınır)
      const wl = squeeze(token);
      for (const key of Object.keys(PW)) {
        const map = PW[key];
        for (const w of Object.keys(map)) {
          if (squeeze(w) !== wl) continue;
          const owner = HI[key];
          if (owner && ids.has(owner)) return { id: owner, pin: map[w] };
        }
      }
      return null;
    };
    /* Çok kelimeli token: "Röle IN" → sahip parça (röleA) + kalan kelimeden pin (IN → IN) */
    const tryOwnerPin = () => {
      const owner = hintOwnerId(token);
      if (!owner || !ids.has(owner)) return null;
      const ownerKeys = Object.keys(HI).filter((k) => HI[k] === owner).map((k) => squeeze(k)).filter(Boolean);
      const words = low(token).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map((w) => squeeze(w));
      for (const w of words) {
        // Sahibin kendi adını atla (yalnızca 3+ harfli kelimeler — tek harf pin
        // kelimeleri "Display A" gibi sahibin adına gömülü pinleri yutmasın)
        if (ownerKeys.some((ok) => ok === w || (w.length >= 3 && (ok.includes(w) || w.includes(ok))))) continue;
        const pin = wordToPin(w);
        if (pin) return { id: owner, pin };
      }
      return null;
    };
    const tryUno = () => unoPinOf(token, hint);
    const tryPart = () => partOf(token, rowKind);
    const tryRow = () => {
      const k = rowKind ? kindIdOf(rowKind) : null;
      return k ? { id: k, pin: wokwiCompPinOf(rowKind, token) } : null;
    };
    const tryRowPin = () => {
      if (prefer !== "part" || !rowKind || !kindIdOf(rowKind) || !/^\d+$/.test(String(token).trim())) return null;
      return { id: kindIdOf(rowKind), pin: rowPinOf(rowKind, token) };
    };
    // Parça tarafındaki çıplak GND: satırdaki parçanın toprak bacağıdır (ör. "DHT11 VCC / GND / DATA → …")
    // kindIdOf bulamazsa satır metninden sahip parçayı tahmin et (ör. "IR sensör SOL VCC / GND" → irs1)
    const tryRowGnd = () => {
      if (prefer !== "part" || !/^GND/.test(foldTR(token).trim())) return null;
      let id = rowKind ? kindIdOf(rowKind) : null;
      if (!id && rowText) {
        const owner = hintOwnerId(rowText);
        if (owner && ids.has(owner)) id = owner;
      }
      return id ? { id, pin: wokwiCompPinOf(rowKind || "sensor", "GND") } : null;
    };
    const wrapUno = () => { const p = tryUno(); return p ? { id: "uno", pin: p } : null; };
    // L tarafı için: parça/kütüphane pin-sözlüğünde kelime varsa parçaya bağla (VCC → pot1:VCC gibi).
    // GND hariç: toprak satır-sahibi kuralıyla çözülür (tryRowGnd), rastgele parçaya değil.
    const tryHintPartPin = () => (/^GND/.test(foldTR(token).trim()) ? null : tryHintPin());
    return prefer === "part"
      ? (tryRowOwnerPin() || tryPart() || tryOwnerPin() || tryRowGnd() || tryRowPin() || tryHintPartPin() || wrapUno() || tryRow())
      : (tryOwnerPin() || wrapUno() || tryRow() || tryPart() || tryHintPin());
  };

  const conns = [];
  (g.wiring || []).slice(0, 40).forEach((w, i) => {
    const rowKind = kindOf(w.from + " " + w.to);
    const rowText = (w.from || "") + " " + (w.to || "");
    // Satırın ana parçası: metinde adı geçen ilk hint parçası ("OLED VCC → 5V" → oled1;
    // "LED2 A → D4" → led2). Pin token'leri bu parçaya bağlanır.
    let rowOwner = null;
    {
      const rsq = squeeze(rowText);
      for (const key of Object.keys(HI)) {
        const kid = squeeze(key);
        if (!kid || kid.length < 3) continue;
        if (!rsq.includes(kid)) continue;
        const id = HI[key];
        if (id && ids.has(id)) { rowOwner = { id, pinMap: PW[key] || {} }; break; }
      }
    }
    // Parça-adı token'leri pin taşımaz ama eşleşme slotu kapar — listeden çıkar.
    // splitSides boşlukla bölmediği için "OLED GND" gibi BİLEŞİK token'lar da gelir:
    // satır sahibiyle BAŞLAYAN token'in sahibi söküp kalan pin kısmını bırak.
    const isPureOwnerName = (tk) => {
      const sq = squeeze(tk);
      if (!sq) return false;
      for (const key of Object.keys(HI)) {
        if (squeeze(key) === sq) return true;
      }
      return false;
    };
    const stripOwnerName = (tk) => {
      const words = String(tk).split(/\s+/).filter(Boolean);
      if (words.length < 2) return tk;
      for (const key of Object.keys(HI)) {
        const kid = squeeze(key);
        if (kid && kid.length >= 3 && squeeze(words[0]) === kid) return words.slice(1).join(" ");
      }
      return tk;
    };
    const Lraw = splitSides(w.from).map(stripOwnerName).filter((t) => !isPureOwnerName(t));
    const Rraw = splitSides(w.to).map(stripOwnerName).filter((t) => !isPureOwnerName(t));
    const L = Lraw.map((tk, li) => resolveToken(tk, rowKind, "GND." + (li + 1), "part", rowText, rowOwner));
    const R = Rraw.map((tk, ri) => resolveToken(tk, rowKind, "GND." + (ri + 1), "uno", rowText, rowOwner));
    const n = Math.max(L.length, R.length);
    for (let j = 0; j < n; j++) {
      let a = L[j], b = R[j];
      if (!a || !b || a.id === b.id) continue;
      // uno↔uno GND çifti: satırdaki parçanın GND'sine yönlendir (ör. "GND → GND" satırı)
      if (a.id === "uno" && b.id === "uno" && rowKind && kindIdOf(rowKind) && /GND/.test(a.pin) && /GND/.test(b.pin)) {
        a = { id: kindIdOf(rowKind), pin: wokwiCompPinOf(rowKind, "GND") };
      }
      conns.push([a.id + ":" + a.pin, b.id + ":" + b.pin, colorOf(Lraw[j] || w.from, Rraw[j] || w.to), [], String(i)]);
    }
  });
  return conns;
}
function wokwiCompPinOf(kind, text) {
  const s = foldTR(text);
  const n = s.replace(/[\s_()]/g, "");
  const is = (re) => re.test(s), inz = (re) => re.test(n);
  switch (kind) {
    case "rgb":
      if (is(/\bR\b/) || inz(/KIRMIZI|RED/)) return "R";
      if (is(/\bG\b/) || inz(/YESIL|GREEN/)) return "G";
      if (is(/\bB\b/) || inz(/MAVI|BLUE/)) return "B";
      return "COM";
    case "led":
      return is(/\bA\b|\+/) || inz(/ANOT|ANOD|UZUN|POZITIF|AKTIF/) ? "A" : "C";
    case "bz": return is(/\+/) || inz(/POZITIF|UZUN/) || is(/\b1\b/) ? "1" : "2";
    case "dht": return inz(/GND|TOPRAK/) ? "GND" : inz(/SDA|DATA|VERI|SINYAL|SIGNAL/) ? "SDA" : inz(/\bNC\b/) ? "NC" : "VCC";
    case "ultrasonic": return inz(/TRIG|TETIK/) ? "TRIG" : inz(/ECHO|EKO/) ? "ECHO" : inz(/GND|TOPRAK/) ? "GND" : "VCC";
    case "servo": return inz(/GND|KAHVE|BROWN|TOPRAK/) ? "GND" : inz(/PWM|SINYAL|SIGNAL|TURUNCU|ORANGE|SARI/) ? "PWM" : "V+";
    case "lcd": return inz(/GND|TOPRAK/) ? "GND" : inz(/\bSCL\b/) ? "SCL" : inz(/SDA|DATA/) ? "SDA" : "VCC";
    case "pir": return inz(/\bOUT\b|CIKI|SINYAL|SIGNAL/) ? "OUT" : inz(/GND|TOPRAK/) ? "GND" : "VCC";
    case "motor": return is(/\b2\b/) || inz(/IKINCI/) || is(/\bB\b/) ? "2" : "1";
    case "sensor": return inz(/GND|TOPRAK/) ? "GND" : inz(/VCC|5V/) ? "VCC" : "AO";
    case "btn": return "1.l";
    case "pot": return inz(/GND|TOPRAK|UC1/) ? "GND" : inz(/VCC|5V|UC3/) ? "VCC" : "SIG";
    case "ldr": return inz(/GND|TOPRAK/) ? "GND" : inz(/VCC|5V/) ? "VCC" : inz(/AO|ANALOG|SIG|SINYAL/) ? "AO" : inz(/\bDO\b|DIJITAL/) ? "DO" : is(/\b2\b/) ? "2" : "1";
    case "hbridge": return inz(/\bEN\b|ENABLE/) ? "1,2EN" : "1A";
    case "röle": return inz(/GND|TOPRAK/) ? "GND" : inz(/VCC|5V/) ? "VCC" : is(/\bIN\b/) || inz(/GIRI|KONTROL|SINYAL/) ? "IN" : is(/\bNO\b/) || inz(/ACIK|NORM/) ? "NO" : is(/\bNC\b/) ? "NC" : "COM";
    default: return inz(/GND|TOPRAK/) ? "GND" : inz(/\bSCL\b/) ? "SCL" : inz(/SDA|DATA|OUT|SINYAL/) ? "SDA" : "VCC";
  }
}

function wokwiDiagram(g) {
  const mats = g.materials || [];
  const has = (kw) => mats.some((m) => String(m.name || "").toLowerCase().includes(kw));
  const parts = [{ type: "wokwi-arduino-uno", id: "uno", top: 0, left: 0, attrs: {} }];
  // RGB LED / OLED içeren projelerde ayrı bir düz LED parçası eklenmez (boşta parça kalmasın)
  if (has("led") && !has("rgb") && !has("oled")) parts.push({ type: "wokwi-led", id: "led1", top: -120, left: 150, attrs: { color: "red" } });
  if (has("dht")) parts.push({ type: "wokwi-dht22", id: "dht1", top: -140, left: -60, attrs: {} });
  if (has("hc-sr04") || has("ultrasonik")) parts.push({ type: "wokwi-hc-sr04", id: "ultrasonic1", top: -160, left: 260, attrs: {} });
  if (has("servo")) parts.push({ type: "wokwi-servo", id: "servo1", top: -130, left: -180, attrs: {} });
  if (has("buzzer") || has("bip")) parts.push({ type: "wokwi-buzzer", id: "bz1", top: -120, left: 30, attrs: { volume: "0.1" } });
  if (has("pir")) parts.push({ type: "wokwi-pir-motion-sensor", id: "pir1", top: -150, left: 380, attrs: {} });
  if (has("lcd")) parts.push({ type: "wokwi-lcd1602", id: "lcd1", top: -180, left: -60, attrs: { pins: "i2c" } });
  if (has("buton") || has("button") || has("tuş") || has("switch") || has("anahtar")) parts.push({ type: "wokwi-pushbutton", id: "btn1", top: -110, left: 300, attrs: { color: "blue" } });
  if (has("pot")) parts.push({ type: "wokwi-potentiometer", id: "pot1", top: -160, left: 150, attrs: {} });
  if (has("ldr") || has("fotorezist") || has("ışık")) parts.push({ type: "wokwi-photoresistor-sensor", id: "ldr1", top: -150, left: -200, attrs: {} });
  if (has("rgb")) parts.push({ type: "wokwi-rgb-led", id: "rgb1", top: -160, left: 30, attrs: {} });
  // Not: DC motor / L298N / toprak nem sensörü Wokwi'nin hazır parçası değildir —
  // bunlar için hayali parça eklenmez; potansiyometre tabanlı wokwiHints kullanılır.
  const d = { version: 1, author: "Arduino Rüya Atölyesi", editor: "https://wokwi.com", parts };
  libAppendParts(d, g);
  appendHints(d, g);
  const lib = libPinWords();
  d.connections = wokwiConnections(g, d.parts, Object.assign({}, lib.PW, d.__pinWords || {}), Object.assign({}, lib.HI, d.__hintIds || {}));
  return d;
}
/* Kütüphanedeki parçaları (malzeme listesinde adı geçen) diyagrama ekle + pin kelimelerini kaydet */
function libAppendParts(diagram, g) {
  const seen = new Set(diagram.parts.map((p) => p.id));
  const PW = diagram.__pinWords = diagram.__pinWords || {};
  const HI = diagram.__hintIds = diagram.__hintIds || {};
  // Hint'lerle açıkça üretilen parça tipleri kütüphane tekrarından muaf:
  // örn. rehberde OLED (wokwi-ssd1306) hint'i varken "ekran" kelimesi ikinci bir LCD eklemesin.
  const hintTypes = new Set(((g && g.wokwiHints) || []).map((h) => h && h.type).filter(Boolean));
  (g.materials || []).forEach((m) => {
    const comp = libWokwiMatch(m && m.name);
    if (!comp) return;
    if (hintTypes.has(comp.wokwi.type)) return; // hint zaten bu parçayı üretti
    // OLED/SSD1306 malzemesi "ekran" kelimesiyle LCD1602'ye yanlış eşleşmesin
    if (comp.wokwi.type === "wokwi-lcd1602" && /oled|ssd1306/i.test(String(m && m.name))) return;
    // Aynı tip parça zaten varsa ona bağlan (tekrar ekleme)
    const existing = diagram.parts.find((x) => x.type === comp.wokwi.type);
    const id = existing ? existing.id : (comp.wokwi.id || (String(comp.wokwi.type).replace("wokwi-", "").replace(/[^a-z0-9]/gi, "") + "1"));
    if (seen.has(id)) return;
    seen.add(id);
    if (!existing) {
      diagram.parts.push({ type: comp.wokwi.type, id, top: -170 - diagram.parts.length * 12, left: 40 + (diagram.parts.length % 6) * 130, attrs: Object.assign({}, comp.wokwi.attrs || {}) });
    }
    const map = {};
    Object.keys(comp.wokwi.pinMap || {}).forEach((k) => { map[foldTR(k).toLowerCase()] = comp.wokwi.pinMap[k]; });
    const words = comp.name.split(/[\s/×]/).filter((w) => w.length >= 3);
    words.forEach((w) => { PW[foldTR(w).toLowerCase()] = map; HI[foldTR(w).toLowerCase()] = id; });
  });
}
/* AI'ın verdiği wokwiHints'i (varsa) diyagrama uygula:
   eşleşen parçalar eklenir/attrs birleştirilir, pin kelimeleri çözücüye kaydedilir. */
function appendHints(diagram, g) {
  const hints = Array.isArray(g && g.wokwiHints) ? g.wokwiHints : [];
  if (!hints.length) return diagram;
  const norm = (s) => foldTR(String(s)).replace(/[^A-Z0-9]/g, "");
  const low = (s) => foldTR(String(s));
  // 1) Parçaları ekle / birleştir
  const hintIds = {}; // match/part kelimesi → parça id
  // Parça no: aynı tipten birden fazla istek gelirse irs1, irs2… diye numaralanır
  const typeCount = {};
  const claimedTypes = {}; // type → ilk kullanılan parça id
  // Eşleşme samanı: malzeme adları + kablo satırları ("SOL/SAĞ" gibi yan kelimeleri malzeme
  // adı taşımadığı için kablo metni de taranır)
  const hay = norm((g.materials || []).map((m) => m && m.name || "").join(" ") + " " + JSON.stringify(g.wiring || []));
  hints.forEach((h) => {
    if (!h || !h.type || !/^wokwi-/.test(String(h.type))) return;
    const key = norm(h.match || h.part || "");
    if (!key) return;
    const hid = String(h.part || "").replace(/[^a-z0-9_-]/gi, "");
    // Önce açık id ile eşle; farklı part isteyen ikinci isteğe yeni örnek aç (çoklu parça)
    let p = diagram.parts.find((x) => x.id === hid);
    if (!p) {
      const sameType = diagram.parts.find((x) => x.type === h.type);
      const wantNew = hid && claimedTypes[h.type] && claimedTypes[h.type] !== hid;
      if (!sameType || wantNew) {
        if (!hay.includes(key)) return; // malzeme/kablo metninde yok — hayali parça ekleme
        typeCount[h.type] = (typeCount[h.type] || 0) + 1;
        const id = hid || (h.type.replace("wokwi-", "") + (typeCount[h.type] > 1 ? typeCount[h.type] : ""));
        p = { type: h.type, id, top: -170 - diagram.parts.length * 12, left: 40 + (diagram.parts.length % 6) * 130, attrs: {} };
        diagram.parts.push(p);
      } else p = sameType;
    }
    if (!claimedTypes[h.type]) claimedTypes[h.type] = p.id;
    if (h.attrs && typeof h.attrs === "object") p.attrs = Object.assign({}, p.attrs, h.attrs);
    if (h.match) hintIds[low(h.match)] = p.id;
    hintIds[low(h.part)] = p.id;
  });
  // 2) Pin kelimelerini çözücüye kaydet
  const pinWords = {};
  hints.forEach((h) => {
    if (!h || !h.part || !h.pins || typeof h.pins !== "object") return;
    const pinMap = {};
    Object.keys(h.pins).forEach((k) => { pinMap[low(k)] = String(h.pins[k]); });
    pinWords[low(h.part)] = pinMap;
    if (h.match) pinWords[low(h.match)] = pinMap;
  });
  diagram.__pinWords = pinWords;
  diagram.__hintIds = hintIds;
  return diagram;
}
/* Kütüphane verisinden wokwiHints benzeri pin-kelime sözlüğü ve parça kimlikleri üret */
function libWokwiMatch(text) {
  const s = foldTR(text);
  // Genel kelimeler parça eşleştirmede kullanılmaz: "DC motor" → "Servo Motor" gibi
  // yanlış pozitiflerin önüne geçer (spesifik kelime: servo, l298n, hc05…).
  const GENERIC = new Set(["motor", "sensor", "modul", "kit"]);
  for (const c of ALL_LIB()) {
    if (!c || !c.wokwi) continue;
    const words = c.name.split(/[\s/×]/).filter((w) => w.length >= 3 && /[A-Za-z0-9]/.test(w) && !GENERIC.has(foldTR(w).toLowerCase()));
    const hit = words.some((w) => s.includes(foldTR(w)));
    if (hit) return c;
  }
  return null;
}
function libPinWords() {
  const PW = {};
  const HI = {};
  ALL_LIB().forEach((c) => {
    if (!c || !c.wokwi) return;
    const id = c.wokwi.id || (String(c.wokwi.type).replace("wokwi-", "").replace(/[^a-z0-9]/gi, "") + "1");
    const map = {};
    Object.keys(c.wokwi.pinMap || {}).forEach((k) => { map[foldTR(k).toLowerCase()] = c.wokwi.pinMap[k]; });
    const words = c.name.split(/[\s/×]/).filter((w) => w.length >= 3);
    words.forEach((w) => { PW[foldTR(w).toLowerCase()] = map; HI[foldTR(w).toLowerCase()] = id; });
  });
  return { PW, HI };
}
function libHasPart(text) {
  const s = foldTR(text);
  return ALL_LIB().some((c) => {
    if (!c || !c.wokwi) return false;
    const words = c.name.split(/[\s/×]/).filter((w) => w.length >= 3 && /[A-Za-z0-9]/.test(w));
    return words.some((w) => s.includes(foldTR(w)));
  });
}
/* Wokwi çıktısı için özet: hangi wiring satırları kabloya dönüşemedi? */
function wokwiConnectionSummary(g, diagram) {
  const wiredRows = new Set(diagram.connections.map((c) => c[4]));
  const unmatched = [];
  (g.wiring || []).slice(0, 40).forEach((w, i) => {
    if (!wiredRows.has(String(i))) unmatched.push(`${w.from} → ${w.to}`);
  });
  return { unmatched };
}
/* Son wokwiValidate sonuçları (yardım kutusu bunları gösterir) */
let wokwiValidation = [];
/* Taslak doğrulaması: aynı pine iki kablo (çakışma) + eksik GND/5V besleme uyarıları.
   Wokwi'de tek pin deliğine birden fazla kablo takılamaz; bu yüzden çakışan pinler
   gerçek hayatta da hatalı kablolamaya işaret eder. */
function wokwiValidate(g, diagram) {
  const issues = [];
  const ends = (c) => [String(c[0]), String(c[1])];
  const unoGndSeen = new Set();
  const unoPwrSeen = new Set();
  // 1) Aynı pine iki kablo — GND/5V/3.3V rayları hariç (paylaşılan besleme rail'i)
  const pinUse = new Map();
  diagram.connections.forEach((c) => {
    ends(c).forEach((end) => {
      const colon = end.lastIndexOf(":");
      if (colon < 1) return;
      const id = end.slice(0, colon);
      const pin = end.slice(colon + 1);
      if ((id === "uno" || id === "arduinouno") && (pin === "5V" || pin === "3.3V" || /^GND/.test(pin))) return; // rail
      if (!pinUse.has(end)) pinUse.set(end, []);
      pinUse.get(end).push(c);
    });
  });
  pinUse.forEach((conns, end) => {
    if (conns.length > 1) {
      const rows = [...new Set(conns.map((c) => c[4]).filter(Boolean))];
      issues.push({ type: "pin-conflict", pin: end, rows });
    }
  });
  // 2) Besleme denetimi: her parçanın toprağa bir yolu olmalı.
  // Buton gibi pin adı "GND" olmayan parçalar da uno GND'sine bağlanıyorsa topraklı sayılır.
  const partNameOf = (id) => {
    const p = (diagram.parts || []).find((x) => x.id === id);
    if (!p || p.type === "wokwi-arduino-uno") return null;
    return p.id || p.type;
  };
  const grounded = new Set();
  const powered = new Set();
  const wired = new Map(); // parça id → görünen ad
  const isUnoGnd = (end) => /^(uno|arduinouno):GND/.test(end);
  const isUnoPwr = (end) => /^(uno|arduinouno):(5V|3\.3V)$/.test(end);
  diagram.connections.forEach((c) => {
    const [x, y] = ends(c);
    [[x, y], [y, x]].forEach(([a, b]) => {
      const colon = a.lastIndexOf(":");
      if (colon < 1) return;
      const id = a.slice(0, colon);
      const pin = a.slice(colon + 1);
      if ((id === "uno" || id === "arduinouno")) {
        if (/^GND/.test(pin)) unoGndSeen.add(pin);
        if (pin === "5V" || pin === "3.3V") unoPwrSeen.add(pin);
        return;
      }
      const name = partNameOf(id);
      if (!name) return;
      wired.set(id, name);
      if (/^GND/.test(pin)) grounded.add(id);
      if (pin === "VCC" || pin === "V+" || pin === "VIN" || pin === "5V" || pin === "3.3V") powered.add(id);
      if (isUnoGnd(b)) grounded.add(id);
      if (isUnoPwr(b)) powered.add(id);
    });
  });
  wired.forEach((name, id) => {
    if (!grounded.has(id)) issues.push({ type: "missing-gnd", part: id, name });
  });
  // 3) Uno tarafı: hiç GND kablosu yoksa / rehberde 5V varken hiç güç kablosu yoksa genel uyarı
  if (diagram.connections.length && !unoGndSeen.size) {
    issues.push({ type: "missing-gnd", part: "uno", name: "Arduino" });
  }
  const wiringHasPwr = (g.wiring || []).some((w) => /5V|VCC|V\+|VIN|3\.3/.test(foldTR((w.from || "") + " " + (w.to || ""))));
  if (diagram.connections.length && !unoPwrSeen.size && wiringHasPwr) {
    issues.push({ type: "missing-pwr", part: "uno", name: "Arduino" });
  }
  return issues;
}
/* Eşleşmeyen satırlar için rehber kartına öğretici yardım kutusu basar */
function showWokwiHelp(g, unmatched) {
  const slot = document.getElementById("wokwiHelpSlot");
  if (!slot) return;
  const en = getLang() === "en";
  const ex = en
    ? ['Good: "DHT11 VCC / GND / DATA → 5V / GND / D2"', 'Good: "LED A → D8"', 'Hard: "Röle modülünü D7\'ye bağla"']
    : ['İyi: "DHT11 VCC / GND / DATA → 5V / GND / D2"', 'İyi: "LED A → D8"', 'Zor: "Röle modülünü D7\'ye bağla"'];
  slot.innerHTML = `
    <div class="wokwi-help">
      <h4>${en ? "🧭 Why weren't some rows mapped?" : "🧭 Bazı satırlar neden eşleşmedi?"}</h4>
      <p>${en
        ? "The Wokwi generator reads wiring rows word by word. A row maps when it names the part and its pin (or an Arduino pin). These rows could not be parsed:"
        : "Wokwi üreticisi bağlantı satırlarını kelime kelime okur. Bir satır; parça adı + pin adı (veya Arduino pini) içeriyorsa kablo olur. Şu satırlar çözülemedi:"}
      </p>
      <ul>${unmatched.slice(0, 5).map((u) => `<li><code>${esc(u)}</code></li>`).join("")}</ul>
      <p>${en ? "Tips for writing mappable rows:" : "Eşleşecek şekilde yazma ipuçları:"}</p>
      <ul>
        <li>${en ? "Name the part + pin, separated by <code>/</code>: " : "Parça + pin adını <code>/</code> ile ayır: "}<code>${esc(ex[0])}</code></li>
        <li>${en ? "Use short pin labels (A, C, VCC, GND, DATA): " : "Kısa pin etiketleri kullan (A, C, VCC, GND, DATA): "}<code>${esc(ex[1])}</code></li>
        <li>${en ? "Pure sentences like " : '"' + "Röle modülünü D7'ye bağla" + '" gibi düz cümleler yerine: '}<code>${esc(en ? '"Relay IN → D7"' : '"Röle IN → D7"')}</code> ${en ? "work better." : "gibi yaz."}</li>
      </ul>
      <p class="field-hint">${en ? "The circuit still works — paste diagram.json and wire the rest by hand in Wokwi." : "Devre yine de kurulur — diagram.json'ı yapıştır, kalan kabloları Wokwi'de elle çek."}</p>
    </div>` + renderValidationIssues(unmatched.length);
  slot.hidden = false;
  slot.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
/* wokwiValidate bulgularını öğretici HTML kutusuna döker */
function renderValidationIssues(nUnmatched) {
  const en = getLang() === "en";
  if (!wokwiValidation || !wokwiValidation.length) {
    if (!nUnmatched) return "";
    return `<div class="wokwi-validate ok"><h4>${en ? "✅ Circuit check passed" : "✅ Devre kontrolü temiz"}</h4><p>${en ? "No pin conflicts, every part has ground and power." : "Pin çakışması yok, her parçanın toprak ve beslemesi var."}</p></div>`;
  }
  const item = (icon, text) => `<li>${icon} ${text}</li>`;
  const items = wokwiValidation.map((iss) => {
    if (iss.type === "pin-conflict") {
      const rowsTxt = (iss.rows || []).map((r) => `#${Number(r) + 1}`).join(", ");
      return item("⚡", en
        ? `<strong>${esc(iss.pin)}</strong> receives ${iss.rows && iss.rows.length > 1 ? iss.rows.length + " wires" : "2 wires"} — one pin, one wire! (rows ${rowsTxt})`
        : `<strong>${esc(iss.pin)}</strong> pinine ${iss.rows && iss.rows.length > 1 ? iss.rows.length + " kablo" : "2 kablo"} bağlanmış — tek pine tek kablo! (satır ${rowsTxt})`);
    }
    if (iss.type === "missing-gnd") {
      return item("⏚", en
        ? `<strong>${esc(iss.name)}</strong> has no GND wire — every part needs a path to ground.`
        : `<strong>${esc(iss.name)}</strong> parçasının GND kablosu yok — her parçanın toprağa yolu olmalı.`);
    }
    if (iss.type === "missing-pwr") {
      return item("🔌", en
        ? "No 5V wire even though the guide mentions power — check the supply lines."
        : "Rehberde besleme geçtiği hâlde hiç 5V kablosu yok — güç hatlarını kontrol et.");
    }
    return item("ℹ️", esc(JSON.stringify(iss)));
  });
  return `<div class="wokwi-validate"><h4>${en ? "🔎 Circuit check:" : "🔎 Devre kontrolü:"} ${wokwiValidation.length} ${en ? (wokwiValidation.length > 1 ? "warnings" : "warning") : (wokwiValidation.length > 1 ? "uyarı" : "uyarı")}</h4><ul>${items.join("")}</ul><p class="field-hint">${en ? "In Wokwi one pin hole accepts a single wire — use the breadboard rails to share GND/5V." : "Wokwi'de tek pin deliğine tek kablo takılır — GND/5V'ü paylaşmak için breadboard raylarını kullan."}</p></div>`;
}
function openWokwi() {
  const g = currentGuide;
  if (!g) return;
  const en = getLang() === "en";
  const code = Array.isArray(g.code) ? g.code.join("\n") : String(g.code || "");
  /* Şemayı da hazırla: tüm bağlantı satırları çözüldüyse diagram.json bloğunu koda ekle */
  let diagTxt = "";
  try {
    const d = wokwiDiagram(g);
    if (d && Array.isArray(d.parts) && d.parts.length > 1 && Array.isArray(d.connections)) {
      const sum = wokwiConnectionSummary(g, d);
      if (!sum || !sum.unmatched || !sum.unmatched.length) diagTxt = JSON.stringify(d, null, 2);
    }
  } catch (e) { /* şema üretilemezse yalnızca kod kopyalanır */ }
  const text = diagTxt ? code + "\n\n/*──── diagram.json ────\n" + diagTxt + "\n────*/" : code;
  navigator.clipboard.writeText(text).then(() => {
    showError(
      (en ? "⚡ Copied: sketch code" + (diagTxt ? " + diagram.json" : "") + "! " : "⚡ Kopyalandı: sketch kodu" + (diagTxt ? " + diagram.json" : "") + "! ") +
      (en
        ? "1) Wokwi will open in a new tab. 2) Paste everything into sketch.ino. 3) Open the diagram.json tab and replace its content with the diagram block at the end."
        : "1) Wokwi yeni sekmede açılacak. 2) Her şeyi sketch.ino'ya yapıştır. 3) diagram.json sekmesini aç, içeriği kopyaladığın metnin sonundaki diagram bloğuyla değiştir.")
    );
    errorBanner.classList.add("info");
    setTimeout(() => { errorBanner.classList.remove("info"); errorBanner.hidden = true; }, 12000);
    setTimeout(() => window.open("https://wokwi.com/projects/new/arduino-uno", "_blank", "noopener"), 400);
  }).catch(() => {
    showError(t("❌ Kod panoya kopyalanamadı — Wokwi'ye elle yapıştır."));
  });
}

let currentGuide = null;
let currentIdea = "";

function wireGuideActions(g) {
  currentGuide = g;
  resultCard.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      if (act === "pdf") downloadPDF();
      else if (act === "share") shareWhatsApp();
      else if (act === "cart") shareShoppingList();
      else if (act === "card") {
        const ok = await shareCard(g);
        btn.textContent = ok ? t("✅ Kart hazır!") : t("❌ Kart oluşturulamadı");
        setTimeout(() => { btn.textContent = t("🖼️ ") + t("Kart Oluştur"); }, 2600);
      }
      else if (act === "save") {
        const ok = saveToArchive(g, currentIdea, true);
        btn.textContent = ok ? t("✅ Arşivde!") : t("ℹ️ Zaten arşivde");
        setTimeout(() => { btn.textContent = t("💾 Arşive Kaydet"); }, 2200);
      }
      else if (act === "wokwi") openWokwi();
      else if (act === "wokwi-zip") downloadWokwiZip();
      else if (act === "wokwi-diagram") {
        const d = wokwiDiagram(g);
        const sum = wokwiConnectionSummary(g, d);
        wokwiValidation = wokwiValidate(g, d);
        navigator.clipboard.writeText(JSON.stringify(d, null, 2)).then(() => {
          const en = getLang() === "en";
          let msg = (en ? "🧩 diagram.json copied! " : "🧩 diagram.json panoya kopyalandı! ") +
            (en ? `${d.parts.length} parts, ${d.connections.length} wires generated. ` : `${d.parts.length} parça, ${d.connections.length} kablo üretildi. `);
          if (sum.unmatched.length) {
            msg += en
              ? `⚠️ ${sum.unmatched.length} wiring row${sum.unmatched.length > 1 ? "s" : ""} not mapped — see the help box in the guide.`
              : `⚠️ ${sum.unmatched.length} bağlantı satırı eşleşmedi — rehberdeki yardım kutusuna bak.`;
            showWokwiHelp(g, sum.unmatched);
          }
          showError(msg);
          errorBanner.classList.add("info");
          setTimeout(() => { errorBanner.classList.remove("info"); errorBanner.hidden = true; }, 12000);
        }).catch(() => {
          showError(t("❌ Kopyalanamadı — panoya erişilemedi."));
        });
      }
      else if (act === "speak") {
        const synth = window.speechSynthesis;
        if (synth && synth.speaking) {
          stopSpeaking();
          stopAmbient();
          btn.textContent = t("🔊 Bana Anlat");
          btn.classList.remove("btn-handsfree");
          return;
        }
        /* v2.20.0: Göz serbest mod — tüm metni tek seferde değil, adım adım okur;
           her adımın sonunda 2 sn bekler, o adımı otomatik işaretler, sonrakine geçer. */
        const en = getLang() === "en";
        const steps = buildAmbientPlan(g);
        if (!steps.length) { showError(en ? "No steps to read." : "Okunacak adım yok."); return; }
        const startAt = nextAmbientStep(g, 0);
        const firstIdx = startAt === -1 ? 0 : startAt;
        const intro = [
          `${en ? "Project" : "Proje"}: ${g.title}. ${en ? "Level" : "Seviye"}: ${g.difficulty}.`,
          g.summary,
          `${en ? "Materials" : "Malzemeler"}: ${(g.materials || []).map((m) => `${m.name} ×${m.quantity}`).join("; ")}.`,
          `${en ? "Estimated project total" : "Ortalama proje fiyatı"}: ${fmtTL(estimateCost(g).totalUSD)}.`,
          firstIdx === 0 ? (en ? "Starting step 1." : "Adım 1 ile başlıyorum.") : (en ? `Resuming from step ${firstIdx + 1}.` : `Adım ${firstIdx + 1} devam ediyorum.`)
        ].filter(Boolean).join(" ");
        const ok = speakText(intro);
        if (!ok) { showError(en ? "Speech synthesis is not available in this browser." : "Bu tarayıcıda sesli anlatım desteklenmiyor."); return; }
        btn.textContent = t("👁️ Göz Serbest — Durdur");
        btn.classList.add("btn-handsfree");
        const boxes = [...resultCard.querySelectorAll("[data-step-check]")];
        const sayStep = (idx) => {
          const st = steps[idx];
          if (!st) return;
          speakText(st.text);
          const box = boxes[idx];
          if (box && !box.checked) {
            box.checked = true;
            const li = resultCard.querySelector(`.step-item[data-step="${idx}"]`);
            if (li) li.classList.add("done");
            markAmbientStep(g, idx);
            updateProgressBar();
          }
          if (idx + 1 < steps.length) {
            ambientTimer = setTimeout(() => sayStep(idx + 1), (st.detail || "").length * 68 + 2200);
          } else {
            ambientTimer = setTimeout(() => {
              stopAmbient();
              btn.textContent = t("🔊 Bana Anlat");
              btn.classList.remove("btn-handsfree");
            }, (st.detail || "").length * 68 + 2200);
          }
        };
        ambientTimer = setTimeout(() => sayStep(firstIdx), Math.min(intro.length * 62, 12000));
      }
      else if (act === "cert") {
        const nameEl = document.getElementById("certNameInput");
        const name = (nameEl && nameEl.value.trim()) || "";
        if (!name) { if (nameEl) nameEl.focus(); return; }
        saveCertName(name);
        recordCertificate(g, name);
        openCertificate(g, name);
        downloadCertificatePDF(g, name);
        btn.textContent = t("🏅 PDF indiriliyor — pencereyi de yazdırabilirsin!");
        setTimeout(() => { btn.textContent = t("🏅 Sertifika Oluştur"); }, 2500);
      }
    });
  });
}

/* ───────────────────── Paylaşılabilir Proje Kartı (1080×1080 PNG) ───────────────────── */
function shareCardCanvas(g) {
  const W = 1080, H = 1080;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  if (!c) return null;
  const en = getLang() === "en";
  // Zemin: koyu lacivert + degrade vurgular
  c.fillStyle = "#0a0f1c";
  c.fillRect(0, 0, W, H);
  const glow1 = c.createRadialGradient(W - 160, 140, 40, W - 160, 140, 520);
  glow1.addColorStop(0, "rgba(0,209,178,0.28)");
  glow1.addColorStop(1, "rgba(0,209,178,0)");
  c.fillStyle = glow1;
  c.fillRect(0, 0, W, H);
  const glow2 = c.createRadialGradient(120, H - 140, 40, 120, H - 140, 480);
  glow2.addColorStop(0, "rgba(255,138,61,0.24)");
  glow2.addColorStop(1, "rgba(255,138,61,0)");
  c.fillStyle = glow2;
  c.fillRect(0, 0, W, H);
  // İnce devre izleri (dekoratif)
  c.strokeStyle = "rgba(0,209,178,0.16)";
  c.lineWidth = 2;
  [[0, 210, 300, 210, 300, 330], [W, 860, 760, 860, 760, 740], [0, 900, 200, 900, 200, 800]].forEach(([x1, y1, x2, y2, x3, y3]) => {
    c.beginPath();
    c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3);
    c.stroke();
  });
  // Üst bant: marka
  c.fillStyle = "#00d1b2";
  c.font = "600 34px 'Space Grotesk', 'Segoe UI', sans-serif";
  c.textAlign = "left";
  c.fillText("🤖 " + (en ? "Arduino Dream Workshop" : "Arduino Rüya Atölyesi"), 80, 110);
  // Seviye rozeti
  const level = String(g.difficulty || "");
  c.font = "600 30px 'Space Grotesk', 'Segoe UI', sans-serif";
  const lvlTxt = (en ? "Level: " : "Seviye: ") + level;
  const lvlW = c.measureText(lvlTxt).width + 48;
  c.fillStyle = "rgba(255,138,61,0.16)";
  roundRect(c, W - 80 - lvlW, 72, lvlW, 58, 29);
  c.fill();
  c.fillStyle = "#ff8a3d";
  c.textAlign = "center";
  c.fillText(lvlTxt, W - 80 - lvlW / 2, 111);
  // Başlık (kayar, en fazla 3 satır)
  c.textAlign = "left";
  c.fillStyle = "#f1f5f9";
  const title = g.title || (en ? "Untitled project" : "İsimsiz proje");
  const lines = wrapCardText(c, title, "700 68px 'Space Grotesk', 'Segoe UI', sans-serif", W - 160, 3);
  let ty = 300;
  lines.forEach((ln) => { c.fillText(ln, 80, ty); ty += 84; });
  // Ayraç
  const grad = c.createLinearGradient(80, 0, 620, 0);
  grad.addColorStop(0, "#00d1b2");
  grad.addColorStop(1, "#ff8a3d");
  c.fillStyle = grad;
  roundRect(c, 80, ty - 24, 220, 8, 4);
  c.fill();
  ty += 40;
  // Özet (en fazla 4 satır)
  c.fillStyle = "#94a3b8";
  const sumLines = wrapCardText(c, g.summary || "", "400 32px Inter, 'Segoe UI', sans-serif", W - 160, 4);
  sumLines.forEach((ln) => { c.fillText(ln, 80, ty); ty += 46; });
  // İstatistik kutuları
  const mats = (g.materials || []).length;
  const wirs = (g.wiring || []).length;
  const steps = (g.steps || []).length;
  const costUsd = estimateCost(g).totalUSD;
  const stats = [
    { v: String(mats), l: en ? "parts" : "parça", x: 80 },
    { v: String(wirs), l: en ? "wires" : "bağlantı", x: 388 },
    { v: String(steps), l: en ? "steps" : "adım", x: 696 },
    { v: (Math.round(costUsd * rate() * 10) / 10).toFixed(0) + "₺", l: en ? "est. cost" : "≈ fiyat", x: 1004 }
  ];
  const boxY = H - 300;
  stats.forEach((s) => {
    c.fillStyle = "rgba(148,163,184,0.08)";
    roundRect(c, s.x, boxY, 268, 150, 24);
    c.fill();
    c.strokeStyle = "rgba(0,209,178,0.25)";
    c.lineWidth = 2;
    roundRect(c, s.x, boxY, 268, 150, 24);
    c.stroke();
    c.fillStyle = "#00d1b2";
    c.font = "700 58px 'Space Grotesk', 'Segoe UI', sans-serif";
    c.fillText(s.v, s.x + 28, boxY + 78);
    c.fillStyle = "#94a3b8";
    c.font = "400 28px Inter, 'Segoe UI', sans-serif";
    c.fillText(s.l, s.x + 28, boxY + 120);
  });
  // Alt bilgi
  c.fillStyle = "#64748b";
  c.font = "400 26px Inter, 'Segoe UI', sans-serif";
  const hint = en ? "Build your dream project with AI-powered guides" : "Hayalindeki projeyi yapay zekâ destekli rehberle gerçekleştir";
  c.fillText(hint, 80, H - 80);
  return cv;
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function wrapCardText(c, text, font, maxW, maxLines) {
  c.font = font;
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const wd of words) {
    const t2 = line ? line + " " + wd : wd;
    if (c.measureText(t2).width > maxW && line) {
      lines.push(line);
      line = wd;
      if (lines.length === maxLines) break;
    } else line = t2;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (c.measureText(last).width > maxW - 60) lines[maxLines - 1] = last.slice(0, Math.max(0, last.length - 1)).trimEnd() + "…";
    else if (words.join(" ").length > lines.join(" ").length && !line.endsWith("…") && lines.join(" ").replace(/…$/, "").length < words.join(" ").length) lines[maxLines - 1] += "…";
  }
  return lines;
}
async function shareCard(g) {
  const cv = shareCardCanvas(g);
  if (!cv) return false;
  const fname = (g.title || "proje").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "proje";
  return new Promise((resolve) => {
    cv.toBlob(async (blob) => {
      if (!blob) { resolve(false); return; }
      const en = getLang() === "en";
      const file = new File([blob], "proje-karti-" + fname + ".png", { type: "image/png" });
      // Web Share API: mobilde doğrudan Instagram/WhatsApp vb. paylaşımı (dosya destekliyse)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: g.title || "", text: (en ? "My Arduino project: " : "Arduino projem: ") + (g.title || "") });
          resolve(true);
          return;
        } catch (e) {
          if (e && e.name === "AbortError") { resolve(true); return; }
          // başka bir hata → indirmeye düş
        }
      }
      downloadFileBlob(blob, "proje-karti-" + fname + ".png");
      resolve(true);
    }, "image/png");
  });
}

function buildPrintableHTML(g) {
  const date = new Date().toLocaleDateString("tr-TR");
  const en = getLang() === "en";
  const money = (x) => `${(Math.round(x * rate() * 100) / 100).toFixed(2)}₺ ($${x.toFixed(2)})`;
  const cost = estimateCost(g);
  const mats = cost.rows.map((r, i) => `<tr><td>${esc(r.name)}</td><td>${esc(r.qty)}</td><td>${r.known ? "$" + r.unit.toFixed(2) : "—"}</td><td>${r.known ? "$" + r.total.toFixed(2) : "—"}</td><td>${esc((g.materials || [])[i]?.purpose || "")}</td></tr>`).join("");
  const costOver = isOverBudget(cost.totalUSD);
  const costRow = cost.rows.length ? `<tr class="cost-total"><td colspan="3"><strong>${en ? "💰 Estimated Project Total" : "💰 Ortalama Proje Fiyatı"}</strong>${costOver ? ` — ⚠️ ${en ? "over budget" : "bütçe aşımı"}` : ""}</td><td><strong>${money(cost.totalUSD)}</strong></td><td>${cost.anyUnknown ? (en ? "some parts not priced" : "bazı parçalar fiyatlanmadı") : ""}</td></tr>` : "";
  const wir = (g.wiring || []).map((w) => `<tr><td>${esc(w.from)}</td><td>${esc(w.to)}</td><td>${esc(w.note || "")}</td></tr>`).join("");
  const steps = (g.steps || []).map((s, i) => `<li><strong>${i + 1}. ${esc(s.title)}</strong><p>${esc(s.detail)}</p>${s.tip ? `<em>💡 ${esc(s.tip)}</em>` : ""}</li>`).join("");
  const tips = (g.tips || []).map((t) => `<li>${esc(t)}</li>`).join("");
  const code = esc(g.code || "");
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"><title>${esc(g.title)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a2233; margin: 2cm; line-height: 1.55; }
  h1 { font-size: 22pt; margin: 0 0 4px; }
  .meta { color: #667; font-size: 10pt; margin-bottom: 18px; }
  .summary { background: #f2f5fa; border-left: 4px solid #0aa88f; padding: 10px 14px; }
  h2 { font-size: 14pt; border-bottom: 2px solid #dde3ee; padding-bottom: 4px; margin-top: 26px; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e6ef; }
  th { color: #556; font-size: 9pt; text-transform: uppercase; }
  ol.steps li { margin-bottom: 12px; }
  ol.steps em { color: #8a5a2b; font-size: 9.5pt; }
  ul.tips li { margin-bottom: 5px; }
  .cost-total td { background: #f2f5fa; border-top: 2px solid #0aa88f; }
  pre { background: #f4f6fb; border: 1px solid #dde3ee; border-radius: 8px; padding: 12px; font-family: 'Courier New', monospace; font-size: 8.5pt; white-space: pre-wrap; word-break: break-word; }
</style></head><body>
<h1>${esc(g.title)}</h1>
<div class="meta">Arduino Rüya Atölyesi · Seviye: ${esc(g.difficulty)} · ${date}</div>
<div class="summary">${esc(g.summary)}</div>
<h2>🧰 Malzeme Listesi</h2>
<table><thead><tr><th>Parça</th><th>Adet</th><th>${en ? "Unit Price" : "Birim Fiyat"}</th><th>${en ? "Subtotal" : "Tutar"}</th><th>Görevi</th></tr></thead><tbody>${mats}${costRow}</tbody></table>
<h2>🔌 Devre Bağlantıları</h2>
<table><thead><tr><th>Nereden</th><th>Nereye</th><th>Not</th></tr></thead><tbody>${wir}</tbody></table>
<h2>🛠️ Adım Adım Yapım</h2>
<ol class="steps">${steps}</ol>
<h2>💡 İpuçları ve Güvenlik</h2>
<ul class="tips">${tips}</ul>
<h2>💻 Arduino Kodu</h2>
<pre>${code}</pre>
</body></html>`;
}

function downloadPDF() {
  if (!currentGuide) return;
  const html = buildPrintableHTML(currentGuide);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => iframe.remove(), 30000);
  };
  iframe.onload = doPrint;
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(doPrint, 600);
}

function shareWhatsApp() {
  if (!currentGuide) return;
  const g = currentGuide;
  const en = getLang() === "en";
  const cost = estimateCost(g);
  const lines = [
    `🤖 *${g.title}*`,
    `Seviye: ${g.difficulty}`,
    "",
    g.summary,
    "",
    "🧰 Malzemeler:",
    ...(g.materials || []).map((m) => `• ${m.name} (${m.quantity})`),
    "",
    `💰 ${en ? "Est. project total" : "Ortalama proje fiyatı"}: ${fmtTL(cost.totalUSD)}${cost.anyUnknown ? (en ? " (some parts unpriced)" : " (bazı parçalar fiyatlanmadı)") : ""}`,
    "",
    "🔗 Bağlantılar:",
    ...(g.wiring || []).slice(0, 10).map((w) => `• ${w.from} → ${w.to}`),
    "",
    "📱 Arduino Rüya Atölyesi'nden paylaşıldı"
  ];
  const url = "https://wa.me/?text=" + encodeURIComponent(lines.join("\n").slice(0, 1500));
  window.open(url, "_blank", "noopener");
}

/* ── Alışveriş listesi (v2.19.0): malzemeleri satın alma listesine döker.
   Her satırda parça × adet ve satır toplamı; sonda proje toplamı var.
   qtyOv (costQty.v1 adet geçersiz kılmaları) desteklenir. ── */
function shoppingListText(g, qtyOv) {
  const en = getLang() === "en";
  const cost = estimateCost(g, qtyOv);
  const items = cost.rows.map((r) => `• ${r.name} × ${r.qty}${r.total != null ? ` — ${fmtTL(r.total)}` : ""}`);
  const head = en ? `🛒 *Shopping list — ${g && g.title || ""}*` : `🛒 *Alışveriş listesi — ${g && g.title || ""}*`;
  const foot = en
    ? `💰 Estimated total: ${fmtTL(cost.totalUSD)}${cost.anyUnknown ? (en ? " (some parts unpriced)" : "") : ""}\n📱 Shared from Arduino Dream Lab`
    : `💰 Tahmini toplam: ${fmtTL(cost.totalUSD)}${cost.anyUnknown ? " (bazı parçalar fiyatlanmadı)" : ""}\n📱 Arduino Rüya Atölyesi'nden paylaşıldı`;
  return [head, "", ...items, "", foot].join("\n").slice(0, 3000);
}
function shareShoppingList() {
  if (!currentGuide) return;
  const en = getLang() === "en";
  let qtyOv = null;
  try { qtyOv = JSON.parse(localStorage.getItem("arduinoDreamLab.costQty.v1")) || {}; } catch { qtyOv = {}; }
  const text = shoppingListText(currentGuide, qtyOv);
  const w = window.open("https://wa.me/?text=" + encodeURIComponent(text.slice(0, 1500)), "_blank", "noopener");
  if (!w && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showError(en ? "🛒 Shopping list copied to clipboard (popup was blocked)." : "🛒 Alışveriş listesi panoya kopyalandı (açılır pencere engellendi).");
      errorBanner.classList.add("info");
      setTimeout(() => { errorBanner.classList.remove("info"); errorBanner.hidden = true; }, 6000);
    });
  }
}

/* ───────────────────── Adım Takibi ───────────────────── */
const STEPS_KEY = "arduinoDreamLab.steps.v1";

function stepsStore() {
  try { return JSON.parse(localStorage.getItem(STEPS_KEY)) || {}; } catch { return {}; }
}
function stepsKeyOf(g) {
  return (g.title || "?") + "|" + (g.code || "").length;
}
function initStepTracking(g) {
  const key = stepsKeyOf(g);
  const store = stepsStore();
  if (!store[key]) store[key] = {};
  localStorage.setItem(STEPS_KEY, JSON.stringify(store));
  resultCard.querySelectorAll("[data-step-check]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const idx = Number(cb.dataset.stepCheck);
      const s = stepsStore();
      if (!s[key]) s[key] = {};
      if (cb.checked) s[key][idx] = 1; else delete s[key][idx];
      localStorage.setItem(STEPS_KEY, JSON.stringify(s));
      const li = resultCard.querySelector(`.step-item[data-step="${idx}"]`);
      if (li) li.classList.toggle("done", cb.checked);
      updateProgressBar();
    });
  });
  updateProgressBar();
  initSubmitRow(g);
}
function updateProgressBar() {
  const boxes = [...resultCard.querySelectorAll("[data-step-check]")];
  if (!boxes.length) return;
  const done = boxes.filter((b) => b.checked).length;
  const pct = Math.round((done / boxes.length) * 100);
  const fill = resultCard.querySelector(".progress-fill");
  const label = resultCard.querySelector(".progress-label");
  if (fill) fill.style.width = pct + "%";
  if (label) label.textContent = getLang() === "en"
    ? `🛠️ ${done} / ${boxes.length} steps done (%${pct})`
    : `🛠️ ${done} / ${boxes.length} adım tamamlandı (%${pct})`;
  const certRow = document.getElementById("certRow");
  if (certRow) certRow.hidden = done < boxes.length;
  // Sınıf gönderim satırı: en az bir adım işaretlendiyse görünsün
  const submitRow = document.getElementById("submitRow");
  if (submitRow) submitRow.hidden = done === 0;
}
/* Öğrenci gönderim dosyasını indir (öğretmen Sınıf Modu'ndan içe aktarır) */
function initSubmitRow(g) {
  const btn = document.getElementById("submitToClass");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const en = getLang() === "en";
    const nameInput = document.getElementById("submitNameInput");
    const name = String(nameInput && nameInput.value || "").trim();
    if (!name) {
      showError(en ? "✍️ Type your name first." : "✍️ Önce adını yaz.");
      if (nameInput) nameInput.focus();
      return;
    }
    const payload = buildClassSubmission(name);
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const fname = (name + "-" + (g.title || "proje")).toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "gonderim";
    downloadFileBlob(blob, fname + ".klasor.json");
    btn.textContent = en ? "✅ Submitted — send the file to your teacher" : "✅ Gönderildi — dosyayı öğretmenine ilet";
    setTimeout(() => { btn.textContent = t("📋 Gönderim Dosyası İndir"); }, 4000);
  });
  /* Öğrencinin bu proje için okunmuş geri bildirimi varsa göster */
  const seen = loadFeedback().filter((fb) => g && fb.project === (g.title || ""));
  if (seen.length) showFeedback(seen[seen.length - 1]);
  const fbBtn = document.getElementById("fbOpenBtn");
  if (fbBtn) fbBtn.addEventListener("click", openStudentFeedback);
}

/* ───────────────────── Sertifika ───────────────────── */
/* Sertifikanın baskı-dostu SVG hâli: Portfolyo.zip'e gömülür (canvas/PDF gerektirmez).
   certCanvas ile aynı görsel dil: A4 yatay, çift altın çerçeve, rozet, isim + tarih. */
function certificateSVG(g, studentName, ts) {
  const en = getLang() === "en";
  const W = 1123, H = 794;
  const escX = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const when = new Date(ts || Date.now()).toLocaleDateString(en ? "en-US" : "tr-TR");
  const name = String(studentName || "—").slice(0, 60);
  const title = String((g && g.title) || "").slice(0, 120);
  // Başlığı elle 2 satıra böl (SVG'de otomatik kaydırma yok)
  const words = title.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const wd of words) {
    if ((cur + " " + wd).length > 58 && cur) { lines.push(cur); cur = wd; }
    else cur = cur ? cur + " " + wd : wd;
    if (lines.length === 2) break;
  }
  if (cur && lines.length < 2) lines.push(cur);
  if (words.length > lines.join(" ").split(/\s+/).length) lines[lines.length - 1] += "…";
  const titleY = 450 + (lines.length === 2 ? -14 : 0);
  // 💰 Fiyat şeridi (v2.12.0): tahmini proje maliyeti — certCanvas ile aynı dil
  const costUsd2 = estimateCost(g).totalUSD;
  const certOver2 = isOverBudget(costUsd2);
  const costStrip = costUsd2 > 0
    ? (en ? "Estimated project cost: " : "Tahmini proje maliyeti: ")
      + `${(costUsd2 * rate()).toFixed(2)}₺ ($${costUsd2.toFixed(2)})`
      + (certOver2 ? (en ? " · ⚠️ OVER BUDGET" : " · ⚠️ BÜTÇE AŞIMI") : (en ? " · average retail estimate" : " · ortalama perakende tahmini"))
    : "";
  const brand = en ? "🤖 Arduino Dream Workshop" : "🤖 Arduino Rüya Atölyesi";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, 'Times New Roman', serif">
  <defs><linearGradient id="certbg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fdfbf5"/><stop offset="1" stop-color="#f7f1e3"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#certbg)"/>
  <rect x="22" y="22" width="${W - 44}" height="${H - 44}" fill="none" stroke="#b08d3f" stroke-width="10"/>
  <rect x="42" y="42" width="${W - 84}" height="${H - 84}" fill="none" stroke="#b08d3f" stroke-width="3"/>
  <text x="${W / 2}" y="130" text-anchor="middle" font-size="64">🏅</text>
  <text x="${W / 2}" y="195" text-anchor="middle" font-size="40" font-weight="600" fill="#7a5c1e" letter-spacing="6">${escX(en ? "CERTIFICATE OF COMPLETION" : "BAŞARI SERTİFİKASI")}</text>
  <text x="${W / 2}" y="248" text-anchor="middle" font-size="17" fill="#666">${escX(en ? "This certificate is proudly presented to" : "Bu sertifika")}</text>
  <text x="${W / 2}" y="272" text-anchor="middle" font-size="17" fill="#666">${escX(en ? "for completing all build steps of the project below:" : "aşağıdaki projenin tüm yapım adımlarını başarıyla tamamladığı için verilmiştir:")}</text>
  <text x="${W / 2}" y="365" text-anchor="middle" font-size="46" font-weight="600" fill="#1a2233">${escX(name)}</text>
  <line x1="${W / 2 - 180}" y1="383" x2="${W / 2 + 180}" y2="383" stroke="#b08d3f" stroke-width="2"/>
  ${lines.map((ln, i) => `<text x="${W / 2}" y="${titleY + i * 34}" text-anchor="middle" font-size="25" font-weight="600" fill="#333">"${escX(ln)}${i === lines.length - 1 ? '"' : ""}</text>`).join("\n  ")}
  ${costStrip ? `<rect x="${W / 2 - 250}" y="530" width="500" height="38" rx="19" fill="rgba(${certOver2 ? "229,72,77,0.12" : "176,141,63,0.12"})" stroke="${certOver2 ? "#e5484d" : "#b08d3f"}" stroke-width="1.5"/>
  <text x="${W / 2}" y="554" text-anchor="middle" font-size="15" font-weight="600" fill="${certOver2 ? "#c53030" : "#7a5c1e"}">${escX(costStrip)}</text>` : ""}
  <text x="120" y="${H - 90}" font-size="15" fill="#666">${escX(when)}</text>
  <text x="${W - 120}" y="${H - 90}" text-anchor="end" font-size="15" font-weight="600" fill="#0aa88f">${escX(brand)} · ${escX(when)}</text>
</svg>`;
}
function certCanvas(g, studentName) {
  const en = getLang() === "en";
  const W = 1123, H = 794; // A4 yatay @96dpi
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  if (!c) return null;
  // Zemin
  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#fdfbf5");
  bg.addColorStop(1, "#f7f1e3");
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  // Çift çerçeve
  c.strokeStyle = "#b08d3f";
  c.lineWidth = 10;
  c.strokeRect(22, 22, W - 44, H - 44);
  c.lineWidth = 3;
  c.strokeRect(42, 42, W - 84, H - 84);
  const center = (y, fn) => { c.textAlign = "center"; fn(W / 2, y); };
  // Rozet + başlık
  c.fillStyle = "#7a5c1e";
  center(120, (x, y) => { c.font = "64px Georgia, serif"; c.fillText("🏅", x, y); });
  const spaced = (txt, gap) => String(txt).split("").join(String.fromCharCode(8202).repeat(gap)); // hair-space ile harf aralığı
  center(185, (x, y) => { c.font = "600 40px Georgia, 'Times New Roman', serif"; c.fillStyle = "#7a5c1e"; c.fillText(spaced(en ? "CERTIFICATE OF COMPLETION" : "BAŞARI SERTİFİKASI", 2), x, y); });
  c.fillStyle = "#666";
  center(240, (x, y) => { c.font = "17px Georgia, serif"; c.fillText(en ? "This certificate is proudly presented to" : "Bu sertifika", x, y); });
  if (!en) center(264, (x, y) => { c.font = "17px Georgia, serif"; c.fillText("aşağıdaki projenin tüm yapım adımlarını başarıyla tamamladığı için verilmiştir:", x, y); });
  // İsim
  c.fillStyle = "#1a2233";
  c.font = "600 46px Georgia, serif";
  let name = studentName || "";
  while (c.measureText(name).width > W - 320 && name.length > 3) name = name.slice(0, -2) + "…";
  center(360, (x, y) => c.fillText(name, x, y));
  c.strokeStyle = "#b08d3f";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(W / 2 - 180, 378);
  c.lineTo(W / 2 + 180, 378);
  c.stroke();
  // Proje
  c.fillStyle = "#333";
  const wrapText = (text, maxW, lh, startY) => {
    const words = String(text).split(/\s+/);
    let line = "", y = startY;
    c.font = "600 25px Georgia, serif";
    for (const wd of words) {
      const t2 = line ? line + " " + wd : wd;
      if (c.measureText(t2).width > maxW && line) { c.fillText(line, W / 2, y); y += lh; line = wd; }
      else line = t2;
    }
    if (line) c.fillText(line, W / 2, y);
    return y;
  };
  const yEnd = wrapText("\"" + (g.title || "") + "\"", W - 320, 34, 440);
  // 💰 Fiyat şeridi: tahmini proje maliyeti (v2.12.0); bütçe aşımı varsa kırmızı (v2.13.0)
  const costUsd2 = estimateCost(g).totalUSD;
  if (costUsd2 > 0) {
    const isOver = isOverBudget(costUsd2);
    const strip = (en ? "Estimated project cost: " : "Tahmini proje maliyeti: ")
      + `${(costUsd2 * rate()).toFixed(2)}₺ ($${costUsd2.toFixed(2)})`
      + (isOver ? (en ? " · ⚠️ OVER BUDGET" : " · ⚠️ BÜTÇE AŞIMI") : (en ? " · average retail estimate" : " · ortalama perakende tahmini"));
    c.fillStyle = isOver ? "rgba(229, 72, 77, 0.12)" : "rgba(176, 141, 63, 0.12)";
    roundRect(c, W / 2 - 250, yEnd + 28, 500, 42, 21);
    c.fill();
    c.strokeStyle = isOver ? "#e5484d" : "#b08d3f";
    c.lineWidth = 1.5;
    roundRect(c, W / 2 - 250, yEnd + 28, 500, 42, 21);
    c.stroke();
    c.fillStyle = isOver ? "#c53030" : "#7a5c1e";
    c.font = "600 16px Georgia, serif";
    center(yEnd + 55, (x, y) => c.fillText(strip, x, y));
  }
  const date = new Date().toLocaleDateString(en ? "en-US" : "tr-TR");
  c.font = "15px Georgia, serif";
  c.fillStyle = "#666";
  c.fillText(date, 120, H - 90);
  c.textAlign = "right";
  c.font = "600 15px Georgia, serif";
  c.fillStyle = "#0aa88f";
  c.fillText((en ? "🤖 Arduino Dream Workshop" : "🤖 Arduino Rüya Atölyesi") + (en ? " · " : " · ") + date, W - 120, H - 90);
  c.textAlign = "center";
  return cv;
}

/* Canvas'ı harici kütüphane olmadan PDF'e göm (JPEG, tek sayfa, A4 yatay) */
function canvasToPDFBlob(canvas) {
  const W = canvas.width, H = canvas.height;
  const jpegs = [];
  const toB64 = (bin) => btoa(bin);
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error("toBlob failed")); return; }
      try {
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        const CH = 0x8000;
        for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
        jpegs.push(bin);
        const imgData = toB64(jpegs[0]);
        const pw = 841.89, ph = 595.28; // A4 yatay (pt)
        const encStr = (s) => {
          let out = "(";
          for (let i = 0; i < s.length; i++) {
            const code = s.charCodeAt(i);
            if (code === 40 || code === 41 || code === 92) out += "\\" + String.fromCharCode(code);
            else if (code > 126) out += "\\" + ("000" + code.toString(8)).slice(-3);
            else out += String.fromCharCode(code);
          }
          return out + ")";
        };
        const objs = [
          "<< /Type /Catalog /Pages 2 0 R >>",
          "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
          `<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgData.length} >>\nstream\n${imgData}\nendstream`,
          `<< /Length 0 >>\nstream\nq ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q\nendstream`
        ];
        const encTitle = encStr("Arduino Ruya Atolyesi - Sertifika");
        objs[4] = `<< /Length ${objs[4].split("stream\n")[1].split("\nendstream")[0].length} >>\nstream\nq ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q\nendstream`;
        let pdf = "%PDF-1.4\n";
        const offsets = [];
        let pos = pdf.length;
        objs.forEach((o, i) => {
          const head = `${i + 1} 0 obj\n${o}\nendobj\n`;
          offsets.push(pos);
          pdf += head;
          pos += head.length;
        });
        const xrefPos = pos;
        pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
        offsets.forEach((off) => { pdf += String(off).padStart(10, "0") + " 00000 n \n"; });
        pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
        // Info sözlüğü (6 0 R) — başlık
        objs.push(`<< /Title ${encTitle} /Producer (Arduino Ruya Atolyesi) >>`);
        // xref 6 girdisini sona ekle: en basit yol — pdf'i yeniden kur
        pdf = "%PDF-1.4\n";
        pos = pdf.length;
        offsets.length = 0;
        objs.forEach((o, i) => {
          const head = `${i + 1} 0 obj\n${o}\nendobj\n`;
          offsets.push(pos);
          pdf += head;
          pos += head.length;
        });
        const xr = pos;
        pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
        offsets.forEach((off) => { pdf += String(off).padStart(10, "0") + " 00000 n \n"; });
        pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xr}\n%%EOF`;
        resolve(new Blob([pdf], { type: "application/pdf" }));
      } catch (e) { reject(e); }
    }, "image/jpeg", 0.92);
  });
}
function downloadFileBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
}
async function downloadCertificatePDF(g, studentName) {
  const cv = certCanvas(g, studentName);
  if (!cv) return false;
  try {
    const blob = await canvasToPDFBlob(cv);
    const fname = (g.title || "sertifika").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "sertifika";
    downloadFileBlob(blob, "sertifika-" + fname + ".pdf");
    return true;
  } catch (e) {
    console.warn("Sertifika PDF üretilemedi:", e);
    return false;
  }
}
function openCertificate(g, studentName) {
  const date = new Date().toLocaleDateString(getLang() === "en" ? "en-US" : "tr-TR");
  const en = getLang() === "en";
  const w = window.open("", "_blank");
  if (!w) {
    showError(en ? "Popup blocked — allow popups and try again." : "Açılır pencere engellendi — izin verip tekrar dene.");
  return;
  }
  // Sertifika penceresi ayrı belge olduğu için esc/canvas yardımcılarına erişemez;
  // güvenli JSON köprüsüyle proje verisini taşır, düğme pencereyi kapatıp indirme akışını başlatır.
  const cardPayload = JSON.stringify({ title: g.title || "", summary: g.summary || "", difficulty: g.difficulty || "", materials: (g.materials || []).length, wiring: (g.wiring || []).length, steps: (g.steps || []).length });
  w.__CARD_DATA__ = cardPayload;
  // Dikkat: bu script bloğu dist'e GÖMÜLMÜŞ durumda girdiği için literal "<script>"
  // yazamayız (dist'i bozar) — parçalara bölerek birleştiriyoruz.
  const SO = "<" + "script>";
  const SC = "<" + "/script>";
  const cardBtnScript = SO + "\n(function () {\n  var btn = document.getElementById(\"cardBtn\");\n  if (!btn) return;\n  btn.addEventListener(\"click\", function () {\n    try { window.localStorage.setItem(\"arduinoDreamLab.certCardRequest\", window.__CARD_DATA__ || \"{}\"); } catch (e) {}\n    btn.textContent = " + JSON.stringify(en ? "✅ Card ready — check downloads" : "✅ Kart indi — İndirilenler klasörüne bak") + ";\n    setTimeout(function () { window.close(); }, 900);\n  });\n})();\n" + SC;
  w.document.write(`<!DOCTYPE html>
<html lang="${en ? "en" : "tr"}"><head><meta charset="UTF-8"><title>${esc(g.title)} — ${en ? "Certificate" : "Sertifika"}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; background: #f5f2ea; }
  .cert {
    width: 297mm; height: 210mm; box-sizing: border-box; padding: 24mm;
    border: 12px double #b08d3f; margin: 0 auto; position: relative;
    background: linear-gradient(160deg, #fdfbf5 0%, #f7f1e3 100%); text-align: center;
    display: flex; flex-direction: column; justify-content: center; gap: 8mm;
  }
  .badge { font-size: 44pt; }
  h1 { font-size: 30pt; margin: 0; letter-spacing: 2px; color: #7a5c1e; }
  .given { font-size: 13pt; color: #555; }
  .name { font-size: 34pt; color: #1a2233; border-bottom: 2px solid #b08d3f; display: inline-block; padding: 0 18mm 4mm; }
  .project { font-size: 16pt; color: #333; max-width: 200mm; margin: 0 auto; }
  .foot { display: flex; justify-content: space-between; font-size: 11pt; color: #666; margin-top: 6mm; }
  .brand { color: #0aa88f; font-weight: bold; }
  .print { position: fixed; top: 12px; right: 12px; }
  @media print { .print { display: none; } }
</style></head><body>
<div class="cert">
  <div class="badge">🏅</div>
  <h1>${en ? "CERTIFICATE OF COMPLETION" : "BAŞARI SERTİFİKASI"}</h1>
  <div class="given">${en ? "This certificate is proudly presented to" : ""}</div>
  <div class="name">${esc(studentName)}</div>
  <div class="project">${en ? "for successfully completing all build steps of" : "Bu sertifika, aşağıdaki Arduino projesinin tüm yapım adımlarını başarıyla tamamladığı için verilmiştir:"}</div>
  <div class="project" style="font-weight:bold;font-size:19pt">"${esc(g.title)}"</div>
  <div class="foot"><span>${date}</span><span class="brand">🤖 ${en ? "Arduino Dream Workshop" : "Arduino Rüya Atölyesi"}</span></div>
</div>
<button class="print btn" onclick="window.print()">${en ? "🖨️ Print" : "🖨️ Yazdır"}</button>
<button class="print btn pdf-btn" style="right:130px" id="pdfBtn">${en ? "⬇️ PDF" : "⬇️ PDF İndir"}</button>
<button class="print btn pdf-btn" style="right:290px" id="cardBtn" title="${en ? "1080×1080 share card" : "1080×1080 paylaşım kartı"}">${en ? "🖼️ Share Card" : "🖼️ Kart PNG"}</button>
${cardBtnScript}
</body></html>`);
  w.document.close();
  w.__CARD_DATA__ = cardPayload;
  const pdfBtn = w.document.getElementById("pdfBtn");
  if (pdfBtn) pdfBtn.addEventListener("click", () => { downloadCertificatePDF(g, studentName); });
  // Köprü: pencere kapanınca istek anahtarını oku, karta dönüştür ve indir
  w.addEventListener("beforeunload", () => {
    try {
      const req = localStorage.getItem("arduinoDreamLab.certCardRequest");
      if (req) {
        localStorage.removeItem("arduinoDreamLab.certCardRequest");
        const data = JSON.parse(req);
        // shareCardCanvas yalnızca uzunluk kullanır — sayaçlar gerçek kalsın diye yer tutucu diziler
        const fill = (n) => Array.from({ length: Math.max(0, Number(n) || 0) }, () => ({}));
        const cv = shareCardCanvas({ title: data.title, summary: data.summary, difficulty: data.difficulty, materials: fill(data.materials), wiring: fill(data.wiring), steps: fill(data.steps) });
        if (cv) cv.toBlob((blob) => {
          if (!blob) return;
          const fname = (data.title || "proje").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "proje";
          downloadFileBlob(blob, "proje-karti-" + fname + ".png");
        }, "image/png");
      }
    } catch (e) { /* köprü sessizce geçer */ }
  });
}

/* ───────────────────── Tema ───────────────────── */
const THEME_KEY = "arduinoDreamLab.theme.v1";
function applyTheme(t) {
  if (t === "light") document.documentElement.dataset.theme = "light";
  else document.documentElement.removeAttribute("data-theme");
  const btn = $("themeToggle");
  if (btn) btn.textContent = t === "light" ? "☀️" : "🌙";
}
function getTheme() {
  return localStorage.getItem(THEME_KEY) || "dark";
}
$("themeToggle").addEventListener("click", () => {
  const next = getTheme() === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});
applyTheme(getTheme());

/* ───────────────────── Arşiv ───────────────────── */
const ARCHIVE_KEY = "arduinoDreamLab.archive.v1";
const archiveModal = $("archiveModal");

function loadArchive() {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || []; } catch { return []; }
}
function writeArchive(list) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list));
  updateArchiveCount();
}
function updateArchiveCount() {
  const el = $("archiveCount");
  if (el) el.textContent = String(loadArchive().length);
}
function saveToArchive(g, idea, manual = false) {
  const list = loadArchive();
  const sig = (g.title || "") + "|" + (g.code || "").length;
  const existsAt = list.findIndex((x) => x.sig === sig);
  if (existsAt === 0) return manual ? false : true;
  if (existsAt > 0) {
    if (manual) return false;
    list.splice(existsAt, 1);
  }
  list.unshift({ id: Date.now(), ts: Date.now(), idea: idea || "", sig, guide: g });
  writeArchive(list.slice(0, 30));
  return true;
}
/* v2.20.0: Arşiv filtre durumu — "all" | "fav" | etiket adı (modlar arası korunur) */
let archiveFilter = { mode: "all", tag: "" };
function renderArchive() {
  const wrap = $("archiveContent");
  const all = loadArchive();
  if (!all.length) {
    wrap.innerHTML = '<div class="empty-state"><span class="big">📭</span><p>Henüz kaydedilmiş proje yok.<br>Bir rehber oluşturduğunda otomatik olarak burada birikir.</p></div>';
    return;
  }
  const en = getLang() === "en";
  const tagCounts = new Map();
  let favCount = 0;
  all.forEach((item) => {
    const m = archiveMeta(item);
    if (m.fav) favCount++;
    m.tags.forEach((tg) => tagCounts.set(tg, (tagCounts.get(tg) || 0) + 1));
  });
  const chipBtn = (mode, tag, label, count, on) => `<button type="button" class="arch-chip${on ? " on" : ""}" data-archchip="${esc(mode)}" data-archtag="${esc(tag || "")}">${label}${count ? ` <span class='count-badge'>${count}</span>` : ""}</button>`;
  const chips = `<div class="arch-chips">`
    + chipBtn("all", "", en ? "🗂️ All" : "🗂️ Tümü", all.length, archiveFilter.mode === "all")
    + chipBtn("fav", "", en ? "⭐ Favorites" : "⭐ Favoriler", favCount, archiveFilter.mode === "fav")
    + [...tagCounts.keys()].sort((a, b) => a.localeCompare(b, "tr")).map((tg) => chipBtn("tag", tg, "🏷️ " + esc(tg), tagCounts.get(tg), archiveFilter.mode === "tag" && archiveFilter.tag === tg)).join("")
    + `</div>`;
  wrap.innerHTML = chips
    + `<input type="text" id="archSearch" class="cert-name-input" style="width:100%;margin:0 0 0.6rem" placeholder="${t("🔍 Ara: başlık, fikir veya etiket…")}" value="${esc(archiveFilter.q || "")}" />`
    + '<div id="archGrid"></div>'
    + '<div class="modal-actions" style="justify-content:space-between"><button class="btn btn-ghost btn-small" id="exportArchive" type="button">📤 Yedekle (JSON)</button><button class="btn btn-ghost btn-small" id="importArchive" type="button">📥 Geri Yükle</button><button class="btn btn-ghost btn-small" id="clearArchive" type="button">🧹 Tümünü Temizle</button><button class="btn btn-ghost btn-small" id="closeArchiveBtn2" type="button">Kapat</button></div><input type="file" id="importFile" accept="application/json,.json" hidden>';

  wrap.querySelectorAll("[data-archchip]").forEach((b) => b.addEventListener("click", () => {
    const mode = b.dataset.archchip;
    archiveFilter = mode === "tag" ? { mode: "tag", tag: b.dataset.archtag || "" } : { mode, tag: "" };
    renderArchive();
  }));
  const archSearch = $("archSearch");
  if (archSearch) archSearch.addEventListener("input", () => { archiveFilter.q = archSearch.value; renderArchiveGrid(); });
  $("exportArchive").addEventListener("click", () => {
    const data = JSON.stringify({ app: "arduino-dream-lab", v: 1, exportedAt: new Date().toISOString(), items: loadArchive() }, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = "arduino-ruya-arsiv-yedek.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("importArchive").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : null;
        if (!items) throw new Error("Geçersiz biçim: 'items' dizisi bulunamadı");
        const valid = items.filter((x) => x && typeof x === "object" && x.guide && x.guide.title);
        if (!valid.length) throw new Error("Dosyada geçerli rehber yok");
        const cur = loadArchive();
        const ids = new Set(cur.map((x) => x.id));
        let added = 0;
        valid.forEach((x) => {
          if (!ids.has(x.id)) { cur.push({ id: x.id || Date.now() + added, ts: x.ts || Date.now(), idea: x.idea || "", sig: x.sig || (x.guide.title + "|" + (x.guide.code || "").length), guide: x.guide, meta: x.meta || undefined }); added++; }
        });
        writeArchive(cur.sort((a, b) => b.ts - a.ts).slice(0, 30));
        renderArchive();
        alert(`✅ ${added} proje geri yüklendi.`);
      } catch (err) {
        alert("❌ Yedek dosyası okunamadı: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });
  wrap.querySelector("#clearArchive").addEventListener("click", () => {
    writeArchive([]);
    renderArchive();
  });
  wrap.querySelector("#closeArchiveBtn2").addEventListener("click", closeArchiveModal);
  renderArchiveGrid();
}
/* v2.21.0: Arşiv grid'i ayrı çizilir — arama yazarken araç çubuğu ve odak korunur */
function renderArchiveGrid() {
  const wrap = $("archGrid");
  if (!wrap) return;
  const en = getLang() === "en";
  const modeList = archiveFilter.mode === "fav" ? loadArchive().filter((item) => archiveMeta(item).fav)
    : archiveFilter.mode === "tag" ? loadArchive().filter((item) => archiveMeta(item).tags.includes(archiveFilter.tag))
    : loadArchive();
  const list = filterArchiveItems(modeList, archiveFilter.q);
  wrap.innerHTML = list.length ? '<div class="archive-grid">' + list.map((item) => {
    const gg = item.guide || {};
    const meta = archiveMeta(item);
    const date = new Date(item.ts).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
    return `<div class="archive-item${meta.fav ? " arch-fav" : ""}">
      <h4>${meta.fav ? "⭐ " : ""}${esc(gg.title || "İsimsiz proje")}</h4>
      <div class="arch-meta">
        <span class="arch-badge">${esc(gg.difficulty || "—")}</span>
        <span class="arch-date">📅 ${date}</span>
        <span>🧰 ${(gg.materials || []).length} parça</span>
      </div>
      ${meta.tags.length ? `<div class="arch-tags">${meta.tags.map((tg) => `<span class="arch-tag">🏷️ ${esc(tg)}</span>`).join("")}</div>` : ""}
      <div class="row">
        <button class="btn btn-ghost btn-small" data-open="${item.id}" type="button">👁️ Görüntüle</button>
        <button class="btn btn-ghost btn-small" data-fav="${item.id}" type="button" title="${meta.fav ? t("Favoriden çıkar") : t("Favorilere ekle")}">${meta.fav ? "⭐" : "☆"}</button>
        <button class="btn btn-ghost btn-small" data-tag="${item.id}" type="button" title="${t("Etiketleri düzenle (virgülle ayır, en çok 5)")}">🏷️</button>
        <button class="btn btn-ghost btn-small" data-cert="${item.id}" type="button" title="${t("Sertifika üret")}">🏅</button>
        <button class="btn btn-ghost btn-small" data-del="${item.id}" type="button" aria-label="Sil">🗑️</button>
      </div>
    </div>`;
  }).join("") + "</div>" : `<p class="panel-empty">${en ? "No projects match this filter." : "Bu filtreyle eşleşen proje yok."}</p>`;
  wrap.querySelectorAll("[data-fav]").forEach((b) => b.addEventListener("click", () => {
    const item = loadArchive().find((x) => String(x.id) === b.dataset.fav);
    if (!item) return;
    setArchiveMeta(item.id, { fav: !archiveMeta(item).fav });
    renderArchive();
  }));
  wrap.querySelectorAll("[data-tag]").forEach((b) => b.addEventListener("click", () => {
    const item = loadArchive().find((x) => String(x.id) === b.dataset.tag);
    if (!item) return;
    const cur = archiveMeta(item).tags.join(", ");
    const val = window.prompt(t("Etiketler (virgülle ayır, örn. veli, dönem1):"), cur);
    if (val === null) return;
    setArchiveMeta(item.id, { tags: String(val).split(",").map((x) => x.trim()).filter(Boolean) });
    renderArchive();
  }));
  wrap.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => {
    const item = loadArchive().find((x) => String(x.id) === b.dataset.open);
    if (item) {
      closeArchiveModal();
      renderGuide(item.guide, item.idea || "");
    }
  }));
  wrap.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
    writeArchive(loadArchive().filter((x) => String(x.id) !== b.dataset.del));
    renderArchive();
  }));
  wrap.querySelectorAll("[data-cert]").forEach((b) => b.addEventListener("click", () => {
    const item = loadArchive().find((x) => String(x.id) === b.dataset.cert);
    if (!item || !item.guide) return;
    const saved = loadCertName();
    const name = window.prompt(t("Sertifika için öğrenci adı:"), saved || "");
    if (!name || !name.trim()) return;
    saveCertName(name.trim());
    recordCertificate(item.guide, name.trim());
    openCertificate(item.guide, name.trim());
    downloadCertificatePDF(item.guide, name.trim());
  }));
}
function openArchiveModal() {
  renderArchive();
  archiveModal.hidden = false;
}
function closeArchiveModal() {
  archiveModal.hidden = true;
}
$("archiveBtn").addEventListener("click", openArchiveModal);
$("closeArchive").addEventListener("click", closeArchiveModal);
archiveModal.addEventListener("click", (e) => {
  if (e.target === archiveModal) closeArchiveModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !archiveModal.hidden) closeArchiveModal();
});

/* ───────────────────── Bileşen Kütüphanesi ───────────────────── */
const LIB_CATS = ["Hepsi", "Sensörler", "Motor & Sürücü", "Ekran & Çıkış", "Girdi & Diğer", "Özel Set"];

/* ── Özel bileşen seti: öğretmenler kendi bileşenlerini JSON olarak ekler/çıkarır.
   localStorage'da kalıcıdır, "Özel Set" kategorisinde gösterilir ve kablo çözücüsü
   (libPinWords/libAppendParts/libWokwiMatch) üzerinden Wokwi üretimine katılır. ── */
const LIB_CUSTOM_KEY = "arduinoDreamLab.libCustom.v1";
const LIB_CUSTOM_CAT = "Özel Set";
function loadLibCustom() {
  try {
    const arr = JSON.parse(localStorage.getItem(LIB_CUSTOM_KEY));
    if (!Array.isArray(arr)) return [];
    return arr.filter((c) => c && typeof c === "object" && c.name).map(normalizeLibCustom);
  } catch { return []; }
}
function saveLibCustom(list) {
  try { localStorage.setItem(LIB_CUSTOM_KEY, JSON.stringify(list)); } catch {}
  renderLib(currentLibCat);
}
/* Kullanıcı verisini güvenli şemaya oturt: eksik alanları doldur, pinMap'i doğrula */
function normalizeLibCustom(c) {
  const wokwiIn = c.wokwi && typeof c.wokwi === "object" ? c.wokwi : null;
  const typeOk = wokwiIn && typeof wokwiIn.type === "string" && /^wokwi-[a-z0-9-]+$/i.test(wokwiIn.type);
  const pinMap = {};
  if (wokwiIn && wokwiIn.pinMap && typeof wokwiIn.pinMap === "object") {
    Object.keys(wokwiIn.pinMap).forEach((k) => {
      if (typeof wokwiIn.pinMap[k] === "string" && wokwiIn.pinMap[k]) pinMap[k] = wokwiIn.pinMap[k];
    });
  }
  return {
    cat: LIB_CUSTOM_CAT,
    icon: typeof c.icon === "string" && c.icon ? String.fromCodePoint(c.icon.codePointAt(0)) : "⭐",
    name: String(c.name).slice(0, 60),
    desc: String(c.desc || "Öğretmen tanımlı bileşen").slice(0, 300),
    pins: Array.isArray(c.pins) ? c.pins.map((p) => String(p).slice(0, 24)).slice(0, 10) : Object.keys(pinMap),
    tip: String(c.tip || "").slice(0, 200),
    code: typeof c.code === "string" ? c.code.slice(0, 1500) : "",
    mistakes: Array.isArray(c.mistakes) ? c.mistakes.map((m) => String(m).slice(0, 200)).slice(0, 6) : [],
    wokwi: typeOk && Object.keys(pinMap).length ? { type: wokwiIn.type, id: typeof wokwiIn.id === "string" ? wokwiIn.id.replace(/[^a-z0-9_-]/gi, "").slice(0, 16) : undefined, attrs: wokwiIn.attrs && typeof wokwiIn.attrs === "object" ? wokwiIn.attrs : {}, pinMap } : null,
    custom: true
  };
}
/* LIB_DATA + kullanıcı seti → tüm tüketiciler bu görünümü kullanır */
const ALL_LIB = () => LIB_DATA.concat(loadLibCustom());
function libExportSet() {
  const data = {
    app: "arduino-ruya-atolyesi",
    kind: "bilesen-seti",
    version: 1,
    exportedAt: new Date().toISOString(),
    components: loadLibCustom().map((c) => ({
      name: c.name, icon: c.icon, desc: c.desc, pins: c.pins, tip: c.tip,
      code: c.code || "", mistakes: c.mistakes || [],
      wokwi: c.wokwi ? { type: c.wokwi.type, id: c.wokwi.id, attrs: c.wokwi.attrs || {}, pinMap: c.wokwi.pinMap || {} } : null
    }))
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "arduino-bilesen-seti.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function libImportSet(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const en = getLang() === "en";
    try {
      const parsed = JSON.parse(String(reader.result));
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.components) ? parsed.components : null;
      if (!list) throw new Error("format");
      const incoming = list.map(normalizeLibCustom);
      if (!incoming.length) throw new Error("empty");
      // Aynı adlı bileşeni güncelle, yenilerini ekle
      const current = loadLibCustom();
      incoming.forEach((c) => {
        const at = current.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase());
        if (at >= 0) current[at] = c; else current.push(c);
      });
      saveLibCustom(current);
      showError(en
        ? `✅ ${incoming.length} component${incoming.length > 1 ? "s" : ""} imported into the custom set.`
        : `✅ ${incoming.length} bileşen özel sete eklendi.`);
      errorBanner.classList.add("info");
      setTimeout(() => { errorBanner.classList.remove("info"); errorBanner.hidden = true; }, 8000);
    } catch {
      showError(en ? "❌ Could not read the component set file — expected the exported JSON format." : "❌ Bileşen seti dosyası okunamadı — dışa aktarılan JSON biçimi bekleniyor.");
    }
  };
  reader.readAsText(file);
}
const LIB_DATA = [
  { cat: "Sensörler", icon: "🌡️", name: "DHT11 / DHT22", desc: "Sıcaklık ve nem ölçer. DHT22 daha hassas (±0.5°C).", pins: ["VCC", "DATA", "GND"], tip: "DATA ile VCC arasına 10kΩ direnç (modülse gerek yok).",
    code: "#include <DHT.h>\nDHT dht(2, DHT11);\n\nvoid setup() { dht.begin(); Serial.begin(9600); }\n\nvoid loop() {\n  float t = dht.readTemperature();\n  float h = dht.readHumidity();\n  Serial.print(t); Serial.print(\" C / \"); Serial.print(h); Serial.println(\" %\");\n  delay(2000);\n}",
    mistakes: ["DATA pini boşta bırakmak — 10kΩ pull-up şart (çıplak sensörde)", "2 saniyeden sık ölçüm — sensör değer döndüremez, NaN alırsın", "Kabloları gevşek takmak — en yaygın 'NaN hatası' sebebi budur"],
    wokwi: { type: "wokwi-dht22", pinMap: { VCC: "VCC", DATA: "SDA", SDA: "SDA", GND: "GND" } } },
  { cat: "Sensörler", icon: "📏", name: "HC-SR04 Ultrasonik", desc: "Ses dalgasıyla 2-400 cm mesafe ölçer.", pins: ["VCC", "TRIG", "ECHO", "GND"], tip: "ECHO pini 5V çıkarır; 3.3V kartlarda gerilim bölücü kullan.",
    code: "const int TRIG = 5, ECHO = 6;\n\nvoid setup() {\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  digitalWrite(TRIG, LOW); delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH); delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long sure = pulseIn(ECHO, HIGH, 30000);\n  int cm = sure / 58;   // 58 µs = 1 cm\n  Serial.println(cm);\n  delay(100);\n}",
    mistakes: ["pulseIn'e timeout vermemek — engel yoksa kod kilitlenir", "Kesin 58'e bölmeyi unutmak — çıplak µs karışıklığı", "Sensörü yumuşak yüzeye doğrultmak — ses dağılır, ölçüm şaşar"],
    wokwi: { type: "wokwi-hc-sr04", pinMap: { VCC: "VCC", TRIG: "TRIG", TETIK: "TRIG", ECHO: "ECHO", GND: "GND" } } },
  { cat: "Sensörler", icon: "👀", name: "HC-SR501 PIR", desc: "İnsan hareketini algılar; 7 m, 110° görüş alanı.", pins: ["VCC", "OUT", "GND"], tip: "Açıldıktan sonra 30-60 sn ısınma süresi vardır.",
    code: "const int PIR = 2;\n\nvoid setup() {\n  pinMode(PIR, INPUT);\n  Serial.begin(9600);\n  delay(30000);  // Isınma süresi\n}\n\nvoid loop() {\n  if (digitalRead(PIR)) Serial.println(\"HAREKET!\");\n  delay(200);\n}",
    mistakes: ["Isınma süresini beklemeden test — sahte alarmlar", "Cam arkasına monte etmek — PIR camı göremez", "Radyatör/klima yanına koymak — ısı değişimi sahte alarm verir"],
    wokwi: { type: "wokwi-pir-motion-sensor", pinMap: { VCC: "VCC", OUT: "OUT", CIKI: "OUT", GND: "GND" } } },
  { cat: "Sensörler", icon: "🌱", name: "Toprak Nem Sensörü", desc: "Toprağın nemini analog değer olarak verir.", pins: ["VCC", "GND", "AO"], tip: "Kaplamalı model al; sıradan olan zamanla paslanır.",
    code: "const int NEM = A0;\n\nvoid setup() { Serial.begin(9600); }\n\nvoid loop() {\n  int ham = analogRead(NEM);           // Kuru ~800+, ıslak ~300\n  int yuzde = map(ham, 1023, 300, 0, 100);\n  yuzde = constrain(yuzde, 0, 100);\n  Serial.println(yuzde);\n  delay(1000);\n}",
    mistakes: ["Kalibrasyon yapmadan eşik değer uydurmak", "Elektronik kısmı toprağa gömmek — sensör ölür", "DO (dijital) pinini okuyup AO'yu atlamak — hassasiyet kaybı"],
    wokwi: null },
  { cat: "Sensörler", icon: "🎛️", name: "LDR (Fotodirenç)", desc: "Işık şiddetine göre direnci değişen ucuz sensör.", pins: ["10kΩ bölücü", "A0"], tip: "Analog pinden oku; değer karanlıkta yüksektir.",
    code: "const int LDR = A0;\n\nvoid setup() { Serial.begin(9600); }\n\nvoid loop() {\n  int isik = analogRead(LDR);   // Karanlık: ~1000, aydınlık: ~50\n  Serial.println(isik);\n  delay(300);\n}",
    mistakes: ["Gerilim bölücü kurmadan doğrudan 5V'a bağlamak", "Değer yönünü ters varsaymak — önce seri monitörle gözle", "Sensörü kendi LED'inin önüne koymak — kendini aydınlatır"],
    wokwi: { type: "wokwi-photoresistor-sensor", pinMap: { VCC: "VCC", GND: "GND", AO: "AO", ISIK: "AO" } } },
  { cat: "Motor & Sürücü", icon: "🛞", name: "L298N Sürücü", desc: "İki DC motoru 2A'ya kadar sürer; PWM hız kontrolü.", pins: ["IN1-4", "ENA/ENB", "12V", "GND"], tip: "PWM jumperlarını çıkarıp ENA/ENB'ye pin bağla.",
    code: "// ENA=5, IN1=6, IN2=7\nvoid sur(int hiz) {\n  digitalWrite(6, HIGH); digitalWrite(7, LOW);\n  analogWrite(5, hiz);   // 0-255\n}\n\nvoid dur() { analogWrite(5, 0); }",
    mistakes: ["Motorları doğrudan Arduino pinine bağlamak — kart yanar", "PWM jumper'ı takılıyken ENA'ya kablo bağlamak", "Toprakları birleştirmemek — motorlar saçmalar"],
    wokwi: null },
  { cat: "Motor & Sürücü", icon: "🔄", name: "SG90 Servo Motor", desc: "0-180° dönebilen küçük servo; robot kolların temeli.", pins: ["Turuncu: Sinyal", "Kırmızı: 5V", "Kahve: GND"], tip: "Birden fazla servo için harici 5V besleme şart.",
    code: "#include <Servo.h>\nServo srv;\n\nvoid setup() { srv.attach(9); }\n\nvoid loop() {\n  srv.write(0);   delay(1000);\n  srv.write(90);  delay(1000);\n  srv.write(180); delay(1000);\n}",
    mistakes: ["Servoyu USB üzerinden doğrudan beslemek — reset yersin", "Mekanik sıkışma varken zorlamak — dişli kırılır", "attach() çağırmadan write() — motor çalışmaz"],
    wokwi: { type: "wokwi-servo", pinMap: { SINYAL: "PWM", SARI: "PWM", TURUNCU: "PWM", "5V": "V+", KIRMIZI: "V+", KAHVE: "GND" } } },
  { cat: "Motor & Sürücü", icon: "🌀", name: "28BYJ-48 Step Motor", desc: "ULN2003 kartıyla çalışan hassas adım motoru.", pins: ["IN1-4", "GND", "5V"], tip: "Küçük projeler için ideal; torku düşüktür.",
    code: "#include <Stepper.h>\n// 2048 adım = 1 tam tur (28BYJ-48)\nStepper stp(2048, 8, 10, 9, 11);\n\nvoid setup() { stp.setSpeed(10); }\n\nvoid loop() {\n  stp.step(2048);  // 1 tur\n  delay(500);\n}",
    mistakes: ["Sıralıya (IN1,2,3,4) bağlamak — motor titrer döner (sıra 1,3,2,4 olmalı)", "Hızı 15 RPM üstü yapmak — tork düşer, adım atlar", "Beslemeyi Arduino 5V'tan almak — kart resetler"],
    wokwi: { type: "wokwi-stepper-motor", pinMap: { IN1: "IN1", IN2: "IN2", IN3: "IN3", IN4: "IN4" } } },
  { cat: "Ekran & Çıkış", icon: "📺", name: "16x2 I2C LCD", desc: "İki satırlık karakter ekran; 4 kablo ile çalışır.", pins: ["SDA→A4", "SCL→A5", "VCC", "GND"], tip: "Adres genelde 0x27; çalışmazsa 0x3F dene.",
    code: "#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27, 16, 2);\n\nvoid setup() {\n  lcd.init(); lcd.backlight();\n  lcd.print(\"Merhaba!\");\n}\nvoid loop() {}",
    mistakes: ["Yanlış I2C adresi — I2C Scanner ile bul", " lcd.clear() çağırmadan yeniden yazmak — eski karakterler kalır", "16 karakterden uzun yazmak — taşan kısım görünmez"],
    wokwi: { type: "wokwi-lcd1602", attrs: { pins: "i2c" }, pinMap: { SDA: "SDA", SCL: "SCL", VCC: "VCC", GND: "GND" } } },
  { cat: "Ekran & Çıkış", icon: "🔴", name: 'SSD1306 OLED 0.96"', desc: "Keskin grafik ekran; I2C ile sadece 4 kablo.", pins: ["SDA", "SCL", "VCC", "GND"], tip: "Adafruit SSD1306 veya U8g2 kütüphanesini kullan.",
    code: "#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 dsp(128, 64, &Wire, -1);\n\nvoid setup() {\n  dsp.begin(SSD1306_SWITCHCAPVCC, 0x3C);\n  dsp.setTextSize(1); dsp.setTextColor(WHITE);\n  dsp.print(\"Merhaba!\");\n  dsp.display();\n}\nvoid loop() {}",
    mistakes: ["Adres 0x3C ile 0x3D arasında değişir — scanner kullan", "display() çağırmayı unutmak — ekranda hiçbir şey çıkmaz", "buffer'a çizip display() olmadan döngü kurmak — kare atlar"],
    wokwi: { type: "wokwi-ssd1306", pinMap: { SDA: "DATA", SCL: "CLK", VCC: "VIN", GND: "GND" } } },
  { cat: "Ekran & Çıkış", icon: "🔔", name: "Buzzer", desc: "tone() fonksiyonuyla melodi ve alarm çalar.", pins: ["(+) → Dijital pin", "(−) → GND"], tip: "Pasif buzzerla melodi çalabilirsin; aktif buzzer tek ton öter.",
    code: "const int BUZ = 8;\n\nvoid setup() {}\n\nvoid loop() {\n  tone(BUZ, 1000, 200);   // 1 kHz, 200 ms\n  delay(400);\n  tone(BUZ, 1500, 200);\n  delay(400);\n}",
    mistakes: ["Aktif/pasif buzzer karıştırmak — pasif olan DC ile ötmez", "tone() süresi vermeden delay'le yönetmeye çalışmak", "Uzun kablo ile sürmek — ses kısık çıkar"],
    wokwi: { type: "wokwi-buzzer", pinMap: { "+": "1", EKSİ: "2", GND: "2" } } },
  { cat: "Girdi & Diğer", icon: "🔘", name: "Buton", desc: "En temel giriş; INPUT_PULLUP ile dirençsiz bağlanır.", pins: ["Pin ↔ GND"], tip: "Buton titreşimi için 50 ms debounce beklemesi ekle.",
    code: "const int BTN = 2;\n\nvoid setup() {\n  pinMode(BTN, INPUT_PULLUP);   // basılı = LOW\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  if (!digitalRead(BTN)) {\n    Serial.println(\"Basili!\");\n    delay(50);   // debounce\n  }\n}",
    mistakes: ["INPUT_PULLUP yerine INPUT kullanıp harici direnç eklememek — pin havada kalır", "Debounce'sız sayım — tek basış 5 kez sayılır", "Buton bacaklarını yanlış çiftten bağlamak — 4 bacaklı butonlarda kolay hata"],
    wokwi: { type: "wokwi-pushbutton", pinMap: { "1": "1.l", "2": "2.l" } } },
  { cat: "Girdi & Diğer", icon: "🎚️", name: "Potansiyometre", desc: "Çevrilerek 0-1023 analog değer üreten ayar düğmesi.", pins: ["Orta → A0", "Kenar → 5V/GND"], tip: "Kenar bacakları ters bağlarsan sadece yön değişir.",
    code: "const int POT = A0;\n\nvoid setup() { Serial.begin(9600); }\n\nvoid loop() {\n  int d = analogRead(POT);   // 0-1023\n  Serial.println(d);\n  delay(100);\n}",
    mistakes: ["Orta bacağı 5V'a bağlamak — değer hep 0 veya 1023", "LED parlaklığı için 1023'ü analogWrite'a direkt vermek — 0-255 aralığına map() et", "Zayıf temas — pot kirlenince değer sıçrar"],
    wokwi: { type: "wokwi-potentiometer", pinMap: { SIG: "SIG", ORTA: "SIG", VCC: "VCC", GND: "GND" } } },
  { cat: "Girdi & Diğer", icon: "📡", name: "HC-05 Bluetooth", desc: "Telefondan seri haberleşme ile projeyi kontrol et.", pins: ["TX→RX", "RX→TX", "VCC", "GND"], tip: "RX pini 3.3V'tur; 5V TX hattına gerilim bölücü koy.",
    code: "#include <SoftwareSerial.h>\nSoftwareSerial bt(2, 3);   // RX, TX\n\nvoid setup() {\n  bt.begin(9600);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  if (bt.available()) Serial.write(bt.read());\n  if (Serial.available()) bt.write(Serial.read());\n}",
    mistakes: ["RX'i 5V'a direkt bağlamak — modül yanar", "TX/RX çaprazlamayı unutmak — haberleşme sessiz kalır", "AT moduna girmek için EN pini 3.3V yapmamak — ayar değiştirilemez"],
    wokwi: null },
  { cat: "Girdi & Diğer", icon: "📶", name: "ESP8266 (Wi-Fi)", desc: "Arduino'ya Wi-Fi kazandırır ya da tek başına karttır.", pins: ["TX/RX", "3.3V", "GND"], tip: "3.3V ile beslenir — 5V bağlama, yanar!",
    code: "// ESP8266 tek başına kullanım (NodeMCU)\n#include <ESP8266WiFi.h>\n\nvoid setup() {\n  Serial.begin(115200);\n  WiFi.begin(\"agAdi\", \"sifre\");\n  while (WiFi.status() != WL_CONNECTED) delay(500);\n  Serial.println(\"Baglandi!\");\n}\n\nvoid loop() {}",
    mistakes: ["5V besleme — anında yanar", "TX'i 5V hattına bağlamak — ESP RX'i zarar görür", "Güç yetersizliği — Wi-Fi çekişi 300 mA ister, USB portu yetmez"],
    wokwi: null }
];

function renderLib(cat = "Hepsi") {
  currentLibCat = cat;
  const catsEl = $("libCats");
  const gridEl = $("libGrid");
  catsEl.innerHTML = LIB_CATS.map((c) =>
    `<button class="lib-cat${c === cat ? " active" : ""}" data-cat="${esc(c)}" type="button">${esc(t(c))}</button>`).join("");
  const items = ALL_LIB().filter((x) => cat === "Hepsi" || x.cat === cat);
  if (!items.length) {
    gridEl.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="big">⭐</span><p>' +
      esc(t("Özel set boş. Aşağıdan JSON içe aktar veya bileşenleri elle ekle.")) + '</p></div>';
  } else {
  gridEl.innerHTML = items.map((x, i) =>
    `<div class="lib-card" data-lib="${esc(x.name)}" role="button" tabindex="0" aria-label="${esc(x.name)} detayları">
      <span class="icon">${x.icon}</span>
      <h4>${esc(x.name)}</h4>
      <p class="desc">${esc(x.desc)}</p>
      <div class="pin-row">${(x.pins || []).map((p) => `<span class="pin-badge">${esc(p)}</span>`).join("")}</div>
      <div class="lib-tip">💡 ${esc(x.tip)}</div>
      <div style="margin-top:0.6rem"><button class="btn btn-ghost btn-small" data-lib-btn="${esc(x.name)}" type="button">${esc(t("🔍 Detaylar"))}</button></div>
    </div>`).join("");
  }
  catsEl.querySelectorAll("[data-cat]").forEach((b) =>
    b.addEventListener("click", () => renderLib(b.dataset.cat)));
  gridEl.querySelectorAll("[data-lib]").forEach((card) => {
    const open = () => {
      const comp = ALL_LIB().find((c) => c.name === card.dataset.lib);
      if (comp) openCompModal(comp);
    };
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-lib-btn]")) { open(); return; }
      if (e.target.closest("button")) return;
      open();
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });
}

/* ───────────────────── Bileşen Detay Modalı ───────────────────── */
const compModal = $("compModal");
let currentLibCat = "Hepsi";

function openCompModal(comp) {
  $("compTitle").textContent = comp.icon + " " + comp.name;
  $("compBody").innerHTML = `
    <div class="comp-head">
      <span class="icon">${comp.icon}</span>
      <div>
        <h3>${esc(comp.name)}</h3>
        <p style="color:var(--text-dim)">${esc(comp.desc)}</p>
      </div>
    </div>
    <div class="comp-sec">
      <h4>${esc(t("📌 Pinler / Bağlantı"))}</h4>
      <div class="comp-pinrow">${(comp.pins || []).map((p) => `<span class="comp-pin">${esc(p)}</span>`).join("")}</div>
    </div>
    <div class="comp-sec">
      <h4>${esc(t("💻 Örnek Kod Parçası"))}</h4>
      <pre>${esc(comp.code || "// Yakında")}</pre>
    </div>
    <div class="comp-sec">
      <h4>${esc(t("⚠️ Sık Yapılan Hatalar"))}</h4>
      <ul>${(comp.mistakes || [comp.tip || ""]).filter(Boolean).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
    </div>` +
    (comp.wokwi ? `
    <div class="comp-sec">
      <h4>${esc(t("🧩 Wokwi Simülasyonu"))}</h4>
      <p style="margin:0 0 .35rem"><code>${esc(comp.wokwi.type)}</code></p>
      <div class="comp-pinrow">${Object.keys(comp.wokwi.pinMap || {}).map((k) => `<span class="comp-pin">${esc(k)} → ${esc(comp.wokwi.pinMap[k])}</span>`).join("")}</div>
      <p class="field-hint" style="margin:.4rem 0 0">${esc(t("Rehber üretirken bu eşlemeler Wokwi devre taslağında otomatik kullanılır."))}</p>
    </div>` : "");
  compModal.hidden = false;
}
function closeCompModal() {
  compModal.hidden = true;
}
$("closeComp").addEventListener("click", closeCompModal);
compModal.addEventListener("click", (e) => {
  if (e.target === compModal) closeCompModal();
});

/* ───────────────────── Özel Bileşen Seti Arayüzü ───────────────────── */
function libCustomFormHTML() {
  return `
    <p class="modal-desc" style="margin-top:0">${t("Bileşen adı, pinleri ve (varsa) Wokwi parça tipi gir. Wokwi verisi girersen rehber üretiminde otomatik kullanılır.")}</p>
    <form id="libCustomForm" autocomplete="off">
      <div class="field-group">
        <label for="lcName">${t("Bileşen adı")} *</label>
        <input type="text" id="lcName" required maxlength="60" placeholder="${t("örn. MQ-2 Gaz Sensörü")}" />
      </div>
      <div class="field-group">
        <label for="lcIcon">${t("Simge (emoji)")}</label>
        <input type="text" id="lcIcon" maxlength="4" placeholder="⭐" />
      </div>
      <div class="field-group">
        <label for="lcDesc">${t("Açıklama")}</label>
        <input type="text" id="lcDesc" maxlength="300" placeholder="${t("Ne işe yarar?")}" />
      </div>
      <div class="field-group">
        <label for="lcPins">${t("Pinler (virgülle)")}</label>
        <input type="text" id="lcPins" placeholder="${t("örn. VCC, GND, AO")}" />
      </div>
      <div class="field-group">
        <label for="lcTip">${t("İpucu")}</label>
        <input type="text" id="lcTip" maxlength="200" placeholder="${t("Öğrencilerin bilmesi gereken püf noktası")}" />
      </div>
      <div class="field-group">
        <label for="lcWokwiType">Wokwi parça tipi <span style="font-weight:400;color:var(--text-dim)">(${t("isteğe bağlı")})</span></label>
        <input type="text" id="lcWokwiType" spellcheck="false" placeholder="örn. wokwi-photoresistor-sensor" />
        <p class="field-hint">${t("Sadece gerçek Wokwi tipleri. Wokwi'de olmayan parçalar için boş bırak.")}</p>
      </div>
      <div class="field-group">
        <label for="lcWokwiPins">${t("Pin eşlemesi (kelime → Wokwi pin adı, virgülle)")}</label>
        <input type="text" id="lcWokwiPins" spellcheck="false" placeholder="${t("örn. AO → AO, VCC → VCC, GND → GND")}" />
        <p class="field-hint">${t("Rehberde geçecek pin kelimeleri Wokwi pin adına çevrilir.")}</p>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="lcCancel">${t("Vazgeç")}</button>
        <button type="submit" class="btn btn-primary">${t("Sete Ekle")}</button>
      </div>
    </form>`;
}
function openLibCustomForm() {
  $("compTitle").textContent = "➕ " + t("Özel Bileşen Ekle");
  $("compBody").innerHTML = libCustomFormHTML();
  compModal.hidden = false;
  $("libCustomForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = ($("lcName").value || "").trim();
    if (!name) return;
    // "AO → AO, VCC → VCC" biçimini pinMap'e çevir
    const pinMap = {};
    String($("lcWokwiPins").value || "").split(",").forEach((pair) => {
      const arrow = pair.split(/→|->|:/);
      if (arrow.length === 2) {
        const k = arrow[0].trim(), v = arrow[1].trim();
        if (k && v) pinMap[k] = v;
      }
    });
    const wokwiType = String($("lcWokwiType").value || "").trim();
    const comp = normalizeLibCustom({
      name,
      icon: ($("lcIcon").value || "").trim() || "⭐",
      desc: ($("lcDesc").value || "").trim(),
      pins: String($("lcPins").value || "").split(",").map((p) => p.trim()).filter(Boolean),
      tip: ($("lcTip").value || "").trim(),
      wokwi: wokwiType ? { type: wokwiType, pinMap } : null
    });
    const current = loadLibCustom();
    const at = current.findIndex((x) => x.name.toLowerCase() === comp.name.toLowerCase());
    if (at >= 0) current[at] = comp; else current.push(comp);
    saveLibCustom(current);
    closeCompModal();
    renderLib(LIB_CUSTOM_CAT);
    showError(t("✅ Bileşen özel sete eklendi."));
    errorBanner.classList.add("info");
    setTimeout(() => { errorBanner.classList.remove("info"); errorBanner.hidden = true; }, 6000);
  });
  $("lcCancel").addEventListener("click", closeCompModal);
}
(function initLibIO() {
  const addBtn = $("libCustomAddBtn");
  const expBtn = $("libExportBtn");
  const impBtn = $("libImportBtn");
  const fileInput = $("libImportFile");
  if (addBtn) addBtn.addEventListener("click", openLibCustomForm);
  if (expBtn) expBtn.addEventListener("click", () => {
    if (!loadLibCustom().length) { showError(t("Özel set boş — önce bileşen ekle.")); return; }
    libExportSet();
  });
  if (impBtn && fileInput) {
    impBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) libImportSet(f);
      fileInput.value = "";
    });
  }
})();
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !compModal.hidden) closeCompModal();
});

/* ───────────────────── Dil (TR/EN) ───────────────────── */
const LANG_KEY = "arduinoDreamLab.lang.v1";
const I18N = {
  en: {
    // Header & genel
    "⚙️ Ayarlar": "⚙️ Settings", "📚 Kütüphane": "📚 Library", "🗂️ Arşiv": "🗂️ Archive",
    "Demo Modu": "Demo Mode", " Bağlı": " Connected",
    // Hero
    "🤖 YAPAY ZEKÂ DESTEKLİ ÖĞRENME ATÖLYESİ": "🤖 AI-POWERED LEARNING WORKSHOP",
    "🤖 Yapay Zekâ Destekli Öğrenme Atölyesi": "🤖 AI-Powered Learning Workshop",
    "Hayalindeki projeyi yaz,": "Write the project of your dreams,",
    "gerçekleştirmenin yolunu öğren.": "learn the way to make it real.",
    "İpucu: Amaç, sensör ve ortam bilgisi verirsen rehber çok daha isabetli olur.": "Tip: The more you say about purpose, sensors and environment, the better the guide.",
    "🚗 Çizgi izleyen yarış arabası": "🚗 Line-following race car",
    "🌡️ Odam için akıllı termostat": "🌡️ Smart thermostat for my room",
    "🌱 Otomatik sulayan akıllı saksı": "🌱 Self-watering smart planter",
    "🚨 Hareket algılayan güvenlik sistemi": "🚨 Motion-detecting security system",
    "🦾 Basit robot kol": "🦾 Simple robot arm",
    "Öğrencilerin en çok kullandığı Arduino parçaları — pinleri ve püf noktalarıyla.": "The Arduino parts students use most — with pins and pro tips.",
    "Yapmak istediğin projeyi kendi cümlelerinle yaz. Detay ne kadar fazlaysa rehber o kadar özelleşir.": "Describe the project you want in your own words. The more detail, the more tailored your guide.",
    "AI; malzeme listesi, bağlantı şeması, güvenlik notları ve adım adım rehberi hazırlar.": "The AI prepares the materials list, wiring diagram, safety notes and a step-by-step guide.",
    "Kodu kopyala, devreyi kur, çalıştır. Her adımda ne yaptığını ve neden yaptığını anla.": "Copy the code, build the circuit, run it. Understand what and why at every step.",
    "Lütfen proje fikrini biraz daha detaylı yaz 🙂": "Please describe your project idea in a bit more detail 🙂",
    "Yapay zekâ yanıtı alınamadı: ": "AI request failed: ",
    "API anahtarını Ayarlar'dan kontrol edebilir, ya da demo moduyla devam edebilirsin.": "Check the API key in Settings, or continue in demo mode.",
    // Sağlayıcı etiketleri
    "Groq (Hızlı & Ücretsiz Kota)": "Groq (Fast & Free Tier)",
    "OpenRouter (çoklu model)": "OpenRouter (multi-model)",
    "Özel / OpenAI Uyumlu (Ollama vb.)": "Custom / OpenAI-compatible (Ollama etc.)",
    "API Anahtarı (gerekmiyorsa boş bırak)": "API Key (leave empty if not needed)",
    "Sunucu Adresi (Base URL)": "Server Address (Base URL)",
    // Şema
    "⚡ Bağlantı Şeması": "⚡ Wiring Diagram",
    "Renkler kablo grubunu gösterir — yerleşim temsilidir.": "Colors indicate wire group — layout is illustrative.",
    "Dijital pin": "Digital pin", "Güç (5V / 3.3V)": "Power (5V / 3.3V)", "Analog pin": "Analog pin",
    "Bu rehber için şema verisi yok.": "No wiring data for this guide.",
    // Yükleniyor
    "Hayalin analiz ediliyor…": "Analyzing your dream…",
    "Malzemeler seçiliyor…": "Picking components…",
    "Devre bağlantıları çiziliyor…": "Drawing the wiring…",
    "Kod yazılıyor ve yorumlanıyor…": "Writing and annotating code…",
    "Son rötuşlar…": "Final touches…",
    // İstatistik
    "Üretim:": "Runs:", "Başarılı:": "Success:", "Ort. süre:": "Avg time:", "Toplam token:": "Total tokens:", "Tahmini maliyet:": "Est. cost:",
    "Zaman": "When", "Sağlayıcı": "Provider", "Süre": "Time", "Token (g+ç)": "Tokens (in+out)", "Maliyet": "Cost",
    "Henüz üretim kaydı yok. Rehber oluşturdukça süre ve token kullanımı burada birikir.": "No runs yet. Generate guides to collect timing and token usage here.",
    // Arşiv
    "İsimsiz proje": "Untitled project", " parça": " parts",
    "Henüz kaydedilmiş proje yok.": "No saved projects yet.",
    "Bir rehber oluşturduğunda otomatik olarak burada birikir.": "Guides are collected here automatically as you create them.",
    " proje geri yüklendi.": " projects restored.",
    "Yedek dosyası okunamadı: ": "Could not read backup file: ",
    "Geçersiz biçim: 'items' dizisi bulunamadı": "Invalid format: 'items' array not found",
    "Dosyada geçerli rehber yok": "No valid guides in the file",
    // PDF & paylaşım
    "Arduino Rüya Atölyesi · Seviye: ": "Arduino Dream Workshop · Level: ",
    "Malzeme Listesi": "Materials List", "Devre Bağlantıları": "Circuit Wiring",
    "Adım Adım Yapım": "Step-by-Step Build", "İpuçları ve Güvenlik": "Tips & Safety", "Arduino Kodu": "Arduino Code",
    "Nereden": "From", "Nereye": "To", "Not": "Note",
    "Parça": "Part", "Adet": "Qty", "Görevi": "Purpose",
    "Birim Fiyat": "Unit Price", "Tutar": "Subtotal",
    "💰 Ortalama Proje Fiyatı": "💰 Estimated Project Total",
    "Bazı parçaların fiyatı katalogda yok": "Some parts are not in the price catalog",
    "Ortalama perakende fiyatı": "Average retail price",
    "Öğretmen fiyatı": "Teacher price",
    "Özel fiyatlar temizlendi — katalog fiyatları kullanılıyor.": "Custom prices cleared — catalog prices are back in effect.",
    "Hiç satır okunamadı — 'Parça adı: fiyat' biçimini kontrol et.": "No lines could be read — check the 'Part name: price' format.",
    "özel fiyat kaydedildi": "custom prices saved",
    "Bütçe aşımı": "over budget", "Sınır": "limit",
    "Katalog okunamadı — {prices: {...}} biçiminde olmalı.": "Could not read catalog — must be in {prices: {...}} format.",
    "Katalog içe aktarıldı": "Catalog imported", "bütçe": "budget",
    "Fiyata göre sırala": "Sort by price",
    "Bütçe önerisi": "Budget tip", "Arduino Uno yerine Arduino Nano kullan": "use Arduino Nano instead of Arduino Uno",
    "💡 Bu fikre benzer proje": "💡 A similar project costs about",
    "depo": "repo",
    /* v2.20.0: CSV tarih filtresi */
    "Başlangıç tarihi": "Start date", "Bitiş tarihi": "End date",
    "Filtreyi temizle — tüm gönderiler": "Clear filter — all submissions",
    /* v2.20.0: Arşiv favori/etiket */
    "Favoriden çıkar": "Remove from favorites", "Favorilere ekle": "Add to favorites",
    "Etiketleri düzenle (virgülle ayır, en çok 5)": "Edit tags (comma separated, max 5)",
    "Etiketler (virgülle ayır, örn. veli, dönem1):": "Tags (comma separated, e.g. parent, term1):",
    "Favoriden çıkarıldı": "Removed from favorites", "Favorilere eklendi": "Added to favorites",
    "Etiketler kaydedildi": "Tags saved",
    /* v2.20.0: Göz serbest */
    "👁️ Göz Serbest — Durdur": "👁️ Hands-free — Stop",
    "Sesli okuma başlatılamadı — bir adım kutusuna tıkla ve tekrar dene.": "Could not start speech — click a step box and try again.",
    "az önce": "just now", "saat önce": "h ago", "gün önce": "d ago", "hiç": "never", "güncellendi": "updated",
    "⏳ Kur güncelleniyor…": "⏳ Updating rate…",
    "Kur güncellendi": "Rate updated",
    "❌ Kur alınamadı — internet bağlantısını kontrol et. Saklanan kur kullanılıyor.": "❌ Could not fetch rate — check your connection. Using the stored rate.",
    "✨ AI tahmini": "✨ AI estimate", "bazı parçalar fiyatlanmadı": "some parts unpriced",
    "öğrenci ×": "students ×", "öğretmen bütçesini aşıyor": "over teacher budget",
    "Seviye: ": "Level: ", "🧰 Malzemeler:": "🧰 Materials:", "🔗 Bağlantılar:": "🔗 Wiring:",
    "📱 Arduino Rüya Atölyesi'nden paylaşıldı": "📱 Shared from Arduino Dream Workshop",
    "Senin hayalin hangi proje? ✨": "What's your dream project? ✨",
    "🚀 Rehberi Oluştur": "🚀 Generate Guide",
    "Fikirine mi bakıyorsun?": "Need inspiration?",
    // Nasıl çalışır
    "Nasıl çalışır?": "How it works?",
    "Hayalini Anlat": "Describe Your Dream",
    "Yapay Zekâ Planlasın": "Let AI Plan It",
    "Uygula & Öğren": "Build & Learn",
    // Rehber bölümleri
    " Malzeme Listesi": " Materials List", " Devre Bağlantıları": " Circuit Wiring",
    " Adım Adım Yapım": " Step-by-Step Build", " İpuçları & Güvenlik": " Tips & Safety",
    " Arduino Kodu": " Arduino Code",
    "📄 PDF İndir": "📄 Download PDF", "💬 WhatsApp'ta Paylaş": "💬 Share on WhatsApp",
    "Alışveriş Listesi": "Shopping List", "🔍 Ara: öğrenci veya proje…": "🔍 Search: student or project…",
    /* v2.21.0: Arşiv arama */
    "🔍 Ara: başlık, fikir veya etiket…": "🔍 Search: title, idea or tag…",
    /* v2.21.0: CSV son etkinlik */
    "Önceki sayfa": "Previous page", "Sonraki sayfa": "Next page",
    "💾 Arşive Kaydet": "💾 Save to Archive", "✅ Arşivde!": "✅ Archived!", "ℹ️ Zaten arşivde": "ℹ️ Already archived",
    "📋 Kopyala": "📋 Copy", "✅ Kopyalandı!": "✅ Copied!", "❌ Kopyalanamadı": "❌ Copy failed",
    "🔄 Yeni Fikir Dene": "🔄 Try a New Idea",
  "Wokwi'de Dene": "Try in Wokwi",
  "⚡ Kod panoya kopyalandı! ": "⚡ Code copied! ",
  "🧩 diagram.json taslağı panoya kopyalandı! ": "🧩 diagram.json skeleton copied! ",
  "❌ Kod panoya kopyalanamadı — Wokwi'ye elle yapıştır.": "❌ Could not copy code — paste into Wokwi manually.",
  "🎤 Mikrofonla anlat…": "🎤 Speak your idea…",
  "🎤 Dinliyorum…": "🎤 Listening…",
  "Tarayıcın sesli girişi desteklemiyor — Chrome veya Edge dene.": "Your browser doesn't support speech input — try Chrome or Edge.",
  "Mikrofon izni reddedildi.": "Microphone permission denied.",
  "❌ Ses tanıma hatası: ": "❌ Speech recognition error: ",
  // Sertifika
  "🎉 Tüm adımları tamamladın!": "🎉 You completed all steps!",
  "Sertifikanı oluştur — adını yaz, PDF otomatik iner:": "Create your certificate — type your name, the PDF downloads automatically:",
  "Adın": "Your name",
  "🏅 Sertifika Oluştur": "🏅 Create Certificate",
  "🏅 PDF indiriliyor — pencereyi de yazdırabilirsin!": "🏅 Downloading PDF — you can also print the window!",
  "⬇️ PDF İndir": "⬇️ Download PDF",
  "🖼️ Kart PNG": "🖼️ Card PNG",
  "1080×1080 paylaşım kartı": "1080×1080 share card",
  // Wokwi paketi + Sınıf Modu
  "Wokwi Paketi (.zip)": "Wokwi Package (.zip)",
  "🏫 Sınıf Modu": "🏫 Class Mode",
  "Sınıf kodu": "Class code",
  "Üret": "Generate",
  "Gönderim İçe Aktar": "Import Submissions",
  "Sınıf Raporu (PDF)": "Class Report (PDF)",
  "Gönderiler": "Submissions",
  "Adımlarını öğretmenine gönder": "Send your steps to your teacher",
  "📋 Gönderim Dosyası İndir": "📋 Download Submission File",
  "✍️ Önce adını yaz.": "✍️ Type your name first.",
  // Geri bildirim
  "Geri Bildirimi Göster": "Show Feedback",
  "Öğretmeninden geri bildirim": "Feedback from your teacher",
  "Geri Bildirim": "Feedback",
  "Öğretmen yorumu…": "Teacher's comment…",
  "✍️ Önce yorum yaz.": "✍️ Write a comment first.",
  "💬 Geri bildirim yüklendi.": "💬 Feedback loaded.",
  "❌ Dosya okunamadı — beklenen biçim .geribildirim dosyası.": "❌ File could not be read — expected a .geribildirim feedback file.",
  // Başarımlar + panel + ileri seviye
  "🏅 Sertifikalar": "🏅 Certificates",
  "Henüz sertifikan yok — bir rehberin tüm adımlarını bitirip sertifika oluştur!": "No certificates yet — finish all steps of a guide and create one!",
  "💬 Öğretmen geri bildirimleri": "💬 Teacher feedback",
  "Henüz geri bildirim okunmadı — öğretmeninden .geribildirim dosyası alıp rehberde \"Geri Bildirimi Göster\" ile aç.": "No feedback read yet — get a .geribildirim file from your teacher and open it via \"Show Feedback\" in a guide.",
  "Henüz gönderi yok — öğrenci \"📋 Gönderim Dosyası İndir\" ile dosya üretir, sen buradan içe aktarırsın.": "No submissions yet — the student creates a file via \"Download Submission File\" and you import it here.",
  "🚀 İleri Seviye": "🚀 Advanced Level",
  // Toplu geri bildirim + yedek (v2.9.0)
  "Toplu Geri Bildirim": "Bulk Feedback",
  "Hepsini İndir": "Download All",
  "yorumu": "feedback",
  "📤 Yedeği Dışa Aktar": "📤 Export Backup",
  "📥 Yedeği Geri Yükle": "📥 Restore Backup",
  // Portfolyo + rozet kademeleri (v2.8.0)
  "Portfolyo.zip": "Portfolio.zip",
  "Sertifikalı tüm rehberlerin Wokwi paketlerini tek zip'te indir": "Download the Wokwi packages of all certified guides in one zip",
  // Wokwi doğrulama
  "Devre kontrolü temiz": "Circuit check passed",
  // Özel set
  "⭐ Özel set: kendi bileşenlerini ekle, JSON ile sınıfınla paylaş — bu tarayıcıda saklanır.": "⭐ Custom set: add your own components, share via JSON with your class — stored in this browser.",
  "➕ Bileşen Ekle": "➕ Add Component",
  "📤 Seti Dışa Aktar": "📤 Export Set",
  "📥 Set İçe Aktar": "📥 Import Set",
  "➕ Özel Bileşen Ekle": "➕ Add Custom Component",
  "Bileşen adı": "Component name",
  "örn. MQ-2 Gaz Sensörü": "e.g. MQ-2 Gas Sensor",
  "Simge (emoji)": "Icon (emoji)",
  "Açıklama": "Description",
  "Ne işe yarar?": "What does it do?",
  "Pinler (virgülle)": "Pins (comma separated)",
  "örn. VCC, GND, AO": "e.g. VCC, GND, AO",
  "İpucu": "Pro tip",
  "Öğrencilerin bilmesi gereken püf noktası": "The trick students should know",
  "isteğe bağlı": "optional",
  "Sadece gerçek Wokwi tipleri. Wokwi'de olmayan parçalar için boş bırak.": "Only real Wokwi types. Leave empty for parts Wokwi doesn't have.",
  "Pin eşlemesi (kelime → Wokwi pin adı, virgülle)": "Pin mapping (word → Wokwi pin name, comma separated)",
  "örn. AO → AO, VCC → VCC, GND → GND": "e.g. AO → AO, VCC → VCC, GND → GND",
  "Rehberde geçecek pin kelimeleri Wokwi pin adına çevrilir.": "Pin words used in guides are translated to Wokwi pin names.",
  "Vazgeç": "Cancel",
  "Sete Ekle": "Add to Set",
  "✅ Bileşen özel sete eklendi.": "✅ Component added to the custom set.",
  "Özel set boş — önce bileşen ekle.": "Custom set is empty — add a component first.",
  "Özel set boş. Aşağıdan JSON içe aktar veya bileşenleri elle ekle.": "Custom set is empty. Import JSON below or add components manually.",
  "Bileşen adı, pinleri ve (varsa) Wokwi parça tipi gir. Wokwi verisi girersen rehber üretiminde otomatik kullanılır.": "Enter the component name, pins and (if any) Wokwi part type. With Wokwi data it is used automatically in guide generation.",
  "❌ Bileşen seti dosyası okunamadı — dışa aktarılan JSON biçimi bekleniyor.": "❌ Could not read the component set file — expected the exported JSON format.",
  // Paylaşım kartı
  "Kart Oluştur": "Create Share Card",
  // Kütüphane + arşiv + yardım
  "🧩 Wokwi Simülasyonu": "🧩 Wokwi Simulation",
  "Rehber üretirken bu eşlemeler Wokwi devre taslağında otomatik kullanılır.": "These mappings are used automatically when generating the Wokwi circuit skeleton.",
  "Sertifika üret": "Create certificate",
  "Sertifika için öğrenci adı:": "Student name for the certificate:",
  // Changelog modalı
  "📦 Sürüm Geçmişi": "📦 Version History",
  "Sürüm geçmişi dağıtım sürümünde gömülü değil.": "Version history is embedded in the distribution build.",
  "✅ Kart hazır!": "✅ Card ready!",
  "❌ Kart oluşturulamadı": "❌ Could not create card",
  // Wokwi taslağı
  "🧩 Wokwi Devre Taslağı": "🧩 Wokwi Circuit Skeleton",
  "❌ Kopyalanamadı — panoya erişilemedi.": "❌ Could not copy — clipboard unavailable.",
  // Sesli anlatım
  "🔊 Bana Anlat": "🔊 Read to Me",
  "⏹️ Durdur": "⏹️ Stop",
    // Ayarlar
    "⚙️ Yapay Zekâ Ayarları": "⚙️ AI Settings",
    "AI Sağlayıcısı": "AI Provider",
    "API Anahtarı": "API Key",
    "Anahtarı Temizle": "Clear Key",
    "Kaydet": "Save",
    "🔌 Bağlantıyı Test Et": "🔌 Test Connection",
    "⬇️ Getir": "⬇️ Fetch",
    "📊 Sağlayıcı İstatistikleri": "📊 Provider Stats",
    "💰 Model Fiyatı": "💰 Model Price",
    "(USD / 1M token)": "(USD / 1M tokens)",
    // Kütüphane
    "📚 Bileşen Kütüphanesi": "📚 Component Library",
    "Hepsi": "All", "Sensörler": "Sensors", "Motor & Sürücü": "Motors & Drivers",
    "Ekran & Çıkış": "Displays & Output", "Girdi & Diğer": "Input & Misc",
    "🔍 Detaylar": "🔍 Details",
    "📌 Pinler / Bağlantı": "📌 Pins / Wiring", "💻 Örnek Kod Parçası": "💻 Sample Code", "⚠️ Sık Yapılan Hatalar": "⚠️ Common Mistakes",
    // Arşiv
    "🗂️ Benim Projelerim": "🗂️ My Projects",
    // Sınıf paneli (v2.18.0)
    "Önerilen fiyatlar": "Suggested prices", "CSV İndir": "Download CSV",
    "Risk Altındaki Öğrenciler": "Students At Risk",
    "Fiyatlanamayan Malzemeler": "Unpriced Materials",
    // Arşiv
    "👁️ Görüntüle": "👁️ View", "📤 Yedekle (JSON)": "📤 Export (JSON)", "📥 Geri Yükle": "📥 Import", "🧹 Tümünü Temizle": "🧹 Clear All", "Kapat": "Close",
    // Adım takibi
    "🛠️": "🛠️", " adım tamamlandı (%": " steps done (%",
  },
  tr: {}
};

function t(text) {
  const lang = getLang();
  if (lang === "tr") return text;
  return I18N.en[text] ?? text;
}
function getLang() {
  return localStorage.getItem(LANG_KEY) || "tr";
}
function applyLang(lang) {
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang === "en" ? "en" : "tr";
  langToggle.textContent = lang === "en" ? "TR" : "EN";
  langToggle.title = lang === "en" ? "Türkçe'ye geç" : "Switch to English";
  const en = lang === "en";
  // Özel HTML'li öğeler
  const h1 = $("heroH1");
  if (h1) h1.innerHTML = en
    ? 'Write the project of your dreams,<br /><span class="grad-text">learn the way to make it real.</span>'
    : 'Hayalindeki projeyi yaz,<br /><span class="grad-text">gerçekleştirmenin yolunu öğren.</span>';
  const hs = $("heroSub");
  if (hs) hs.innerHTML = en
    ? 'Robot arm, smart greenhouse, line-following car… Describe your Arduino idea in one sentence. We\'ll prepare your <strong>materials list</strong>, <strong>circuit wiring</strong>, <strong>step-by-step build guide</strong> and <strong>working code</strong>.'
    : 'Robot kol, akıllı sera, çizgi izleyen araç… Aklındaki Arduino projesini tek cümleyle anlat. Sana <strong>malzeme listesi</strong>, <strong>devre bağlantıları</strong>, <strong>adım adım yapım rehberi</strong> ve <strong>çalışan kod</strong> hazırlayalım.';
  const sd = $("settingsDesc");
  if (sd) sd.innerHTML = en
    ? 'For live AI responses, enter an API key. The key is stored <strong>only in this browser</strong> and never sent to any server.'
    : 'Gerçek yapay zekâ yanıtları için bir API anahtarı gir. Anahtarın <strong>yalnızca bu tarayıcıda</strong> saklanır, hiçbir sunucuya gönderilmez.';
  const ft = $("footerText");
  if (ft) ft.innerHTML = en
    ? '🤖 <strong>Arduino Dream Workshop</strong> — An AI-powered project guide for students. The AI writes the code, the fun is yours!'
    : '🤖 <strong>Arduino Rüya Atölyesi</strong> — Öğrenciler için yapay zekâ destekli proje rehberi. Kodu üreten yapay zekâdır, eğlenmek senindir!';
  ideaInput.placeholder = en
    ? 'e.g., Can I build a smart greenhouse that measures temperature and runs a fan automatically?'
    : 'Örn: Sıcaklığı ölçüp fanı otomatik çalıştıran bir akıllı sera yapabilir miyim?';
  const modelLabel = document.querySelector('label[for="modelInput"] span');
  if (modelLabel) modelLabel.innerHTML = en ? 'Model <span style="font-weight:400;color:var(--text-dim)">(optional)</span>' : 'Model <span style="font-weight:400;color:var(--text-dim)">(isteğe bağlı)</span>';
  const priceLabel = document.querySelector('#priceGroup label span');
  if (priceLabel) priceLabel.innerHTML = en ? '💰 Model Price <span style="font-weight:400;color:var(--text-dim)">(USD / 1M tokens)</span>' : '💰 Model Fiyatı <span style="font-weight:400;color:var(--text-dim)">(USD / 1M token)</span>';
  translateStatic();
  updateStatusPill();
  renderLib(currentLibCat);
  renderStats();
  if (currentGuide) renderGuide(currentGuide, undefined, { scroll: false });
}
function translateStatic() {
  // İlk çağrıda orijinal (TR) metinleri sakla; sonra dile göre uygula
  const sel = "button, a.btn, .chip, h2, h3, label, .status-label, .hint, .lib-sub, .chips-title, .hero-eyebrow, .step-card p, .field-hint";
  document.querySelectorAll(sel).forEach((el) => {
    if (el.closest("#modelPicker") || el.hasAttribute("data-noi18n") || (el.dataset && el.dataset.noI18n)) return;
    if (el.children.length && !el.matches(".status-label, .hero-eyebrow, .chip")) return;
    if (el.querySelector("button, input, select, textarea, a")) return;
    if (el.dataset.i18nTr === undefined) el.dataset.i18nTr = el.textContent;
    const tr = el.dataset.i18nTr;
    if (getLang() === "en") {
      const enT = I18N.en[tr.trim()];
      if (enT) el.textContent = enT;
    } else {
      el.textContent = tr;
    }
  });
}

langToggle.addEventListener("click", () => {
  applyLang(getLang() === "en" ? "tr" : "en");
});

/* ───────────────────── Sürüm Rozeti + Changelog Modalı ───────────────────── */
function initChangelogModal() {
  const badge = $("versionBadge");
  const modal = $("changelogModal");
  const body = $("changelogBody");
  if (!badge || !modal || !body) return;
  if (typeof APP_VERSION !== "undefined") badge.textContent = "v" + APP_VERSION;
  badge.addEventListener("click", () => {
    // Changelog metni: dist'te gömülü (build.py), kaynakta dist/CHANGELOG.md'den okunur
    const html = window.__CHANGELOG_HTML || "";
    if (html) {
      body.innerHTML = html;
    } else {
      body.innerHTML = '<div class="empty-state"><span class="big">📦</span><p>' +
        t("Sürüm geçmişi dağıtım sürümünde gömülü değil.") + "</p></div>";
    }
    modal.hidden = false;
  });
  const close = () => { modal.hidden = true; };
  $("closeChangelog").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
}

/* ───────────────────── PWA Kaydı ───────────────────── */
function initPWA() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    // Aynı dizindeki sw.js; file:// protokolünde çalışmaz, sessizce geç
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ───────────────────── Başlangıç ───────────────────── */
updateStatusPill();
/* ══════════════════ SINIF MODU ══════════════════
   Öğretmen sınıf kodu üretir; öğrenci rehberinde adımlarını tamamlayıp
   kodu gönderir (Ayarlar → Sınıf Modu). Öğretmen gönderimleri içe aktarıp
   adım ilerlemelerini gösteren PDF sınıf raporu indirebilir. */
const CLASS_KEY = "arduinoDreamLab.classroom.v1";
const classModal = $("classModal");
$("classBtn").addEventListener("click", () => { openClassModal(); });
$("closeClass").addEventListener("click", closeClassModal);
classModal.addEventListener("click", (e) => {
  if (e.target === classModal) closeClassModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !classModal.hidden) closeClassModal();
  if (e.key === "Escape" && badgesModal && !badgesModal.hidden) closeBadgesModal();
});
/* 🏅 Başarımlar: sertifikalar + geri bildirimler */
const badgesModal = $("badgesModal");
$("badgesBtn").addEventListener("click", () => { openBadgesModal(); });
$("closeBadges").addEventListener("click", closeBadgesModal);
badgesModal.addEventListener("click", (e) => {
  if (e.target === badgesModal) closeBadgesModal();
});
updateBadgeCount();
function loadClassroom() {
  try { return JSON.parse(localStorage.getItem(CLASS_KEY)) || { code: "", submissions: {} }; }
  catch { return { code: "", submissions: {} }; }
}
function saveClassroom(c) {
  localStorage.setItem(CLASS_KEY, JSON.stringify(c));
}
function openClassModal() {
  const en = getLang() === "en";
  const c = loadClassroom();
  const subs = Object.values(c.submissions || {});
  const pending = subs.filter((s) => !s.fb);
  /* Gönderi listesi durumu: arama + sayfa (v2.19.0) — liste bölümü bağımsız yeniden çizilir,
     böylece arama yazarken odak kaybolmaz. */
  const subState = { q: "", page: 1 };
  function subListHtml() {
    const range = loadCsvRange();
    const pg = paginate(filterSubsByRange(filterSubmissions(subs, subState.q), range.from, range.to), subState.page, 6);
    const rows = pg.slice.map((s) => {
      const k = esc(s.student + "|" + s.project);
      const total = Number(s.total) || 0;
      const done = Object.keys(s.steps || {}).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return `
          <div class="archive-item">
            <h4>${esc(s.student || "?")} <span class="count-badge">%${pct}</span></h4>
            <div class="arch-meta"><span class="arch-badge">${esc(s.project || "—")}</span><span class="arch-date">📅 ${new Date(s.ts).toLocaleDateString(en ? "en-US" : "tr-TR")}</span></div>
            ${s.fb ? `<div class="fb-shown">💬 ${esc(s.fb)}</div>` : `<input type="text" class="cert-name-input fb-input" data-fbinput maxlength="600" placeholder="${t("Öğretmen yorumu…")}" />`}
            <div class="row">
              ${s.fb ? "" : `<button class="btn btn-ghost btn-small" data-fbdl="${k}" type="button">💬 ${t("Geri Bildirim")}</button>`}
              <button class="btn btn-ghost btn-small" data-delsub="${k}" type="button">🗑️</button>
            </div>
          </div>`;
    }).join("") || `<p class="panel-empty">${en ? "No submissions match your search." : "Aramayla eşleşen gönderi yok."}</p>`;
    const pager = pg.pages > 1
      ? `<div class="pager"><button class="btn btn-ghost btn-small" data-pg="${pg.page - 1}" ${pg.page <= 1 ? "disabled" : ""} type="button" aria-label="${t("Önceki sayfa")}">‹</button><span class="pager-label">${pg.page} / ${pg.pages}</span><button class="btn btn-ghost btn-small" data-pg="${pg.page + 1}" ${pg.page >= pg.pages ? "disabled" : ""} type="button" aria-label="${t("Sonraki sayfa")}">›</button></div>`
      : "";
    return `<div class="archive-grid">${rows}</div>${pager}`;
  }
  function bindSubRows() {
    $("classBody").querySelectorAll("[data-delsub]").forEach((b) => b.addEventListener("click", () => {
      const [student, project] = b.dataset.delsub.split("|");
      const c2 = loadClassroom();
      delete c2.submissions[student + "|" + project];
      saveClassroom(c2);
      openClassModal();
    }));
    /* Öğretmen geri bildirimi: yorumu yaz → .geribildirim.json indir */
    $("classBody").querySelectorAll("[data-fbdl]").forEach((b) => b.addEventListener("click", () => {
      const key = b.dataset.fbdl || "";
      const sep = key.lastIndexOf("|");
      const student = key.slice(0, sep);
      const project = key.slice(sep + 1);
      const item = b.closest(".archive-item");
      const val = item && item.querySelector("[data-fbinput]");
      const comment = String(val && val.value || "").trim();
      if (!comment) {
        showError(en ? "✍️ Write a comment first." : "✍️ Önce yorum yaz.");
        if (val) val.focus();
        return;
      }
      downloadClassFeedback(student, project, comment);
      const c3 = loadClassroom();
      if (c3.submissions[key]) { c3.submissions[key].fb = comment; saveClassroom(c3); }
      openClassModal();
    }));
  }
  function refreshSubList() {
    const el = $("subList");
    if (!el) return;
    el.innerHTML = subListHtml();
    el.querySelectorAll("[data-pg]").forEach((b) => b.addEventListener("click", () => {
      subState.page = Number(b.dataset.pg) || 1;
      refreshSubList();
    }));
    bindSubRows();
  }
  $("classBody").innerHTML = `
    <div class="panel-grid">
      <div class="panel-card">
        <h3>🔑 ${t("Sınıf kodu")}</h3>
        <div class="panel-code">
          <input type="text" id="classCode" value="${esc(c.code || "")}" placeholder="örn. 7A-KATI" maxlength="24" />
          <button class="btn btn-ghost btn-small" id="classGenBtn" type="button">🎲 ${t("Üret")}</button>
        </div>
        <div class="panel-kbd">${en
          ? "Share this code with students — their submission files carry it automatically."
          : "Bu kodu öğrencilerinle paylaş — gönderim dosyaları kodu otomatik taşır."}</div>
        <div class="modal-actions" style="margin-top:0.9rem">
          <button class="btn btn-ghost btn-small" id="classImportBtn" type="button">📥 ${t("Gönderim İçe Aktar")}</button>
          <button class="btn btn-primary btn-small" id="classReportBtn" type="button" ${subs.length ? "" : "disabled"}>📄 ${t("Sınıf Raporu (PDF)")} (${subs.length})</button>
        </div>
        <div class="panel-kbd">${en
          ? "Import .klasor files, then open the PDF report with the leaderboard."
          : ".klasor dosyalarını içe aktar, ardından lider tablosuyla PDF raporu aç."}</div>
        ${(() => { const sug = catalogSuggestions(); return sug.length ? `<div class="price-chips"><span class="price-chips-label">🏷️ ${t("Önerilen fiyatlar")}</span>${sug.slice(0, 6).map((nm) => `<button type="button" class="price-chip" data-pchip="${esc(nm)}">${esc(nm)}</button>`).join("")}</div>` : ""; })()}
      </div>
      <div class="panel-card">
        <div class="panel-subhead"><h3>📥 ${t("Gönderiler")}</h3><span class="count-badge">${subs.length}</span></div>
        ${subs.length ? `
        <div class="csv-range row" style="margin:0 0 0.6rem;flex-wrap:wrap;gap:0.4rem;align-items:center">
          <button class="btn btn-ghost btn-small" id="classCsvBtn" type="button">📊 ${t("CSV İndir")}</button>
          <label class="csv-range-lab" for="csvFrom">📅</label>
          <input type="date" id="csvFrom" class="csv-date" value="${esc(loadCsvRange().from)}" aria-label="${t("Başlangıç tarihi")}" />
          <span class="csv-sep">–</span>
          <input type="date" id="csvTo" class="csv-date" value="${esc(loadCsvRange().to)}" aria-label="${t("Bitiş tarihi")}" />
          <button class="btn btn-ghost btn-small" id="csvRangeClear" type="button" title="${t("Filtreyi temizle — tüm gönderiler")}">✕</button>
        </div>` : ""}
        ${subs.length ? `
        <input type="text" id="subSearch" class="cert-name-input" style="width:100%;margin:0 0 0.6rem" placeholder="${t("🔍 Ara: öğrenci veya proje…")}" value="" />
        <div id="subList"></div>` : `<p class="panel-empty">${t("Henüz gönderi yok — öğrenci \"📋 Gönderim Dosyası İndir\" ile dosya üretir, sen buradan içe aktarırsın.")}</p>`}
      </div>
    </div>
    ${(() => { const risk = atRiskStudents(subs); return risk.length ? `
    <div class="panel-card at-risk-card" style="margin-top:1.1rem">
      <div class="panel-subhead"><h3>🚨 ${t("Risk Altındaki Öğrenciler")}</h3><span class="count-badge">${risk.length}</span></div>
      <div class="panel-kbd">${en
        ? "No new steps in the last 10 days and the project is unfinished — a friendly nudge may help."
        : "Son 10 gündür yeni adım yok ve proje bitmemiş — samimi bir hatırlatma iyi gelir."}</div>
      <div class="risk-rows">${risk.map((s) => `<div class="risk-row"><strong>${esc(s.name)}</strong><span class="arch-badge">${esc(s.project)}</span><span class="risk-when">📅 ${new Date(s.ts).toLocaleDateString(en ? "en-US" : "tr-TR")}</span></div>`).join("")}</div>
    </div>` : ""; })()}
    ${(() => { const unk = unknownMaterials(subs); return unk.length ? `
    <div class="panel-card" style="margin-top:1.1rem">
      <div class="panel-subhead"><h3>❓ ${t("Fiyatlanamayan Malzemeler")}</h3><span class="count-badge">${unk.length}</span></div>
      <div class="panel-kbd">${en
        ? "These parts are missing from every price catalog — add them in Settings → 🏷️ Price Catalog."
        : "Bu parçalar hiçbir fiyat kataloğunda yok — Ayarlar → 🏷️ Malzeme Fiyat Kataloğu'ndan ekleyebilirsin."}</div>
      <div class="unk-rows">${unk.map((u) => `<span class="unk-chip">${esc(u.name)}${u.qty > 1 ? ` ×${u.qty}` : ""}</span>`).join("")}</div>
    </div>` : ""; })()}
    ${pending.length ? `
    <div class="panel-card" style="margin-top:1.1rem">
      <div class="panel-subhead"><h3>⚡ ${t("Toplu Geri Bildirim")}</h3><span class="count-badge">${pending.length}</span></div>
      <div class="panel-kbd">${en
        ? "Write comments for several students at once, then download all files together — each is still a personal .geribildirim.json."
        : "Birden fazla öğrenciye yorum yaz, dosyaları birlikte indir — her biri kişisel .geribildirim.json olarak iner."}</div>
      <div class="bulk-rows">${pending.map((s) => {
        const k = esc(s.student + "|" + s.project);
        return `<div class="bulk-row">
          <div class="bulk-who"><strong>${esc(s.student || "?")}</strong><span class="arch-badge">${esc(s.project || "—")}</span></div>
          <input type="text" class="cert-name-input fb-input" data-bulkfb="${k}" maxlength="600" placeholder="${t("Öğretmen yorumu…")}" aria-label="${esc(s.student || "")} ${t("yorumu")}" />
        </div>`;
      }).join("")}</div>
      <div class="modal-actions" style="margin-top:0.8rem">
        <button class="btn btn-primary btn-small" id="bulkFbBtn" type="button">📥 ${t("Hepsini İndir")} (${pending.length})</button>
      </div>
    </div>` : ""}
    <div class="modal-actions" style="margin-top:1rem">
      <button class="btn btn-ghost btn-small" id="classCloseBtn" type="button">${t("Kapat")}</button>
    </div>
    <input type="file" id="classImportFile" accept="application/json,.json" hidden>`;
  $("classGenBtn").addEventListener("click", () => {
    const code = Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
    $("classCode").value = code;
  });
  $("classCode").addEventListener("change", (e) => {
    const c = loadClassroom();
    c.code = String(e.target.value || "").trim().toUpperCase();
    saveClassroom(c);
  });
  $("classImportBtn").addEventListener("click", () => $("classImportFile").click());
  $("classImportFile").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importClassSubmissions(f);
    e.target.value = "";
  });
  const reportBtn = $("classReportBtn");
  if (reportBtn && subs.length) reportBtn.addEventListener("click", downloadClassReport);
  const bulkBtn = $("bulkFbBtn");
  if (bulkBtn) bulkBtn.addEventListener("click", applyBulkFeedback);
  const csvBtn = $("classCsvBtn");
  if (csvBtn) csvBtn.addEventListener("click", downloadClassCSV);
  const csvFrom = $("csvFrom"), csvTo = $("csvTo");
  if (csvFrom) csvFrom.addEventListener("change", () => { const r = loadCsvRange(); r.from = csvFrom.value; saveCsvRange(r); refreshSubList(); });
  if (csvTo) csvTo.addEventListener("change", () => { const r = loadCsvRange(); r.to = csvTo.value; saveCsvRange(r); refreshSubList(); });
  const csvClr = $("csvRangeClear");
  if (csvClr) csvClr.addEventListener("click", () => { saveCsvRange({ from: "", to: "" }); const f = $("csvFrom"), t3 = $("csvTo"); if (f) f.value = ""; if (t3) t3.value = ""; refreshSubList(); });
  $("classBody").querySelectorAll("[data-pchip]").forEach((b) => b.addEventListener("click", () => {
    const nm = b.dataset.pchip || "";
    const fc = loadFileCatalog();
    if (!nm || !fc || fc.prices[nm] == null) return;
    const map = loadCustomPrices();
    map[nm] = fc.prices[nm];
    saveCustomPrices(map);
    if (customPricesInput) updateCustomPricesEditor();
    showError(en ? `🏷️ "${nm}" added to your price list at $${fc.prices[nm]}.` : `🏷️ "${nm}" fiyat listenize ${fc.prices[nm]} $ olarak eklendi.`);
    errorBanner.classList.add("info");
    setTimeout(() => { errorBanner.classList.remove("info"); errorBanner.hidden = true; }, 6000);
  }));
  $("classCloseBtn").addEventListener("click", closeClassModal);
  classModal.classList.add("panel-mode");
  const subSearchInput = $("subSearch");
  if (subSearchInput) subSearchInput.addEventListener("input", () => {
    subState.q = subSearchInput.value;
    subState.page = 1;
    refreshSubList();
  });
  refreshSubList();
  classModal.hidden = false;
}
function closeClassModal() { classModal.hidden = true; }
/* Toplu geri bildirim: dolu yorum kutularını topla, her öğrenciye kişisel
   .geribildirim.json indir ve gönderileri 'geri bildirim verildi' işaretle. */
function applyBulkFeedback() {
  const en = getLang() === "en";
  const rows = document.querySelectorAll("#classBody [data-bulkfb]");
  const done = [];
  const c = loadClassroom();
  rows.forEach((inp) => {
    const key = inp.dataset.bulkfb || "";
    const comment = String(inp.value || "").trim();
    if (!comment) return;
    const sep = key.lastIndexOf("|");
    const student = key.slice(0, sep);
    const project = key.slice(sep + 1);
    downloadClassFeedback(student, project, comment);
    if (c.submissions[key]) { c.submissions[key].fb = comment; done.push(student); }
  });
  if (!done.length) {
    showError(en ? "✍️ Write at least one comment first." : "✍️ Önce en az bir yorum yaz.");
    return;
  }
  saveClassroom(c);
  openClassModal();
  showError(en ? `✅ ${done.length} feedback file(s) downloaded.` : `✅ ${done.length} geri bildirim dosyası indirildi.`);
  errorBanner.classList.add("info");
  setTimeout(() => { errorBanner.classList.remove("info"); errorBanner.hidden = true; }, 6000);
}
function importClassSubmissions(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const en = getLang() === "en";
    try {
      const parsed = JSON.parse(String(reader.result));
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.submissions) ? parsed.submissions : (parsed && parsed.student && parsed.project ? [parsed] : null);
      if (!list) throw new Error("format");
      const c = loadClassroom();
      c.submissions = c.submissions || {};
      let added = 0;
      list.forEach((s) => {
        if (!s || !s.student || !s.project) return;
        const key = s.student + "|" + s.project;
        const prev = c.submissions[key];
        if (!prev || (s.ts || 0) >= (prev.ts || 0)) { c.submissions[key] = s; added++; }
      });
      saveClassroom(c);
      openClassModal();
      showError(en ? `✅ ${added} submission(s) imported.` : `✅ ${added} gönderim içe aktarıldı.`);
      errorBanner.classList.add("info");
      setTimeout(() => { errorBanner.classList.remove("info"); errorBanner.hidden = true; }, 6000);
    } catch (e) {
      showError(en ? "❌ File could not be read — expected a .klasor submission file." : "❌ Dosya okunamadı — beklenen biçim .klasor gönderim dosyası.");
    }
  };
  reader.readAsText(file);
}
/* Sınıf raporuna gömülü SVG lider tablosu: öğrencileri ilerleme yüzdesine göre
   sıralı yatay çubuk grafikle gösterir (print-to-PDF dostu, bağımlılıksız). */
function leaderboardSVG(subs) {
  const en = getLang() === "en";
  const data = subs.map((s) => {
    const total = Number(s.total) || 0;
    const done = Object.keys(s.steps || {}).length;
    return {
      name: String(s.student || "?").slice(0, 22),
      pct: total ? Math.round((done / total) * 100) : 0
    };
  }).sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name, "tr")).slice(0, 10);
  const W = 500, LH = 30, top = 34, bot = 6;
  const H = top + data.length * LH + bot;
  const BARX = 150, BARW = W - BARX - 60;
  const escA = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const rows = data.map((d, i) => {
    const y = top + i * LH;
    const bw = Math.round(BARW * d.pct / 100);
    const fill = d.pct === 100 ? "#b8860b" : "#0a7a68";
    return `<g><text x="${BARX - 8}" y="${y + 14}" text-anchor="end" font-size="11" fill="#1a2233">${escA(d.name)}</text>` +
      `<rect x="${BARX}" y="${y + 3}" width="${BARW}" height="14" rx="7" fill="#e8e2cf"/>` +
      `<rect x="${BARX}" y="${y + 3}" width="${Math.max(bw, d.pct ? 6 : 0)}" height="14" rx="7" fill="${fill}"/>` +
      `<text x="${BARX + BARW + 8}" y="${y + 14}" font-size="11" fill="#1a2233">%${d.pct}</text></g>`;
  }).join("");
  return `<h3 style="margin:0 0 4px">${en ? "🏆 Leaderboard — top 10 by progress" : "🏆 Lider Tablosu — ilerlemeye göre ilk 10"}</h3>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${rows}</svg>`;
}
/* ── Sınıf bütçe planlayıcısı (v2.17.0): öğretmen mevcut girer; sınıf raporu
   mevcut × proje maliyeti ile toplam bütçe ihtiyacını gösterir. ── */
const CLASS_SIZE_KEY = "arduinoDreamLab.classSize.v1";
function loadClassSize() {
  const v = parseInt(localStorage.getItem(CLASS_SIZE_KEY), 10);
  return isFinite(v) && v > 0 ? v : 0;
}
/* Haftalık ilerleme grafiği (v2.17.0): gönderimlerin ts alanını haftaya göre
   kümelendirip o hafta tamamlanan toplam adım sayısını çubuk grafiğe döker. */
function weeklyProgressSVG(subs) {
  const en = getLang() === "en";
  const perWeek = new Map(); // hafta → tamamlanan adım sayısı
  for (const s of subs || []) {
    const done = Object.keys(s.steps || {}).length;
    if (!done) continue;
    const wk = mondayOf(s.ts || Date.now());
    perWeek.set(wk, (perWeek.get(wk) || 0) + done);
  }
  if (!perWeek.size) return "";
  const weeks = [...perWeek.keys()].sort((a, b) => a - b).slice(-8); // son 8 hafta
  const W = 500, H = 190, top = 30, bot = 34, barX = 36;
  const barW = Math.floor((W - barX - 16) / weeks.length) - 8;
  const max = Math.max(...weeks.map((w) => perWeek.get(w)), 1);
  const escA = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bars = weeks.map((wk, i) => {
    const v = perWeek.get(wk);
    const h = Math.round((H - top - bot) * v / max);
    const x = barX + i * (barW + 8);
    const y = H - bot - h;
    const d = new Date(wk);
    const label = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
    return `<g><rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="#0a7a68"/>` +
      `<text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" font-size="11" fill="#1a2233">${v}</text>` +
      `<text x="${x + barW / 2}" y="${H - 12}" text-anchor="middle" font-size="9" fill="#666">${escA(label)}</text></g>`;
  }).join("");
  const title = en ? "📈 Steps completed per week (last 8 weeks)" : "📈 Haftada tamamlanan adımlar (son 8 hafta)";
  return `<h3 style="margin:14px 0 4px">${title}</h3>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">` +
    `<line x1="${barX - 8}" y1="${H - bot}" x2="${W - 10}" y2="${H - bot}" stroke="#c9c2b0"/>${bars}</svg>`;
}
/* v2.21.0: Haftalık katılım detayı — son 8 haftanın her biri için kim kaç adım
   tamamladı; sınıf raporuna grafik altına girer (ayrıca PDF'e yazdırılabilir). */
function weeklyParticipationDetail(subs) {
  const en = getLang() === "en";
  const byWeek = new Map();
  for (const s of subs || []) {
    const done = Object.keys(s.steps || {}).length;
    if (!done) continue;
    const wk = mondayOf(s.ts || Date.now());
    if (!byWeek.has(wk)) byWeek.set(wk, []);
    byWeek.get(wk).push({ student: s.student || "?", done });
  }
  if (!byWeek.size) return "";
  const weeks = [...byWeek.keys()].sort((a, b) => b - a).slice(0, 4); // en güncel 4 hafta
  const fmtDay = (ts) => new Date(ts).toLocaleDateString(en ? "en-US" : "tr-TR", { day: "2-digit", month: "short" });
  const rows = weeks.map((wk) => {
    const st = byWeek.get(wk).sort((a, b) => b.done - a.done || String(a.student).localeCompare(String(b.student), "tr"));
    const names = st.slice(0, 6).map((x) => `${esc(x.student)} (${x.done})`).join(", ");
    const more = st.length > 6 ? ` +${st.length - 6}` : "";
    return `<li style="margin:2px 0"><strong>${fmtDay(wk)}</strong> — ${st.reduce((a, x) => a + x.done, 0)} ${en ? "steps · " : "adım · "}${names}${more}</li>`;
  }).join("");
  return `<h3 style="margin:14px 0 4px">${en ? "📅 Weekly participation detail (last 4 weeks)" : "📅 Haftalık katılım detayı (son 4 hafta)"}</h3><ul style="font-size:12px;margin:4px 0 0;padding-left:18px">${rows}</ul>`;
}

/* Pazartesi başlangıçlı hafta anahtarı (yerel zaman) — haftalık grafik ve
   en aktif hafta analizi ortak kullanır. */
function mondayOf(ts) {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Pzt=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}
/* En aktif hafta (v2.19.0): Pazartesi kümelerinde en çok adım tamamlanan hafta.
   Raporun haftalık grafiğinin altına özet satırı olarak basılır. */
function mostActiveWeek(subs) {
  const per = new Map();
  for (const s of subs || []) {
    const done = Object.keys(s.steps || {}).length;
    if (!done) continue;
    const wk = mondayOf(s.ts || Date.now());
    per.set(wk, (per.get(wk) || 0) + done);
  }
  let best = null;
  for (const [wk, v] of per) if (!best || v > best.steps) best = { weekStart: wk, steps: v };
  return best;
}
/* ── Sınıf paneli arama + sayfalama (v2.19.0) ──
   filterSubmissions: öğrenci/proje adında foldTR "içerir" araması.
   paginate: sayfalama yardımcısı — sayfa taşarsa kenara kelepçeler. */
function filterSubmissions(subs, query) {
  const q = foldTR(String(query || "").trim());
  const list = subs || [];
  if (!q) return list.slice();
  return list.filter((s) => foldTR(((s && s.student) || "") + " " + ((s && s.project) || "")).includes(q));
}
function paginate(items, page, perPage) {
  const per = Math.max(1, Number(perPage) || 8);
  const list = items || [];
  const pages = Math.max(1, Math.ceil(list.length / per));
  const p = Math.min(Math.max(1, Number(page) || 1), pages);
  return { slice: list.slice((p - 1) * per, p * per), page: p, pages, total: list.length };
}
/* ── Sınıf paneli yardımcıları (v2.18.0) ──
   1) Depo kataloğundan henüz özel fiyatı olmayan parçaları önerir. */
function catalogSuggestions() {
  const fc = loadFileCatalog();
  if (!fc) return [];
  const covered = new Set(Object.keys(loadCustomPrices()).map((k) => foldTR(k)));
  return Object.keys(fc.prices).filter((nm) => !covered.has(foldTR(nm)));
}
/* 2) Risk altındaki öğrenciler: son `days` gündür (varsayılan 10) gönderi
   yenilememiş ve projesini bitirmemiş olanlar; en eski tarihli önce. */
function atRiskStudents(subs, days) {
  const d = Number(days) > 0 ? Number(days) : 10;
  const cutoff = Date.now() - d * 86400000;
  return (subs || [])
    .map((s) => ({
      name: s.student || "?", project: s.project || "—", ts: s.ts || 0,
      done: Object.keys(s.steps || {}).length, total: Number(s.total) || 0
    }))
    .filter((s) => s.ts < cutoff && (!s.total || s.done < s.total))
    .sort((a, b) => a.ts - b.ts);
}
/* 3) Fiyatlanamayan malzemeler: tüm katalog katmanlarında karşılığı olmayan
   parça adlarını toplar; adetle birlikte en çok kullanılan önce. */
function unknownMaterials(subs) {
  const counts = new Map(); // foldTR(ad) → { name, qty } — büyük/küçük harf farkı aynı gruba düşer
  for (const s of subs || []) {
    for (const m of (s && s.materials) || []) {
      const nm = String((m && m.name) || "").trim();
      if (!nm || priceOf(nm)) continue;
      const key = foldTR(nm);
      const cur = counts.get(key);
      if (cur) cur.qty += Number(m.quantity) || 1;
      else counts.set(key, { name: nm, qty: Number(m.quantity) || 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, "tr"));
}
/* 4) Gönderileri CSV'ye döker: Excel uyumlu için BOM + ';' ayırıcı;
   ';', tırnak ve satır sonu içeren hücreler çift tırnakla sarılır. */
function classSubsToCSV(subs) {
  const escCell = (v) => { const s = String(v == null ? "" : v); return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const head = ["Öğrenci", "Proje", "Tamamlanan Adım", "Toplam Adım", "İlerleme %", "Tahmini Maliyet USD", "Geri Bildirim", "Tarih", "Son Etkinlik"].map(escCell).join(";");
  const lines = (subs || []).map((s) => {
    const total = Number(s.total) || 0;
    const done = Object.keys(s.steps || {}).length;
    /* Son etkinlik: adım ts'lerinin en büyüğü; hiçbiri yoksa gönderim ts'si */
    const stepTs = Object.values(s.steps || {}).map(Number).filter((n) => n > 0);
    const lastAct = stepTs.length ? Math.max(...stepTs) : (Number(s.ts) || 0);
    const fmtDay = (ts) => (ts ? new Date(ts).toISOString().slice(0, 10) : "");
    return [s.student || "?", s.project || "—", done, total, total ? Math.round((done / total) * 100) : 0,
      (Math.round((estimateCost({ materials: s.materials || [] }).totalUSD || 0) * 100) / 100).toFixed(2),
      s.fb || "", fmtDay(Number(s.ts) || 0), fmtDay(lastAct)].map(escCell).join(";");
  });
  return "\uFEFF" + [head].concat(lines).join("\r\n");
}
function downloadClassCSV() {
  const c = loadClassroom();
  let subs = Object.values(c.submissions || {}).sort((a, b) => (a.student || "").localeCompare(b.student || "", "tr"));
  const range = loadCsvRange();
  subs = filterSubsByRange(subs, range.from, range.to);
  if (!subs.length) return;
  const suffix = (range.from || range.to) ? "-" + (range.from || "bas") + "_" + (range.to || "son") : "";
  downloadFileBlob(new Blob([classSubsToCSV(subs)], { type: "text/csv;charset=utf-8" }),
    "sinif-gonderimleri" + suffix + "-" + new Date().toISOString().slice(0, 10) + ".csv");
}
/* Sınıf raporu: gönderimleri A4 dikey sayfalara döken basılı PDF (print-to-PDF) */
function downloadClassReport() {
  const en = getLang() === "en";
  const c = loadClassroom();
  let subs = Object.values(c.submissions || {}).sort((a, b) => (a.student || "").localeCompare(b.student || "", "tr"));
  if (!subs.length) return;
  const csvRange = loadCsvRange();
  const csvFiltered = filterSubsByRange(subs, csvRange.from, csvRange.to);
  const rangeLabel = (csvRange.from || csvRange.to)
    ? ` · ${en ? "CSV date range" : "CSV tarih aralığı"}: ${csvRange.from || "…"} – ${csvRange.to || "…"} (${csvFiltered.length}/${subs.length})`
    : "";
  const esc2 = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const money = (x) => (x > 0 ? (Math.round(x * rate() * 100) / 100).toFixed(2) + "₺ ($" + x.toFixed(2) + ")" : "—");
  const rows = subs.map((s) => {
    const total = Number(s.total) || 0;
    const done = Object.keys(s.steps || {}).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `<tr><td>${esc2(s.student)}</td><td>${esc2(s.project)}</td><td>${done}/${total}</td>
      <td>${money(estimateCost({ materials: s.materials || [] }).totalUSD)}</td>
      <td><span class="pbar"><span style="width:${pct}%"></span></span> %${pct}</td>
      <td>${s.fb
        ? `<span class="fb-ok">✓ ${en ? "Given" : "Verildi"}</span>${s.fb.comment ? `<div class="fb-note">${esc2(String(s.fb.comment).slice(0, 80))}${String(s.fb.comment).length > 80 ? "…" : ""}</div>` : ""}`
        : `<span class="fb-wait">${en ? "Pending" : "Bekliyor"}</span>`}</td>
      <td>${new Date(s.ts).toLocaleDateString("tr-TR")}</td></tr>`;
  }).join("");
  const html = `<!DOCTYPE html><html lang="${en ? "en" : "tr"}"><head><meta charset="UTF-8"><title>${en ? "Class Report" : "Sınıf Raporu"}</title>
  <style>body{font-family:Georgia,serif;margin:2.2cm;color:#1a2233}
  h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;color:#666;font-weight:400;margin:0 0 18px}
  table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #c9c2b0;padding:6px 8px;text-align:left}
  th{background:#f3eddc;letter-spacing:.04em}td:first-child{font-weight:bold}
  .pbar{display:inline-block;width:70px;height:8px;background:#e8e2cf;border-radius:4px;vertical-align:middle;margin-right:6px}
  .pbar span{display:block;height:8px;border-radius:4px;background:#0a7a68}
  .fb-ok{color:#0a7a68;font-weight:bold}.fb-wait{color:#a08c50}
  .fb-note{font-size:10px;color:#666;font-style:italic;margin-top:2px;max-width:200px}
  footer{margin-top:18px;font-size:10px;color:#888}</style></head><body>
  <h1>🤖 ${en ? "Class Report — Arduino Dream Lab" : "Sınıf Raporu — Arduino Rüya Atölyesi"}</h1>
  <h2>${en ? "Class code" : "Sınıf kodu"}: ${esc2(c.code || "—")} · ${new Date().toLocaleDateString("tr-TR")} · ${subs.length} ${en ? "students" : "öğrenci"}${rangeLabel}</h2>
  ${leaderboardSVG(subs)}
  ${(() => { const sum = subs.reduce((acc, s) => acc + (estimateCost({ materials: s.materials || [] }).totalUSD || 0), 0); return sum > 0 ? `<p style="font-size:13px;margin:10px 0"><strong>${en ? "💰 Class total budget" : "💰 Sınıf toplam bütçesi"}:</strong> ${fmtTL(sum)}${isOverBudget(sum) ? ` — ⚠️ ${en ? "over budget" : "bütçe aşımı"}` : ""}</p>` : ""; })()}
  ${(() => { const n = loadClassSize(); const per = subs.reduce((acc, s) => acc + (estimateCost({ materials: s.materials || [] }).totalUSD || 0), 0); if (!n || !per) return ""; const total = n * per; return `<p style="font-size:13px;margin:10px 0"><strong>${en ? "🎯 Full-class budget plan" : "🎯 Tüm sınıf bütçe planı"}:</strong> ${n} ${en ? "students ×" : "öğrenci ×"} ${fmtTL(per)} = <strong>${fmtTL(total)}</strong>${isOverBudget(total) ? ` — ⚠️ ${en ? "over teacher budget" : "öğretmen bütçesini aşıyor"}` : ""}</p>`; })()}
  ${weeklyProgressSVG(subs)}
  ${(() => { const m = mostActiveWeek(subs); return m ? `<p style="font-size:12px;margin:4px 0 0;color:#666">🔥 ${en ? "Most active week" : "En aktif hafta"}: ${new Date(m.weekStart).toLocaleDateString(en ? "en-US" : "tr-TR")} — ${m.steps} ${en ? "steps" : "adım"}</p>` : ""; })()}
  ${weeklyParticipationDetail(subs)}
  <table><thead><tr><th>${en ? "Student" : "Öğrenci"}</th><th>${en ? "Project" : "Proje"}</th><th>${en ? "Steps" : "Adım"}</th><th>${en ? "Est. Cost" : "Maliyet"}</th><th>${en ? "Progress" : "İlerleme"}</th><th>${en ? "Feedback" : "Geri Bildirim"}</th><th>${en ? "Date" : "Tarih"}</th></tr></thead><tbody>${rows}</tbody></table>
  <footer>${en ? "Generated with Arduino Dream Lab — progress data is collected locally, no server involved." : "Arduino Rüya Atölyesi ile üretildi — ilerleme verisi yerel toplanır, sunucu yok."}</footer>
  <scr${""}ipt>window.onload=function(){setTimeout(function(){window.print()},300)}</scr${""}ipt></body></html>`;
  const w = window.open("", "_blank");
  if (!w) { showError(en ? "Popup blocked — allow popups to print the report." : "Açılır pencere engellendi — raporu yazdırmak için izin ver."); return; }
  w.document.write(html);
  w.document.close();
}
/* Öğrenci tarafı: tamamlanan adımları sınıf koduyla gönderim dosyasına paketler */
function buildClassSubmission(studentName) {
  const g = currentGuide;
  if (!g || !studentName) return null;
  const key = stepsKeyOf(g);
  const store = stepsStore();
  return {
    app: "arduino-ruya-atolyesi",
    kind: "sinif-gonderim",
    version: 1,
    classCode: loadClassroom().code || "",
    student: String(studentName).slice(0, 60),
    project: g.title || "—",
    difficulty: g.difficulty || "",
    total: (g.steps || []).length,
    steps: store[key] || {},
    materials: (g.materials || []).map((m) => ({ name: m.name, quantity: m.quantity })),
    ts: Date.now()
  };
}

/* ══════════════════ ÖĞRETMEN GERİ BİLDİRİMİ ══════════════════
   Öğretmen içe aktarılan gönderiye yorum yazar; .geribildirim.json olarak
   inen dosyayı öğrenci "Geri Bildirimi Göster" ile açıp okur. */
const FEEDBACK_KEY = "arduinoDreamLab.feedback.v1";
function loadFeedback() {
  try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY)) || []; } catch { return []; }
}
function saveFeedback(list) { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(0, 40))); }
function downloadClassFeedback(student, project, comment) {
  const fb = {
    app: "arduino-ruya-atolyesi",
    kind: "ogretmen-geribildirim",
    version: 1,
    classCode: loadClassroom().code || "",
    student: String(student || "").slice(0, 60),
    project: String(project || "").slice(0, 80),
    comment: String(comment || "").slice(0, 600),
    ts: Date.now()
  };
  const fname = (fb.student + "-" + fb.project).toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "ogrenci";
  downloadFileBlob(new Blob([JSON.stringify(fb, null, 2)], { type: "application/json" }), fname + ".geribildirim.json");
  return fb;
}
function showFeedback(fb) {
  const row = document.getElementById("submitRow");
  if (!row) return;
  const d = new Date(fb.ts);
  const when = isNaN(d.getTime()) ? "" : d.toLocaleDateString("tr-TR");
  let box = document.getElementById("feedbackBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "feedbackBox";
    box.className = "feedback-box";
    row.parentNode.insertBefore(box, row.nextSibling);
  }
  box.innerHTML = `<div class="fb-head">💬 ${t("Öğretmeninden geri bildirim")} <span class="fb-date">${esc(when)}</span></div>` +
    `<div class="fb-msg">${esc(fb.comment || "")}</div>` +
    `<div class="fb-meta">${esc(fb.student || "")} · ${esc(fb.project || "")}</div>`;
  box.hidden = false;
}
function openStudentFeedback() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const en = getLang() === "en";
      try {
        const fb = JSON.parse(String(reader.result));
        if (!fb || fb.kind !== "ogretmen-geribildirim" || !fb.comment) throw new Error("format");
        const list = loadFeedback();
        list.push(fb);
        saveFeedback(list);
        const badges = loadBadges();
        if (!badges.some((b) => b.type === "fb" && b.project === fb.project && b.ts === fb.ts)) {
          badges.push({ type: "fb", project: fb.project || "—", student: fb.student || "", comment: fb.comment || "", ts: fb.ts || Date.now() });
          saveBadges(badges);
          updateBadgeCount();
        }
        showFeedback(fb);
        showError(en ? "💬 Feedback loaded." : "💬 Geri bildirim yüklendi.");
        errorBanner.classList.add("info");
        setTimeout(() => { errorBanner.classList.remove("info"); errorBanner.hidden = true; }, 6000);
      } catch (e) {
        showError(en ? "❌ File could not be read — expected a .geribildirim feedback file." : "❌ Dosya okunamadı — beklenen biçim .geribildirim dosyası.");
      }
    };
    reader.readAsText(f);
  });
  input.click();
}

updateArchiveCount();
renderLib(currentLibCat);
applyLang(getLang());
initChangelogModal();
initPWA();

/* ── Otomatik kur güncelleme (v2.16.0): açılışta kur 24 saatten eskiyse
   sessizce çevrimiçi tazelenir; başarılıysa açık rehber yeniden render edilir.
   Başarısızlık tamamen sessizdir — kullanıcı hiçbir uyarı görmez. */
(async () => {
  try {
    if (rateAgeHours() >= 24) {
      const r = await updateRateFromWeb();
      if (r.ok) {
        updateRateStatus();
        if (currentGuide) renderGuide(currentGuide, undefined, { scroll: false });
      }
    } else {
      updateRateStatus();
    }
  } catch { /* sessiz */ }
})();

/* 💾 Veri yedeği düğmeleri (Ayarlar modalı) */
const exportBackupBtn = document.getElementById("exportBackupBtn");
const importBackupBtn = document.getElementById("importBackupBtn");
const backupFileInput = document.getElementById("backupFile");
if (exportBackupBtn) exportBackupBtn.addEventListener("click", exportBackup);
if (importBackupBtn) importBackupBtn.addEventListener("click", () => backupFileInput && backupFileInput.click());
if (backupFileInput) backupFileInput.addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) restoreBackup(f);
  e.target.value = "";
});

/* ══════════════════ VERİ YEDEĞİ (v2.9.0) ══════════════════
   Tüm uygulama verisi (rehber arşivi, adımlar, sınıf, gönderiler, rozetler,
   geri bildirimler, ayarlar, kütüphane…) tek .yedek.json dosyasında taşınır.
   Dil/tema/model favorileri gibi cihaz yerel tercihleri hariç tutulur. */
const BACKUP_SKIP = ["arduinoDreamLab.lang.v1", "arduinoDreamLab.theme.v1", "arduinoDreamLab.modelFavs.v1", "arduinoDreamLab.customPrices.v1", "arduinoDreamLab.budget.v1", "arduinoDreamLab.classSize.v1"];
function exportBackup() {
  const en = getLang() === "en";
  const data = { app: "arduino-ruya-atolyesi", kind: "veri-yedegi", version: 2, exportedAt: Date.now(), data: {} };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("arduinoDreamLab.") || BACKUP_SKIP.includes(key)) continue;
      data.data[key] = localStorage.getItem(key);
    }
  } catch (e) { /* localStorage erişilemiyorsa boş yedek */ }
  const count = Object.keys(data.data).length;
  if (!count) {
    showError(en ? "📦 Nothing to back up yet." : "📦 Yedeklenecek veri yok.");
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFileBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "ruya-atolyesi-yedek-" + stamp + ".json");
  showError(en ? `✅ Backup downloaded — ${count} data group(s).` : `✅ Yedek indirildi — ${count} veri grubu.`);
  errorBanner.classList.add("info");
  setTimeout(() => { errorBanner.classList.remove("info"); errorBanner.hidden = true; }, 6000);
}
function restoreBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const en = getLang() === "en";
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || parsed.kind !== "veri-yedegi" || !parsed.data || typeof parsed.data !== "object") throw new Error("format");
      let restored = 0;
      Object.keys(parsed.data).forEach((k) => {
        if (!k.startsWith("arduinoDreamLab.")) return;
        localStorage.setItem(k, String(parsed.data[k]));
        restored++;
      });
      updateBadgeCount();
      updateArchiveCount();
      updateStatusPill();
      showError(en ? `✅ Backup restored — ${restored} data group(s). Reload for a clean start.` : `✅ Yedek geri yüklendi — ${restored} veri grubu. Temiz başlangıç için sayfayı yenile.`);
      errorBanner.classList.add("info");
      setTimeout(() => { errorBanner.classList.remove("info"); errorBanner.hidden = true; }, 8000);
    } catch (e) {
      showError(en ? "❌ File could not be read — expected a .yedek.json backup." : "❌ Dosya okunamadı — beklenen biçim .yedek.json yedeği.");
    }
  };
  reader.readAsText(file);
}

/* ══════════════════ ZIP YAZICI (bağımlılıksız, STORE yöntemi) ══════════════════
   Wokwi "Download project ZIP" ile aynı biçimi üretir: sketch.ino + diagram.json.
   CRC32 tablosu tek seferde kurulur; her dosya UTF-8 baytlarına çevrilip
   yerel dosya başlığı + veri tanımlayıcısı (data descriptor) ile arşive yazılır. */
const CRC_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    tbl[n] = c >>> 0;
  }
  return tbl;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function dosDateTime(d = new Date()) {
  const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((Math.floor(d.getSeconds() / 2)) & 31);
  const date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time, date };
}
function pushLE(arr, value, n) { for (let i = 0; i < n; i++) arr.push((value >>> (8 * i)) & 0xFF); }
function pushStr(arr, s) { for (let i = 0; i < s.length; i++) arr.push(s.charCodeAt(i) & 0xFF); }
/* Dosyaları { name, content } listesinden geçerli bir ZIP Blob'u üretir */
function makeZip(files) {
  const { time, date } = dosDateTime();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  files.forEach((f) => {
    const nameBytes = [];
    pushStr(nameBytes, f.name);
    const data = Array.from(new TextEncoder().encode(String(f.content)));
    const crc = crc32(data);
    const size = data.length;
    const lh = [];
    pushLE(lh, 0x04034b50, 4); pushLE(lh, 20, 2); pushLE(lh, 0x0800, 2);
    pushLE(lh, 0, 2); pushLE(lh, time, 2); pushLE(lh, date, 2);
    pushLE(lh, crc, 4); pushLE(lh, size, 4); pushLE(lh, size, 4);
    pushLE(lh, nameBytes.length, 2); pushLE(lh, 0, 2);
    const localStart = offset;
    localParts.push(lh, nameBytes, data);
    offset += lh.length + nameBytes.length + size;
    const dd = [];
    pushLE(dd, 0x08074b50, 4); pushLE(dd, crc, 4); pushLE(dd, size, 4); pushLE(dd, size, 4);
    localParts.push(dd);
    offset += dd.length;
    const ch = [];
    pushLE(ch, 0x02014b50, 4); pushLE(ch, 20, 2); pushLE(ch, 20, 2); pushLE(ch, 0x0800, 2);
    pushLE(ch, 0, 2); pushLE(ch, time, 2); pushLE(ch, date, 2);
    pushLE(ch, crc, 4); pushLE(ch, size, 4); pushLE(ch, size, 4);
    pushLE(ch, nameBytes.length, 2); pushLE(ch, 0, 2); pushLE(ch, 0, 2);
    pushLE(ch, 0, 2); pushLE(ch, 0, 2); pushLE(ch, 0, 4);
    pushLE(ch, localStart, 4);
    centralParts.push(ch, nameBytes);
  });
  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = [];
  pushLE(eocd, 0x06054b50, 4); pushLE(eocd, 0, 2); pushLE(eocd, 0, 2);
  pushLE(eocd, files.length, 2); pushLE(eocd, files.length, 2);
  pushLE(eocd, centralSize, 4); pushLE(eocd, offset, 4); pushLE(eocd, 0, 2);
  const total = localParts.concat(centralParts, [eocd]).flat();
  return new Blob([new Uint8Array(total)], { type: "application/zip" });
}
/* Rehberden Wokwi proje paketi: sketch.ino + diagram.json + ÖĞRETMEN_NOTLARI.txt
   meta = { student, classCode } verilirse notlar + sketch başlığı kişiselleşir. */
function buildWokwiProjectFiles(g, meta) {
  const en = getLang() === "en";
  const d = wokwiDiagram(g);
  const sum = wokwiConnectionSummary(g, d);
  let code = Array.isArray(g.code) ? g.code.join("\n") : String(g.code || "");
  const student = String((meta && meta.student) || "").slice(0, 60);
  const classCode = String((meta && meta.classCode) || "").slice(0, 24);
  if (student) {
    const head = ["// " + g.title, "// " + (en ? "Prepared by" : "Hazırlayan") + ": " + student + (classCode ? " · " + (en ? "Class" : "Sınıf") + " " + classCode : ""), "// Arduino Rüya Atölyesi"].join("\n");
    code = head + "\n\n" + code;
  }
  const wokwiUrl = "https://wokwi.com/projects/new/arduino-uno";
  const who = student ? (en ? `\nStudent: ${student}` + (classCode ? `\nClass code: ${classCode}` : "") : `\nÖğrenci: ${student}` + (classCode ? `\nSınıf kodu: ${classCode}` : "")) : "";
  const notes = en
    ? [`${g.title} — teacher notes`, who, "", "How to use:", `1. Open ${wokwiUrl}`, "2. Drag the sketch.ino and diagram.json from this zip into the editor (or copy their contents).", "3. Press the green play button.", "", `Diagram: ${d.parts.length} parts, ${d.connections.length} wires.`]
      .concat(sum.unmatched.length ? ["", "Not simulated (Wokwi has no part for them) — wire by hand:", ...sum.unmatched.map((u) => "- " + u)] : ["", "All wiring rows mapped."])
      .join("\n")
    : [`${g.title} — öğretmen notları`, who, "", "Kullanım:", `1. ${wokwiUrl} adresini aç`, "2. Bu zip'teki sketch.ino ve diagram.json dosyalarını düzenleyiciye sürükle (ya da içeriklerini kopyala).", "3. Yeşil oynat düğmesine bas.", "", `Diyagram: ${d.parts.length} parça, ${d.connections.length} kablo.`]
      .concat(sum.unmatched.length ? ["", "Simüle edilemeyen satırlar (Wokwi'de karşılığı yok) — elle bağla:", ...sum.unmatched.map((u) => "- " + u)] : ["", "Tüm bağlantı satırları eşleşti."])
      .join("\n");
  return [
    { name: "sketch.ino", content: code },
    { name: "diagram.json", content: JSON.stringify(d, null, 2) },
    { name: en ? "TEACHER_NOTES.txt" : "OGRETMEN_NOTLARI.txt", content: notes }
  ];
}
function downloadWokwiZip() {
  if (!currentGuide) return;
  /* Kişiselleştirme: gönderim adı → sertifika adı → kayıtlı ad; sınıf kodu Sınıf Modu'ndan */
  const nameInput = document.getElementById("submitNameInput");
  const certInput = document.getElementById("certNameInput");
  const student = String((nameInput && nameInput.value) || (certInput && certInput.value) || loadCertName() || "").trim();
  const classCode = loadClassroom().code || "";
  const files = buildWokwiProjectFiles(currentGuide, { student, classCode });
  const blob = makeZip(files);
  const fname = (currentGuide.title || "proje").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "proje";
  downloadFileBlob(blob, "wokwi-" + fname + ".zip");
}

/* ══════════════════ PORTFOLYO.ZIP ══════════════════
   Sertifikalı tüm rehberlerin Wokwi paketlerini (sketch.ino + diagram.json +
   notlar) numaralı klasörler hâlinde tek arşivde toplar; kökte PORTFOLYO.txt
   özeti olur. guide snapshot'ı olmayan eski sertifikalar atlanır. */
/* v2.20.0: Portfolyo sıralaması — favoriler önce (arşiv meta'sından), sonra en yeni;
   favori eşleşmesi: rozet proje adı + guide.code arşivdeki rehberle eşleşir */
function orderPortfolioCerts(certs) {
  return (certs || [])
    .map((b) => ({ b, fav: archiveMeta({ meta: (loadArchive().find((x) => x.guide && (x.guide.title || "") === (b.project || "") && x.guide.code === b.guide.code) || {}).meta }).fav }))
    .sort((x, y) => (y.fav - x.fav) || ((y.b.ts || 0) - (x.b.ts || 0)))
    .map((x) => x.b);
}
function downloadPortfolio() {
  const en = getLang() === "en";
  const certs = orderPortfolioCerts(loadBadges().filter((b) => b.type === "cert" && b.guide));
  if (!certs.length) {
    showError(en ? "📦 No certificate with a saved guide yet — finish all steps of a guide and create your certificate first."
      : "📦 Kayıtlı rehberli sertifika yok — önce bir rehberin tüm adımlarını bitirip sertifika oluştur.");
    return;
  }
  const files = [];
  const lines = [en
    ? "ARDUINO DREAM LAB — PORTFOLIO"
    : "ARDUINO RÜYA ATÖLYESİ — PORTFOLYO",
    "=".repeat(46),
    en ? `Student: ${certs[0].student || "—"}` : `Öğrenci: ${certs[0].student || "—"}`,
    `${en ? "Date" : "Tarih"}: ${new Date().toLocaleDateString(en ? "en-US" : "tr-TR")}`,
    `${en ? "Projects" : "Proje"}: ${certs.length}`,
    ""];
  certs.forEach((b, i) => {
    const nn = String(i + 1).padStart(2, "0");
    const dir = nn + "-" + String(b.project || "proje").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 30);
    try {
      buildWokwiProjectFiles(b.guide, { student: b.student || "", classCode: b.classCode || "" }).forEach((f) => {
        files.push({ name: dir + "/" + f.name, content: f.content });
      });
      // Sertifikanın kendisi de klasöre girsin: baskı-dostu SVG (PDF'e dönüştürülebilir)
      files.push({ name: dir + "/" + (en ? "CERTIFICATE.svg" : "SERTIFIKA.svg"), content: certificateSVG(b.guide, b.student, b.ts) });
      lines.push(`${nn}. ${b.project}${b.difficulty ? " (" + b.difficulty + ")" : ""} → ${dir}/`);
    } catch (e) {
      lines.push(`${nn}. ${b.project} — ${en ? "package skipped" : "paket atlandı"}`);
    }
  });
  // Bütçe özeti: her projenin tahmini maliyeti + portfolyo toplamı (v2.11.0)
  let budgetSum = 0;
  lines.push("", en ? "💰 BUDGET SUMMARY" : "💰 BÜTÇE ÖZETİ", "-".repeat(46));
  certs.forEach((b, i) => {
    const est = estimateCost(b.guide);
    budgetSum += est.totalUSD;
    const nn = String(i + 1).padStart(2, "0");
    lines.push(`${nn}. ${b.project}: ${est.totalUSD > 0 ? fmtTL(est.totalUSD) : (en ? "not priced" : "fiyatlanmadı")}${est.anyUnknown ? (en ? " (some parts unpriced)" : " (bazı parçalar fiyatlanmadı)") : ""}`);
  });
  lines.push("-".repeat(46), `${en ? "PORTFOLIO TOTAL" : "PORTFOLYO TOPLAMI"}: ${fmtTL(budgetSum)}`, en ? "* average retail estimates, not a shopping list" : "* ortalama perakende tahminleri, alışveriş listesi değildir");
  /* v2.20.0: RAPOR.md — favoriler ve etiketler zip'e özet olarak girer */
  const favCerts = certs.filter((b) => archiveMeta({ meta: (loadArchive().find((x) => x.guide && (x.guide.title || "") === (b.project || "") && x.guide.code === b.guide.code) || {}).meta }).fav);
  const tagLines = [];
  loadArchive().forEach((item) => {
    const m = archiveMeta(item);
    if (m.tags.length) tagLines.push(`- ${item.guide && item.guide.title ? item.guide.title : "—"}: ${m.tags.join(", ")}`);
  });
  if (favCerts.length || tagLines.length) {
    const report = [en ? "# Project report" : "# Proje Raporu", ""];
    if (favCerts.length) report.push(en ? `## ⭐ Favorites (${favCerts.length})` : `## ⭐ Favoriler (${favCerts.length})`, ...favCerts.map((b, i) => `${i + 1}. ${b.project}${b.difficulty ? " (" + b.difficulty + ")" : ""}`), "");
    if (tagLines.length) report.push(en ? "## 🏷️ Tags" : "## 🏷️ Etiketler", ...tagLines, "");
    files.push({ name: en ? "REPORT.md" : "RAPOR.md", content: report.join("\n") });
  }
  // Öğretmenin özel fiyat kataloğu + bütçe sınırı da arşive girsin (v2.13.0) —
  // veliler/okul idaresi fiyatların nereden geldiğini görebilir
  const customPrices = loadCustomPrices();
  if (Object.keys(customPrices).length || loadBudget()) {
    files.push({ name: en ? "price-catalog.json" : "fiyat-katalogu.json", content: JSON.stringify({ app: "arduino-ruya-atolyesi", kind: "fiyat-katalogu", version: 1, prices: customPrices, budget: loadBudget() }, null, 2) });
    lines.push(en ? "📎 price-catalog.json: teacher's custom prices & budget are included in this archive" : "📎 fiyat-katalogu.json: öğretmenin özel fiyatları ve bütçe sınırı bu arşivdedir");
  }
  files.push({ name: en ? "PORTFOLIO.txt" : "PORTFOLYO.txt", content: lines.join("\n") + "\n" });
  downloadFileBlob(makeZip(files), "portfolyo.zip");
}