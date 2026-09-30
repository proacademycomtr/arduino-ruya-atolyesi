# Changelog

Bu dosya `build.py` tarafından otomatik güncellenir.

## [2.15.0] - 2026-09-30

- Sürüm 2.15.0 olarak derlendi.
- Yeni: 💱 **Çevrimiçi kur** — Ayarlar'da "1 USD = X₺ (zaman önce güncellendi)" durumu + 🌐 Çevrimiçi Güncelle düğmesi; exchangerate.host/er-api'den çekilir, localStorage'da saklanır, hata anında saklanan/varsayılan kur (34) kullanılır. Tüm ₺ gösterimleri (tablo, PDF, rapor, sertifika, Portfolyo, kart) bu kurdan hesaplanır
- Yeni: 🚀 **publish.sh** — test + sürümlü derleme + gh-pages yenileme + push'u tek komutta birleştiren yayın script'i (./publish.sh veya ./publish.sh 2.16.0)
- Yeni: 🤝 **CONTRIBUTING.md** + 🐛/💡 issue şablonları + PR şablonu
- Not: Proje ~/Documents/GitHub/arduino-ruya-atolyesi'ye taşındı; GitHub Pages canlı: proacademycomtr.github.io/arduino-ruya-atolyesi

## [2.14.0] - 2026-09-30

- Sürüm 2.14.0 olarak derlendi.
- Yeni: 📁 **Depoda varsayılan katalog** — `fiyat-katalogu.json` artık projenin kökünde; build.py onu hem dist'e kopyalar hem FILE_CATALOG olarak JS'e gömer. Fiyat önceliği: öğretmen özel (localStorage) → depo → gömülü PRICE_CATALOG; Ayarlar'daki bütçe alanı depo sınırını placeholder olarak gösterir
- Yeni: 💡 **Bütçe aşımı önerisi** — toplam sınırı aşarsa tabloda "Bütçe önerisi: Arduino Uno yerine Arduino Nano kullan ($10.00 → $6.00)" satırı (özel fiyatlar da hesaba katılır)
- Yeni: ⌨️ **Canlı maliyet ipucu** — fikir yazarken 30+ karakterde demo rehber üzerinden anlık tahmin: "💡 Bu fikre benzer proje ≈ 646.00₺ ($19.00)" (400ms gecikmeli)
- Yeni: 📋 **SÜRÜM_NOTLARI.md** — v2.10→v2.14 fiyat modülünün tamamını özetleyen sürüm notları sayfası

## [2.13.0] - 2026-09-30

- Sürüm 2.13.0 olarak derlendi.
- Yeni: 🔽 **Fiyata göre sıralama** — malzeme tablosunun Tutar başlığındaki düğme pahalıdan ucuza (↓) → ucuza pahalıya (↑) → orijinal sıra (⇅) döngüsü yapar; fiyatlanamayan parçalar her zaman sonda, tercih hatırlanır
- Yeni: 📎 **Portfolyo.zip'e fiyat katalogu** — öğretmen özel fiyatları + bütçe sınırı `fiyat-katalogu.json` olarak arşive girer; PORTFOLYO.txt'te veliler/okul idaresi için açıklama notu taşır (katalog boşsa dosya üretilmez)
- Yeni: 💰 **Sınıf raporunda toplam bütçe** — tüm öğrencilerin projelerinin tahmini maliyeti toplanır ve raporun üstünde "Sınıf toplam bütçesi" satırında gösterilir; bütçe sınırı aşılırsa ⚠️ "bütçe aşımı" işaretiyle
- Gelişti: 🏅 **Sertifikada bütçe aşımı işareti** — proje maliyeti öğretmen sınırını aşarsa sertifika şeridi (PDF + Portfolyo SVG'si) kırmızıya döner: "⚠️ BÜTÇE AŞIMI"; sınır içindeyse altın şerit + normal not

## [2.12.0] - 2026-09-30

- Sürüm 2.12.0 olarak derlendi.
- Değişti: 💱 **TL ana para birimi** — tüm fiyat gösterimlerinde ₺ öncelikli, $ parantez içinde ikincil: `612.00₺ ($18.00)`; tablo, PDF, sınıf raporu, WhatsApp, sertifika kartı ve Portfolyo özetinde tek biçim
- Yeni: 🎯 **Bütçe sınırı uyarısı** — Ayarlar'dan USD cinsinden üst sınır girilir; proje toplamı aşarsa malzeme tablosunda ⚠️ kırmızı "Bütçe aşımı (Sınır: …)" satırı ve PDF'te "bütçe aşımı" etiketi; 0/boş = kapalı, cihaz tercihi (yedeğe girmez)
- Yeni: 🏅 **Sertifikada fiyat şeridi** — PDF (canvas) ve Portfolyo SVG sertifikasında altın yuvarlak köşeli şerit: "Tahmini proje maliyeti: 612.00₺ ($18.00) · ortalama perakende tahmini"
- Yeni: 📤 **Katalog JSON paylaşımı** — öğretmen özel fiyatlarını + bütçe sınırını `fiyat-katalogu.json` olarak dışa aktarır; diğer öğretmen aynı dosyayı içe aktararak katalogu devralır (sayı olmayan fiyatlar sessizce atlanır)

## [2.11.0] - 2026-09-29

- Sürüm 2.11.0 olarak derlendi.
- Yeni: 🏷️ **Öğretmen fiyat kataloğu** — Ayarlar'a "Parça adı: fiyat (USD)" satırları yazılır (noktalı/virgüllü ondalık ikisi de olur), localStorage'da kalıcıdır ve fiyat tahmininde katalog fiyatının YERİNE geçer; en uzun eşleşen ad kazanır, ✏️ işaretiyle tabloda belli olur
- Yeni: 🔢 **Canlı adet düzenleyici** — malzeme tablosunda her satırda −/+ düğmeleri ve yazılabilir adet kutusu; toplam anında güncellenir, adetler proje başına localStorage'da saklanır
- Yeni: 📊 **Sınıf raporunda Maliyet sütunu** — gönderim dosyası artık proje malzemelerini taşır; öğretmen her öğrencinin projesinin tahmini maliyetini raporda görür
- Yeni: 💰 **Portfolyo.zip'e bütçe özeti** — PORTFOLYO.txt'te proje başına tahmini maliyet + portfolyo toplamı ("alışveriş listesi değildir" notuyla)

## [2.10.0] - 2026-09-29

- Sürüm 2.10.0 olarak derlendi.
- Yeni: 💰 **Malzeme fiyat tahmini** — her rehberin malzeme tablosunda Birim Fiyat ve Tutar sütunları; yaklaşık Türkiye perakende fiyatları 39 parçalık katalogdan ($ + ₺ çift gösterim, kur bilgi amaçlı ~34)
- Yeni: **Ortalama Proje Fiyatı** satırı — adet × birim hesabıyla proje toplamı; katalogda olmayan parçalar "—" ile işaretlenir ve toplama katılmaz
- PDF çıktısı ve WhatsApp paylaşımı da fiyat toplamını taşır; sertifika projesi kartına 4. istatistik kutusu (≈ fiyat) eklendi
- AI rehberlerinde de çalışır: AI malzeme adlarını aynı katalogla fiyatlar, bilinmeyenler dürüstçe "fiyatlanmadı" olarak gösterilir

## [2.9.0] - 2026-09-28

- Sürüm 2.9.0 olarak derlendi.
- Yeni: 🌙🎲📏 **3 yeni demo rehber** — otomatik gece lambası (LDR + histeresis), butonla atılan dijital zar (randomSeed gürültü tohumu, 6 LED'li zar yüzleri), OLED mesafe ölçer (HC-SR04 + SSD1306 ikili kütüphane); üçü de wokwiValidate'ten 0 uyarıyla geçer ve 🚀 İleri Seviye bölümü taşır. Demo sayısı 11 → 14; altın rozet eşiği artık demo sayısından otomatik türetilir
- Yeni: 📜 **Portfolyo.zip'e sertifikalar** — her proje klasörüne baskı-dostu SERTIFIKA.svg eklenir (certificateSVG, certCanvas ile aynı görsel dil)
- Yeni: ⚡ **Toplu geri bildirim** — öğretmen panelinde yorumu bekleyen tüm gönderiler tek listede; "Hepsini İndir" her öğrenciye kişisel .geribildirim.json dosyası indirir ve gönderileri işaretler
- Yeni: 💾 **Veri yedeği** — Ayarlar'dan tüm uygulama verisi (arşiv, adımlar, sınıf, gönderiler, rozetler, geri bildirimler, özel bileşenler) tek .yedek.json dosyasına dışa aktarılır / başka bilgisayarda geri yüklenir; dil/tema gibi cihaz yerel tercihleri hariçtir
- Çözücü iyileştirmeleri: satır sahibi parça tespiti ("OLED GND → GND" satırındaki GND, satırdaki OLED parçasınındır), çoklu örnek parça bağlantıları (LED1/LED2… ayrı ayrı çözülür), OLED'de LCD'ye yanlış eşleşme engellendi, wokwi-7segment DP pini, RGB/OLED'de boşta düz LED parçası üretilmez

## [2.8.0] - 2026-09-28

- Sürüm 2.8.0 olarak derlendi.
- Yeni: 🎨🔧🕐 **3 yeni demo rehber** — LCD'li dijital saat (I2C, millis() sayaç), RGB LED mood lambası (0-767 ton haritası, PWM karıştırma), servo kapı kilidi (kenar algılama, durum makinesi); üçü de wokwiValidate'ten 0 uyarıyla geçer ve 🚀 İleri Seviye bölümü taşır
- Yeni: 📄 **Sınıf raporuna Geri Bildirim sütunu** — her gönderimde "Verildi ✓ / Bekliyor" durumu + varsa öğretmen yorumunun 80 karakterlik özeti
- Yeni: 🥉🥈🥇 **Rozet kademeleri** — Başarımlar modalında bronz (3 sertifika) / gümüş (5) / altın (tüm 11 demo) ilerleme kartı + "sonraki hedef" metni
- Yeni: 📦 **Portfolyo.zip** — sertifikalı tüm rehberlerin Wokwi paketleri (sketch.ino + diagram.json + öğretmen notları) numaralı klasörler hâlinde tek arşivde; kökte PORTFOLYO.txt özeti. Sertifikalar artık rehber snapshot'ı saklar; eski guide'sız kayıtlar atlanır
- Düzeltme: RGB projesinde "RGB LED" metni ayrıca boşta bir wokwi-led parçası üretiyordu — RGB varken düz LED eklenmez

## [2.7.0] - 2026-09-25

- Sürüm 2.7.0 olarak derlendi.
- Yeni: 🏫 **Öğretmen paneli** — Sınıf Modu artık iki sütunlu geniş panel: solda sınıf kodu + içe aktarma + rapor, sağda ilerleme yüzdeli gönderi kartları ve geri bildirim yazma (tek ekranda)
- Yeni: 🏅 **Öğrenci başarımları** — header'da sayaçlı yeni düğme; kazanılan sertifikalar + okunan öğretmen geri bildirimleri kart görünümünde listelenir (mükerrer kayıt engellenir)
- Yeni: 🚀 **İleri Seviye bölümü** — 7 segment (ikinci display ile 0-99 multiplexing, butonla durdur/başlat) ve piyano (kayıt/çalma, pot ile oktav) demo rehberlerine katlanabilir gelişmiş kutu: ek wiring satırları + kod parçaları
- Yeni: 📦 **Zip kişiselleştirme** — Wokwi paketi öğrenci adı + sınıf kodunu bilir: sketch.ino'ya başlık yorumu, öğretmen notlarına "Öğrenci / Sınıf kodu" satırları (ad: gönderim/sertifika girişlerinden)

## [2.6.0] - 2026-09-25

- Sürüm 2.6.0 olarak derlendi.
- Yeni: 💬 **Öğretmen geri bildirimi** — öğretmen içe aktarılan gönderiye yorum yazar, `.geribildirim.json` indirir; öğrenci "Geri Bildirimi Göster" ile açıp rehberde okur (yorumlar tarayıcıda saklanır)
- Yeni: ⚡ **Wokwi'de Aç güçlendirildi** — sketch kodu + tüm bağlantılar çözülmüşse diagram.json tek kopyada panoya; Wokwi şablonu yeni sekmede açılır
- Yeni: 🏆 **Lider tablosu** — sınıf raporuna ilerlemeye göre sıralı SVG çubuk grafik (ilk 10, print-to-PDF dostu, bağımlılıksız)
- Yeni: 🔢🚗🎹 **3 yeni demo rehber** — 7 segment display sayacı (wokwi-7segment, ortak katot), ultrasonik park sensörü, buzzer'lı mini piyano (INPUT_PULLUP, 4 buton); üçü de wokwiValidate'ten 0 uyarıyla geçer
- Düzeltme: sınıf gönderim içe aktarma tek-nesne `.klasor.json` biçimini kabul eder (dizi/sarmalayıcı yanına)
- Düzeltme: çözücüde tek harfli pin kelimeleri ("Display A") sahip parça adına gömülü olduğu için yutuluyordu — 3+ harf sınırıyla pinler doğru çözülür

## [2.5.0] - 2026-09-25

- Sürüm 2.5.0 olarak derlendi.
- Yeni: 🏫 **Sınıf Modu** — öğretmen sınıf kodu üretir, öğrenci adımlarını tamamlayıp `.klasor.json` gönderim dosyası indirir; öğretmen gönderimleri içe aktarıp PDF sınıf raporu alır (sunucusuz, dosya tabanlı)
- Yeni: 📦 **Wokwi Paketi (.zip)** — rehberden sketch.ino + diagram.json + öğretmen notları içeren gerçek proje arşivi; bağımlılıksız zip yazıcı (STORE yöntemi, CRC32 doğrulanmış)
- Yeni: 🛠️ **Adım takibi** — her adımda onay kutusu + ilerleme çubuğu; tüm adımlar bitince sertifika ve gönderim satırları açılır
- Yeni: 🧪 birim testler — `node --test tests/`; çözücü, wokwiValidate, zip yazıcı, sınıf gönderimi ve özel set normalize senaryoları (16 test, app.js sanal ortamda değerlendirilir)

## [2.4.0] - 2026-09-25

- Sürüm 2.4.0 olarak derlendi.
- Yeni: 5 demo rehbere `wokwiHints` — demo modunda bile gerçek röle/motor/servo kablolaması çıkar (L298N/DC motor Wokwi'de olmadığı için potansiyometre ile simüle edilir, satır notuyla açıklanır)
- Yeni: `wokwiValidate` taslak doğrulaması — pin çakışması (aynı pine iki kablo) + eksik GND/5V uyarıları, öğretici kontrol kutusunda
- Yeni: sertifika penceresine 1080×1080 paylaşım kartı PNG indirme düğmesi
- Yeni: özel bileşen seti — öğretmenler bileşen ekler, JSON olarak dışa/içe aktarır (localStorage kalıcı, "Özel Set" kategorisi)
- Düzeltme: Wokwi parça tipleri gerçek adlarına güncellendi (relay-module, lcd1602, pir-motion-sensor, photoresistor-sensor, ssd1306)
- Düzeltme: AI prompt'u yalnızca geçerli Wokwi tiplerini listeler; L298N/DC motor uydurma tip yerine NULL döndürür
- İyileştirme: kablo çözücü — ARDUINO öneki, ~10 PWM pini, satır-sahibi parça yönlendirmesi, çoklu aynı-tip parça desteği
- Düzeltme: çözücü büyük/küçük harf duyarsız; "IR sensör SOL — OUT" gibi tireli satırlar çözülür; VCC/GND satırın kendi parçasına bağlanır (yanlış hint-parçası değil)
- Düzeltme: "DC motor" artık yanlışlıkla "Servo Motor" kütüphane parçasına eşleşmez (genel kelimeler eşleştirmede hariç)

## [2.3.0] - 2026-09-24

- Sürüm 2.3.0 olarak derlendi.
- Yeni: AI şemasına `wokwiHints` alanı — her malzeme için Wokwi parça tipi + pin eşlemesi; kablo üretimi bunları öncelikli kullanır
- Yeni: bileşen kütüphanesi kartlarına Wokwi parça tipi/pin eşlemeleri eklendi ve taslak üretiminde kullanılıyor
- Yeni: eşleşmeyen bağlantı satırları için rehberde öğretici yardım kutusu
- Yeni: arşivden tek tıkla sertifika üretimi (🏅, ad sorulur, PDF iner)
- İyileştirme: sertifika adı hatırlanır, sonraki sertifikalarda önerilir

## [2.2.0] - 2026-09-24

- Sürüm 2.2.0 olarak derlendi.
- Yeni: sürüm rozeti + sürüm geçmişi modalı (footer)
- Yeni: paylaşım kartını Web Share API ile doğrudan paylaşma (desteklenmezse indirme)
- Yeni: PWA — manifest + service worker ile çevrimdışı kullanım
- Yeni: Wokwi diagram.json kopyalarken parça/kablo özeti ve eşleşmeyen satır uyarısı

## [2.1.0] - 2026-09-24

- Sürüm 2.1.0 olarak derlendi.
