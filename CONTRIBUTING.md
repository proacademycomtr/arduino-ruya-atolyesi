# 🤝 Katkı Rehberi

Arduino Rüya Atölyesi'ne katkılarınız hoş geldiniz! Öğrencilerin ve öğretmenlerin daha iyi bir deneyim yaşaması için birlikte geliştirelim.

## 🚀 Hızlı Başlangıç

```bash
git clone https://github.com/proacademycomtr/arduino-ruya-atolyesi.git
cd arduino-ruya-atolyesi
node --test tests/          # 100+ test geçmeli (birim + tarayıcı)
python3 build.py            # dist/index.html üretir
node scripts/e2e.mjs        # yalnız tarayıcı testleri (npm install gerekli)
# dist/index.html'i tarayıcıda aç — kurulum yok
```

Gereksinimler: Node.js 18+, Python 3.8+. Başka bağımlılık yok (E2E için `npm install`).

## 🌐 Tarayıcı testleri (E2E)

Tarayıcı senaryoları **node --test içinde** koşar: `tests/e2e.test.mjs` her senaryoyu bir test olarak sarmalılar, tanımın kendisi `scripts/e2e.mjs` modülündedir. Yani `node --test tests/` birim + tarayıcı testlerinin ikisini birden koşar.

Her senaryo **kendi browser context'inde**, temiz localStorage ve sıfır modül durumuyla çalışır — senaryolar birbirinden ve sıralamadan bağımsızdır, verilerini `seedClassroom()` / `seedArchive()` gibi yardımcılarla kendileri kurar.

```bash
node --test tests/                 # hepsi (birim + E2E) — CI'ın çalıştırdığı
node scripts/e2e.mjs --list        # senaryo kimliklerini listeler
node scripts/e2e.mjs --only 12     # tek senaryo (~20 sn)
node scripts/e2e.mjs --only 9-12   # aralık
node scripts/e2e.mjs --only 6,12   # çoklu seçim
node scripts/e2e.mjs <url> --only 12   # canlı siteye karşı da koşar
```

Yeni senaryo eklerken: veriyi kendi `scenario("kimlik", async (page) => {...})` bloğunda kurun, diğer senaryoların bıraktığı localStorage'a güvenmeyin. Senaryo eklendiğinde `tests/e2e.test.mjs` içindeki kimlik listesini de güncelleyin.

## 🧪 Kurallar

1. **Testler önce:** Yeni mantık eklerken `tests/core.test.js`'e test yazın; `node --test tests/` (birim + tarayıcı) tamamen geçmeli.
2. **Küçük PR'lar:** Bir PR = bir özellik/düzeltme. Açıklayıcı başlık + açıklama.
3. **Sürüm:** Davranış değişikliklerinde `python3 build.py X.Y.Z` ile sürüm yükseltin ve CHANGELOG'a madde ekleyin.
4. **Yayın:** Ana dalda birleşen değişiklikler `./publish.sh` ile gh-pages'e taşınır (testleri geçmeden yayına gitmez).

## 🗂️ Proje Yapısı

- `index.html` + `style.css` + `app.js` → kaynak (app.js ~5.5k satır, tüm mantık)
- `build.py` → tek dosyalık `dist/index.html` derler + sürüm/CHANGELOG yönetimi
- `tests/` → `app.js`'ten saf fonksiyonları çıkarıp vm'de çalıştıran birim testler
- `scripts/e2e.mjs` → Playwright ile 13 bağımsız tarayıcı senaryosu (`--only` ile tekil çalıştırılır); `tests/e2e.test.mjs` bunları node --test içinde koşur
- `fiyat-katalogu.json` → depoda tutulan varsayılan öğretmen fiyat kataloğu
- `publish.sh` → test + build + gh-pages yayını tek komut

## 🐛 Hata mı buldunuz?

"Sorun raporu" şablonuyla açın: ne oldu, ne beklerdiniz, hangi tarayıcı. Ekran görüntüsü altın değerinde.

## 💡 Özellik fikri mi?

"Özellik önerisi" şablonunu kullanın — öğretmen/öğrenci perspektifinden beklenen davranışı yazarsanız çok hızlı ilerleriz.

## 📜 Davranış Kuralları

Nazik olalım — bu proje çocukların hayallerini gerçekleştirmek için var. 🎈
