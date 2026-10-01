# 📋 Sürüm Notları — Fiyat Tahmini Dönemi (v2.10.0 → v2.20.0)

Arduino Rüya Atölyesi'nin malzeme fiyatı modülünün baştan sona hikâyesi.
Tüm fiyatlar **₺ ana, $ ikincil** gösterilir (kur ≈ 34, bilgi amaçlı).

---

## 💱 v2.10.0 — Malzeme Fiyat Tahmini (temel)

- Rehber malzeme tablosunda **Birim Fiyat / Tutar** sütunları ve altta teal vurgulu **"💰 Ortalama Proje Fiyatı"** toplam satırı.
- **39 parçalık yaklaşık perakende katalog** (Arduino Uno $10'dan 220Ω dirence $0.10'a) — adlar `foldTR` katlamasıyla "içerir" mantığıyla eşlenir, en uzun anahtar kazanır.
- Adetler `"1+10"` gibi yazılsa bile sayıya düşer; katalogda olmayan parça **"—"** ile dürüstçe işaretlenir, toplama katılmaz.
- PDF çıktısı ve WhatsApp paylaşımı da fiyat toplamını taşır; sertifika projesi kartına 4. istatistik kutusu (≈ fiyat).

## 🏷️ v2.11.0 — Öğretmen Kataloğu ve Canlı Düzenleme

- **Öğretmen fiyat kataloğu:** Ayarlar'da `Parça adı: fiyat (USD)` satırları; katalog fiyatının **yerine** geçer (✏️ işaretiyle belli olur). En uzun eşleşen ad kazanır.
- **Canlı adet düzenleyici:** her satırda −/+ düğmeleri ve yazılabilir kutu; toplam anında güncellenir, adetler proje başına localStorage'da saklanır.
- **Sınıf raporunda Maliyet sütunu:** gönderim dosyası proje malzemelerini taşır; öğretmen her öğrencinin projesinin maliyetini görür.
- **Portfolyo.zip'e bütçe özeti:** proje başına maliyet + PORTFOLYO TOPLAMI ("alışveriş listesi değildir" notuyla).

## 🎯 v2.12.0 — TL Ana Birim, Bütçe Sınırı, Sertifika Şeridi

- **TL ana para birimi:** tüm gösterimler `612.00₺ ($18.00)` biçiminde (tablo, PDF, rapor, WhatsApp, kart, Portfolyo).
- **Bütçe sınırı:** Ayarlar'dan USD üst sınır; aşılırsa tabloda ⚠️ kırmızı "Bütçe aşımı (Sınır: …)" + PDF'te etiket. 0/boş = kapalı.
- **Sertifikada fiyat şeridi:** PDF (canvas) ve Portfolyo SVG'sinde altın yuvarlak şerit: "Tahmini proje maliyeti: … · ortalama perakende tahmini".
- **Katalog JSON paylaşımı:** `fiyat-katalogu.json` dışa/içe aktarma — öğretmenler katalogu birbirine devreder.

## 🔽 v2.13.0 — Sıralama, Paylaşım, Topluluk

- **Fiyata göre sıralama:** Tutar başlığındaki düğme pahalıdan ucuza (↓) → ucuza pahalıya (↑) → orijinal (⇅); fiyatlanamayanlar sonda.
- **Portfolyo'ya katalog dosyası:** öğretmen katalogu `fiyat-katalogu.json` olarak arşive gömülür (veliler/okul idaresi için notla).
- **Sınıf toplam bütçesi:** raporda tüm projelerin maliyeti toplanır; sınır aşımında ⚠️ işaret.
- **Sertifikada aşım işareti:** maliyet sınırı aşarsa sertifika şeridi kırmızıya döner: "⚠️ BÜTÇE AŞIMI".

## 🚀 v2.14.0 — Depo Kataloğu, Akıllı Öneri, Canlı Tahmin

- **Depoda varsayılan katalog:** `fiyat-katalogu.json` artık projenin kökünde; derlemede dist'e kopyalanır, uygulama açılışta yükler. Öğretmen localStorage katalogu hâlâ en son sözü söyler: **özel → depo → gömülü** önceliği.
- **Bütçe aşımı önerisi:** toplam sınırı aşarsa tabloda "💡 Bütçe önerisi: Arduino Uno yerine Arduino Nano kullan ($10 → $6)" satırı — Uno/Nano çifti katalogda tanımlı.
- **Canlı maliyet ipucu:** fikir yazarken (30+ karakter) demo rehber üzerinden anlık tahmin: "💡 Bu fikre benzer proje ≈ 646.00₺ ($19.00)".
- **Sürüm notları sayfası:** bu dosya.

## 🌐 v2.15.0 — Çevrimiçi Kur, Yayın, Katkı Altyapısı

- **Çevrimiçi kur:** Ayarlar'da kur durumu + 🌐 güncelleme düğmesi (exchangerate.host → er-api yedek); localStorage'da saklanır, hata anında saklanan/varsayılan kur (34) kullanılır. Tüm ₺ gösterimleri tek `rate()` fonksiyonundan.
- **GitHub Pages:** proje `~/Documents/GitHub/arduino-ruya-atolyesi`'ye taşındı, canlı site açıldı.
- **publish.sh:** test + sürümlü derleme + gh-pages yenileme + push tek komut.
- **CONTRIBUTING + şablonlar:** katkı rehberi, 🐛/💡 issue şablonları, PR kontrol listesi.

## ✨ v2.16.0 — AI'lı Tahmin, Otomatik Kur, E2E

- **AI'lı canlı tahmin:** API anahtarı varsa fikir AI'a kısa istemle gider, AI gerçek parça listesi döndürür ve fiyatlanır ("✨ AI tahmini ≈ …"); yoksa demo ipucusuna düşer. 10 dk önbellek + yarış koşulu koruması.
- **Otomatik kur tazeleme:** açılışta kur 24 saatten eskiyse sessiz güncelleme + rehberi yeniden çizme.
- **E2E testleri:** `scripts/e2e.mjs` — Playwright ile 11 kontrollük tarayıcı testi (tablo, sıralama, bütçe, sertifika, adet kalıcılığı).
- **PWA doğrulaması:** manifest/icon/sw canlıda 200 + service worker aktif.

## 📊 v2.17.0 — Sınıf Analitiği

- **Haftalık ilerleme grafiği:** sınıf raporunda gönderimlerin tamamlanan adımları haftaya kümelendirilir, son 8 haftanın çubuk grafiği basılır.
- **Sınıf bütçe planlayıcısı:** Ayarlar'a sınıf mevcudu girilir; rapor mevcut × ortalama proje maliyetiyle tüm sınıfın bütçe ihtiyacını hesaplar ve öğretmen sınırıyla karşılaştırır.
- **README görseli + CI E2E:** canlı uygulama ekran görüntüsü repoda; GitHub Actions artık Playwright E2E'yi de koşar.

## 🧭 v2.20.0 — Takip Et ve Keşfet

- **CSV tarih filtresi:** panelde başlangıç/bitiş tarihi seç — CSV indirimi ve gönderi listesi bu aralığa süzülür, seçim localStorage'da korunur; sınıf raporu başlığında "CSV tarih aralığı: … (n/total)" notu düşer; ✕ tek tıkla temizler.
- **Arşiv favori/etiketler:** ⭐ favorile, 🏷️ virgülle ayırarak (en çok 5) etiketle; ⭐ Favoriler / 🏷️ etiket çipleriyle filtrele. Favoriler Portfolyo.zip'te önce numara alır, zip'e favoriler + etiket özetli RAPOR.md girer.
- **Göz serbest modu:** "Bana Anlat" artık adım adım okur — her adım bitince 2 sn bekler, adımı otomatik işaretler ve sonrakine geçer; daha önce işaretli adımlardan kaldığı yerden devam eder.
- **Test:** 72 birim (5 yeni), E2E 17 kontrol (2 yeni).

## 🧭 v2.19.0 — Paylaş ve Bul

- **Alışveriş listesi:** rehber aksiyonlarında 🛒 düğme — malzemeleri "parça × adet — satır toplamı" olarak WhatsApp'a hazır metne döker; adet geçersiz kılmaları yansır, popup engellenirse panoya kopyalanır.
- **Gönderi arama + sayfalama:** panelde Türkçe harf duyarsız arama (foldTR) + 6'şarlı sayfalama; arama yazarken odak kaybolmaz.
- **En aktif hafta:** sınıf raporunda haftalık grafiğin altında özet satırı — ortak mondayOf yardımcısı Pazartesi kümelerini hem grafikte hem özette kullanır.
- **Test:** 67 birim (4 yeni), E2E 15 kontrol (4 yeni).

## 🧭 v2.18.0 — Akıllı Öğretmen Paneli

- **Katalog öneri çipleri:** panel, depo kataloğunda (fiyat-katalogu.json) olup henüz özel fiyatı olmayan parçaları çip olarak önerir; tek tıkla özel fiyat listesine depo fiyatıyla eklenir, Ayarlar editörüyle senkron kalır.
- **Risk altındaki öğrenciler:** son 10 gündür yeni adım göndermemiş + projesi bitmemiş öğrenciler en eski tarihli önce, kırmızı vurgulu kartta listelenir.
- **Fiyatlanamayan malzemeler:** hiçbir katalog katmanında olmayan parça adları sınıf genelinde toplanır (harf farkı birleştirilir, adet sayılır) — öğretmene "şunları fiyat listene ekle" der.
- **CSV dışa aktarma:** gönderiler Excel uyumlu `.csv` olarak iner (UTF-8 BOM + ';' ayırıcı); ilerleme %, tahmini maliyet USD, geri bildirim ve tarih sütunlarıyla.
- **Test:** 63 birim test (5 yeni), E2E 11 kontrol aynı.

---

*Fiyatlar ortalama Türkiye perakende tahminleridir; alışveriş listesi değildir. Kur Ayarlar'dan çevrimiçi güncellenir (varsayılan 34).*
