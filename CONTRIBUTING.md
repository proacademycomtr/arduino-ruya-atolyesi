# 🤝 Katkı Rehberi

Arduino Rüya Atölyesi'ne katkılarınız hoş geldiniz! Öğrencilerin ve öğretmenlerin daha iyi bir deneyim yaşaması için birlikte geliştirelim.

## 🚀 Hızlı Başlangıç

```bash
git clone https://github.com/proacademycomtr/arduino-ruya-atolyesi.git
cd arduino-ruya-atolyesi
node --test tests/          # 51+ test geçmeli
python3 build.py            # dist/index.html üretir
# dist/index.html'i tarayıcıda aç — kurulum yok
```

Gereksinimler: Node.js 18+, Python 3.8+. Başka bağımlılık yok.

## 🧪 Kurallar

1. **Testler önce:** Yeni mantık eklerken `tests/core.test.js`'e test yazın; `node --test tests/` tamamen geçmeli.
2. **Küçük PR'lar:** Bir PR = bir özellik/düzeltme. Açıklayıcı başlık + açıklama.
3. **Sürüm:** Davranış değişikliklerinde `python3 build.py X.Y.Z` ile sürüm yükseltin ve CHANGELOG'a madde ekleyin.
4. **Yayın:** Ana dalda birleşen değişiklikler `./publish.sh` ile gh-pages'e taşınır (testleri geçmeden yayına gitmez).

## 🗂️ Proje Yapısı

- `index.html` + `style.css` + `app.js` → kaynak (app.js ~5.5k satır, tüm mantık)
- `build.py` → tek dosyalık `dist/index.html` derler + sürüm/CHANGELOG yönetimi
- `tests/` → `app.js`'ten saf fonksiyonları çıkarıp vm'de çalıştıran birim testler
- `fiyat-katalogu.json` → depoda tutulan varsayılan öğretmen fiyat kataloğu
- `publish.sh` → test + build + gh-pages yayını tek komut

## 🐛 Hata mı buldunuz?

"Sorun raporu" şablonuyla açın: ne oldu, ne beklerdiniz, hangi tarayıcı. Ekran görüntüsü altın değerinde.

## 💡 Özellik fikri mi?

"Özellik önerisi" şablonunu kullanın — öğretmen/öğrenci perspektifinden beklenen davranışı yazarsanız çok hızlı ilerleriz.

## 📜 Davranış Kuralları

Nazik olalım — bu proje çocukların hayallerini gerçekleştirmek için var. 🎈
