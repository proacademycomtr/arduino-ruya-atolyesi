# 📋 Sürüm Notları — Fiyat Tahmini Dönemi (v2.10.0 → v2.14.0)

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

---

*Fiyatlar ortalama Türkiye perakende tahminleridir; alışveriş listesi değildir. Kur değişimi için Ayarlar'dan özel fiyat girin.*
