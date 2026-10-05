/**
 * v4.0.0 — Üyelik akışının canlı doğrulaması (tarayıcı).
 *
 * Çalıştırma (API ayakta ve dist/ API_BASE ile derlenmiş olmalı):
 *   node scripts/verify-member.mjs
 *
 * Kontroller:
 *   1. Başlıkta 👤 ve 🌍 düğmeleri görünür
 *   2. Giriş penceresi açılır, ücretsiz kayıt çalışır
 *   3. Düğme kullanıcı adını gösterir, kalan hak yazılır
 *   4. Duvar açılır; üye olmayan için prompt'lar KİLİTLİ
 *   5. Hak bitince yapay zekâ çağrısı paywall'a düşer
 *   6. Çıkış yapınca düğme "Giriş"e döner
 */
import { chromium } from "playwright";

const SITE = process.env.SITE || "http://127.0.0.1:8000/index.html";
// dist/config.js içindeki adresle aynı olmalı; sayfa içinden API'ye sormak için.
const API_BASE = process.env.API_BASE || "http://127.0.0.1:4021";
const email = `demo${Date.now().toString(36)}@example.com`;
const password = "deneme12345";
// Beğeni/yorum yazmak üyeye açıktır; üye bir hesapla giriş yapılır (bkz. prisma/seed.js).
const uye = {
  email: process.env.MEMBER_EMAIL || "deniz@example.com",
  password: process.env.MEMBER_PASSWORD || "demo1234"
};

let browser;
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

// Sunucudaki foldTR ile aynı eşleme (bkz. server/src/str.js): Türkçe
// harfleri ASCII karşılıklarına katlar, aksanları atar.
const TR_MAP = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U" };
function foldTR(s) {
  return String(s)
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_MAP[c])
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(SITE + "?nocache=" + Date.now(), { waitUntil: "load" });

  // 1) Header düğmeleri
  const authBtn = page.locator("#authBtn");
  const wallBtn = page.locator("#wallBtn");
  await page.waitForFunction(() => {
    const b = document.getElementById("authBtn");
    return b && b.dataset.state;
  }, { timeout: 10000 }).catch(() => {});
  check("Başlıkta 🌍 Duvar düğmesi görünür", await wallBtn.isVisible());

  // 1a) v4.2.0 — ziyaretçi (giriş yokken) durumu
  const joinBtn = page.locator("#joinBtn");
  const loginBtn = page.locator("#loginBtn");
  check("Ziyaretçiye 💎 Üye Ol düğmesi görünür", await joinBtn.isVisible());
  check("Ziyaretçiye 👤 Giriş Yap düğmesi görünür", await loginBtn.isVisible());
  check("Üye Ol düğmesinde $1 yazıyor",
    ((await joinBtn.textContent()) || "").includes("$1"),
    (await joinBtn.textContent() || "").trim());
  check("Lansman fiyatı $1 gösteriliyor",
    ((await page.locator("#launchAmount").textContent()) || "").trim() === "$1",
    (await page.locator("#launchAmount").textContent() || "").trim());
  check("Lansman CTA bölümü görünür", await page.locator("#landingCta").isVisible());
  check("Özellik anlatımı görünür", await page.locator("#landingFeatures").isVisible());
  const ozellikSayisi = await page.locator(".feat-card").count();
  check("Özellik kartları basılı (8)", ozellikSayisi === 8, `${ozellikSayisi} kart`);

  // 1b) Demo Modu rozeti: tıklanamaz, yalnız bilgi
  const aiStatus = page.locator("#aiStatus");
  check("Demo Modu rozeti görünür", await aiStatus.isVisible());
  check("Demo Modu rozeti tıklanamaz (aria-disabled)",
    (await aiStatus.getAttribute("aria-disabled")) === "true");
  const rozetTikanabilir = await page.evaluate(() => {
    const el = document.getElementById("aiStatus");
    return getComputedStyle(el).pointerEvents;
  });
  check("Demo Modu rozeti pointer-events: none", rozetTikanabilir === "none", rozetTikanabilir);

  // 1c) Kilitli menüler: görünür ama kilitli işaretli.
  // Kilitler `renderMenuLocks` ile çiziliyor, o da API'ye ulaşıldıktan SONRA
  // (bootstrapApi) çalışıyor. Daha önce kontrol sayfa yüklenir yüklenmez
  // soruyordu ve ağ yavaşsa kilitler henüz çizilmemiş olduğu için yanlış
  // alarm veriyordu — aslında bir zamanlama yarışıydı, ürün hatası değil.
  await page.waitForFunction(
    () => ["libraryBtn", "archiveBtn", "badgesBtn", "classBtn"]
      .every((id) => document.getElementById(id)?.classList.contains("is-locked")),
    { timeout: 10000 },
  ).catch(() => {});
  const kilitli = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".header-actions .is-locked")).map((e) => e.id));
  check("Kilitli menüler işaretlendi",
    ["libraryBtn", "archiveBtn", "badgesBtn", "classBtn"].every((id) => kilitli.includes(id)),
    kilitli.join(",") || "yok");

  // 1d) Kilitli menüye tıklayınca içeriye GİRİLMEMELİ.
  // Düğme `disabled` DEĞİL (aksi hâlde giriş penceresi hiç açılamaz), bu
  // yüzden gerçek tıklamayı `force` ile gönderiyoruz — kullanıcının
  // gördüğü davranışın ta kendisi bu.
  await page.locator("#archiveBtn").click({ force: true });
  await page.locator("#authModal:not([hidden])").waitFor({ timeout: 10000 }).catch(() => {});
  check("Kilitli menü giriş penceresini açtı",
    await page.locator("#authModal:not([hidden])").isVisible());
  check("Kilitli menü içeriği AÇILMADI",
    await page.locator("#archiveModal").isHidden());
  const adresKaymadi = await page.evaluate(() =>
    !location.hash.includes("kutuphane") && !location.hash.includes("arsiv"));
  check("Kilitli menü sayfayı kaydırmadı", adresKaymadi, await page.evaluate(() => location.hash));
  await page.locator("#closeAuth").click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);

  // API'ye ulaşıldı mı? (health yoklaması)
  await page.waitForFunction(() => {
    const b = document.getElementById("authBtn");
    return b && b.dataset.state && b.dataset.state !== "offline";
  }, { timeout: 8000 }).catch(() => {});
  const state = await authBtn.getAttribute("data-state");
  check("API'ye ulaşıldı (health)", state !== "offline", `data-state=${state}`);

  // 2) Kayıt — ziyaretçi CTA'sından değil, giriş düğmesinden
  await loginBtn.click();
  await page.locator("#authModal:not([hidden])").waitFor({ timeout: 5000 });
  check("Giriş penceresi açıldı", true);
  await page.locator('[data-auth-tab="register"]').click();
  await page.locator("#authName").fill("Tarayıcı Denemesi");
  await page.locator("#authEmail").fill(email);
  await page.locator("#authPassword").fill(password);
  await page.locator("#authForm button[type=submit]").click();
  await page.waitForFunction(() => document.getElementById("authModal").hidden === true, { timeout: 10000 });
  check("Ücretsiz kayıt tamamlandı", true);

  // 3) Düğme durumu + kalan hak
  const label = (await authBtn.textContent()) || "";
  check("Düğme kullanıcı adını gösteriyor", label.includes("Tarayıcı Denemesi"), label);
  const title = await authBtn.getAttribute("title");
  check("Kalan ücretsiz hak gösteriliyor", /1/.test(title || ""), title);

  // 3b) Giriş sonrası: landing gizlenmeli, menü kilitleri açılmalı
  const landingGizli = await page.locator("#landingCta").isHidden();
  check("Giriş sonrası lansman CTA gizlendi", landingGizli);
  const uzereKalan = await page.evaluate(() =>
    document.querySelectorAll(".header-actions .is-locked").length);
  check("Giriş sonrası menü kilitleri açıldı", uzereKalan === 0, `${uzereKalan} kilitli`);
  check("Giriş sonrası Üye Ol düğmesi gizlendi", await page.locator("#joinBtn").isHidden());

  // 4) Duvar — üye DEĞİL, prompt'lar kilitli olmalı
  await wallBtn.click();
  await page.locator("#wallModal:not([hidden])").waitFor({ timeout: 5000 });
  await page.waitForTimeout(1200);
  const locked = await page.locator(".wall-locked").count();
  const shown = await page.locator(".wall-prompt").count();
  check("Duvar açıldı ve kartlar yüklendi", (await page.locator(".wall-card").count()) > 0,
    `${await page.locator(".wall-card").count()} kart`);
  check("Üye olmayan için prompt'lar kilitli", locked > 0 && shown === 0, `kilitli=${locked} açık=${shown}`);

  await page.locator("#closeWall").click();

  // 4b) Duvar kartındaki yazara tıkla → profil açılmalı, takip düğmesi görünmeli
  await wallBtn.click();
  await page.waitForTimeout(1000);
  await page.locator(".wall-author").first().click();
  await page.locator("#profileModal:not([hidden])").waitFor({ timeout: 6000 });
  await page.locator(".profile-head").waitFor({ timeout: 8000 });
  check("Yazar adına tıklayınca profil açıldı", true);
  const handle = await page.locator(".profile-handle").textContent();
  check("Profil kullanıcı adını gösteriyor", /@/.test(handle || ""), (handle || "").trim());
  await page.locator("#closeProfile").click();
  await page.locator("#closeWall").click();   // profil duvarın üstünde açılır; duvarı kapat

  // 4c) Kendi profilim → takip düğmesi olmamalı, "Bu senin profilin" olmalı
  await authBtn.click();
  await page.locator("#authProfile").click();
  await page.locator("#profileModal:not([hidden])").waitFor({ timeout: 6000 });
  await page.locator(".profile-head").waitFor({ timeout: 8000 });   // profil yüklensin
  const selfNote = (await page.locator("#profileBody").textContent()) || "";
  check("Kendi profilde takip düğmesi yok", (await page.locator("#followToggle").count()) === 0);
  check("Kendi profil etiketi görünüyor", selfNote.includes("Bu senin profilin"));
  await page.locator("#closeProfile").click();

  // 5) Hak bitti → gerçek AI çağrısı paywall'a düşmeli
  // (Anahtar olmadan kapı devreye girmez; bu yüzden ayarı zorla yazıyoruz.)
  await page.evaluate(() => {
    localStorage.setItem("arduinoDreamLab.settings.v1", JSON.stringify({
      provider: "gemini", apiKey: "test-anahtari-1234567890"
    }));
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.locator("#ideaInput").fill("Test için basit bir LED yanıp söner projesi");
  await page.locator("#generateBtn").click();
  // 1. hak: AI'ya gider (anahtar sahte olduğu için hata → demo şablona düşer)
  await page.waitForTimeout(2500);
  await page.locator("#ideaInput").fill("Test için basit bir LED yanıp söner projesi");
  await page.locator("#generateBtn").click();
  await page.locator("#paywallModal:not([hidden])").waitFor({ timeout: 10000 });
  check("Ücretsiz hak bitince paywall açıldı", true);
  const priceText = (await page.locator(".paywall-price").textContent()) || "";
  check("Paywall fiyatı sunucudan geldi", /\$1/.test(priceText), priceText.trim());
  await page.locator("#payClose2").click();

  // 6) Çıkış
  await authBtn.click();
  await page.locator("#authLogout").click();
  await page.waitForTimeout(800);
  // Çıkışla ziyaretçi durumuna dönüldü: authBtn gizlenir, yerine
  // Üye Ol / Giriş Yap düğmeleri görünür olur (v4.2.0).
  check("Çıkışta profil düğmesi gizlendi", await authBtn.isHidden());
  check("Çıkışta 👤 Giriş Yap düğmesi göründü", await loginBtn.isVisible());
  check("Çıkışta 💎 Üye Ol düğmesi göründü", await joinBtn.isVisible());
  check("Çıkışta lansman CTA geri geldi", await page.locator("#landingCta").isVisible());
  const cikanKilit = await page.evaluate(() =>
    document.querySelectorAll(".header-actions .is-locked").length);
  check("Çıkışta menü kilitleri geri geldi", cikanKilit > 0, `${cikanKilit} kilitli`);

  // 7) Üye olmayan başka bir profili aç ve takip et/bırak
  await loginBtn.click();
  await page.locator('[data-auth-tab="register"]').click();
  await page.locator("#authName").fill("Takipçi Deneme");
  await page.locator("#authEmail").fill(email.replace("@", "+t@"));
  await page.locator("#authPassword").fill(password);
  await page.locator("#authForm button[type=submit]").click();
  await page.waitForFunction(() => document.getElementById("authModal").hidden === true, { timeout: 10000 });
  await wallBtn.click();
  await page.waitForTimeout(1000);
  await page.locator(".wall-author").first().click();
  await page.locator("#followToggle").waitFor({ state: "visible", timeout: 6000 });
  await page.locator("#followToggle").click();
  await page.waitForTimeout(900);
  check("Takip et butonu durum değiştirdi",
    ((await page.locator("#followToggle").textContent()) || "").includes("Takip Ediliyor"),
    (await page.locator("#followToggle").textContent() || "").trim());
  await page.locator("#followToggle").click();
  await page.waitForTimeout(900);
  check("Takipten çıkma çalıştı",
    ((await page.locator("#followToggle").textContent()) || "").includes("Takip Et"),
    (await page.locator("#followToggle").textContent() || "").trim());
  await page.locator("#closeProfile").click();

  // 8) Üye olmayan kullanıcı "Takip Ettiklerim" sekmesine tıklayınca paywall açılır
  const takipSekmesi = page.locator('[data-wall-tab="following"]');
  check("Duvar sekmeleri görünür", await takipSekmesi.isVisible());
  await takipSekmesi.click();
  await page.waitForTimeout(700);
  check("Üye olmayan için takip sekmesi paywall açtı",
    await page.locator("#paywallModal:not([hidden])").isVisible());
  await page.locator("#payClose2").click();
  await page.waitForTimeout(400);
  const aktifSekme = await page.locator(".wall-tab.is-active").getAttribute("data-wall-tab");
  check("Paywall'dan sonra 'Tümü' sekmesinde kalındı", aktifSekme === "all", `aktif=${aktifSekme}`);

  // 9) Yorum yazmak üyeye açık olmalı (bu kullanıcı üye değil)
  await page.locator('[data-act="comments"]').first().click();
  await page.waitForTimeout(900);
  check("Yorum paneli açıldı", await page.locator(".wall-comments:not([hidden])").first().isVisible());
  check("Üye olmayan için yorum kutusu yok", (await page.locator(".cmt-form").count()) === 0);
  check("Üye olmayan için 'üye ol' ipucu var",
    ((await page.locator(".wall-comments").first().textContent()) || "").includes("üye ol"));
  await page.locator('[data-act="comments"]').first().click();
  await page.waitForTimeout(400);

  // 10) Beğeni düğmesi üye olmayan için paywall açmalı
  await page.locator('[data-act="like"]').first().click();
  await page.waitForTimeout(700);
  check("Üye olmayan için beğeni paywall açtı",
    await page.locator("#paywallModal:not([hidden])").isVisible());
  await page.locator("#payClose2").click();
  await page.waitForTimeout(400);

  // 10b) Üye olan biriyle aynı beğeni düğmesi çalışmalı (duvar zaten açık)
  const duvarAcik = await page.locator("#wallModal:not([hidden])").isVisible();
  check("Paywall kapanınca duvar açık kaldı", duvarAcik);

  // 11) Beğeni ve yorum akışı ÜYE ile: seed üyesi girilir
  // (Paywall arkasında duvar kalmıştı; modal yığını düzelttikten sonra
  //  üstteki duvarı kapatıp yeniden açıyoruz ki kontroller net olsun.)
  await page.locator("#closeWall").click();
  await page.waitForTimeout(400);
  await authBtn.click();
  await page.locator("#authLogout").click();
  await page.waitForTimeout(700);
  await loginBtn.click();
  await page.locator('[data-auth-tab="login"]').click();
  await page.locator("#authEmail").fill(uye.email);
  await page.locator("#authPassword").fill(uye.password);
  await page.locator("#authForm button[type=submit]").click();
  await page.waitForFunction(() => document.getElementById("authModal").hidden === true, { timeout: 10000 });
  await page.waitForTimeout(600);
  check("Seed üyesi giriş yaptı", ((await authBtn.textContent()) || "").includes("Deniz"));

  await wallBtn.click();
  await page.waitForTimeout(1200);
  check("Üye olarak duvar yeniden açıldı", (await page.locator(".wall-card").count()) > 0,
    `${await page.locator(".wall-card").count()} kart`);

  const begeniBtn = page.locator('[data-act="like"]').first();
  const sayiOku = async () => Number(((await begeniBtn.textContent()) || "0").replace(/\D/g, "")) || 0;
  const begeniliMi = async () => (await begeniBtn.getAttribute("class") || "").includes("is-on");
  // Seed üyesi önceki koşularda beğenmiş olabilir; test mutlak sayıya değil
  // TIKLAMANIN YÖNÜNE bakar: beğenmemişse +1, beğenmişse -1 beklenir.
  const oncedenBegenmis = await begeniliMi();
  const oncekiSayi = await sayiOku();
  await begeniBtn.click();
  await page.waitForTimeout(900);
  const sonrakiSayi = await sayiOku();
  check("Beğeni tıklaması sayacı doğru yönde değişti",
    oncedenBegenmis ? sonrakiSayi === oncekiSayi - 1 : sonrakiSayi === oncekiSayi + 1,
    `${oncedenBegenmis ? "beğenmiş" : "beğenmemiş"} · ${oncekiSayi} → ${sonrakiSayi}`);
  check("Beğeni düğmesi durum değiştirdi", (await begeniliMi()) === !oncedenBegenmis);
  // Testi geri al: veritabanı birikmesin, sonraki koşullar aynı durumdan başlasın.
  await begeniBtn.click();
  await page.waitForTimeout(700);
  check("Beğeni geri alındı", (await begeniliMi()) === oncedenBegenmis);

  await page.locator('[data-act="comments"]').first().click();
  await page.waitForTimeout(900);
  const yorumVar = (await page.locator(".cmt-form").count()) > 0;
  check("Yorum yazma kutusu basıldı (üye)", yorumVar);
  if (yorumVar) {
    const yorumMetni = "Otomatik deneme yorumu " + Date.now().toString(36);
    await page.locator(".cmt-input").first().fill(yorumMetni);
    await page.locator(".cmt-send").first().click();
    await page.waitForTimeout(1500);
    const panelMetni = (await page.locator(".wall-comments:not([hidden])").first().textContent()) || "";
    check("Yorum gönderildi ve listede göründü", panelMetni.includes(yorumMetni));
    check("Kendı yorumunda sil düğmesi var", (await page.locator(".cmt-del").count()) > 0);
  }

  /* ── v4.3.0: duvar arama, sıralama, raporlama, avatar ─────── */

  // Arama kutusu yalnız "Tümü" sekmesinde görünür olmalı.
  check("Duvar arama kutusu görünür", await page.locator("#wallSearch").isVisible());
  check("Sıralama açılır listesi görünür", await page.locator("#wallSort").isVisible());

  // Arama: gerçek bir kelime yaz, kart sayısı değişmeli.
  // ÖNEMLİ: Sayaç DUVAR KABINA sınırlı. `.wall-card` sınıfını profil
  // penceresi de kullanıyor; genel sayım profil kartlarını da katıyor ve
  // "arama boş döndü" kontrolü yanlışlıkla başarısız oluyor.
  const kartSayisi = async () => page.locator("#wallContent .wall-card").count();
  const aramaOnce = await kartSayisi();
  // Arama kelimesini DUVARDAKİ GERÇEK BİR BAŞLIĞIN parçasından seçiyoruz.
  // Düz "irmak" yazmak yanıltıcıydı: sorgu metni kendisi sonuç metninde
  // geçtiği için kontrol, hiç eşleşme olmasa da yeşil kalıyordu.
  const ilkBaslik = ((await page.locator("#wallContent .wall-title").first().textContent()) || "").trim();
  const kelime = (ilkBaslik.split(/\s+/).find((w) => w.length >= 4) || ilkBaslik).slice(0, 8);
  check("Arama için gerçek bir kelime seçildi", kelime.length >= 3, `"${kelime}" (başlık: ${ilkBaslik})`);
  await page.locator("#wallSearch").fill(kelime);
  await page.waitForTimeout(1300);
  const aramaSonra = await kartSayisi();
  check("Arama sonuçları daralttı", aramaSonra < aramaOnce, `${aramaOnce} → ${aramaSonra} kart`);
  check("Arama eşleşen kartı getirdi", aramaSonra > 0, `${aramaSonra} kart, sorgu "${kelime}"`);
  // Karşılaştırmayı sunucunun katlama mantığıyla yap. Türkçe harfleri
  // SİLMEK yanlıştı: "kişilik" -> "kilik" oluyor ve bu, "kişilik" içinde
  // literal geçmiyor; eşleşme varken kontrol düşüyordu. foldTR ile ikisi de
  // ASCII'ye katlanır, sonra alt dize karşılaştırılır.
  const ilkSonucBasligi = ((await page.locator("#wallContent .wall-title").first().textContent()) || "");
  check("Dönen kart gerçekten eşleşti",
    foldTR(ilkSonucBasligi).includes(foldTR(kelime)),
    `sorgu "${kelime}" (katlanmış "${foldTR(kelime)}") / sonuç: "${ilkSonucBasligi}"`);

  // Sonuç yoksa anlaşılır bir metin, hata değil.
  await page.locator("#wallSearch").fill("bulunamayacak-bir-konu-zzz");
  await page.waitForTimeout(1200);
  const bosMetin = (await page.locator("#wallContent").textContent()) || "";
  check("Bulunmayan arama 'sonuç yok' der, hata değil", /sonuç yok/.test(bosMetin), bosMetin.trim().slice(0, 60));
  const bosKart = await kartSayisi();
  check("Arama sırasında kart kalmadı", bosKart === 0, `${bosKart} kart kaldı`);

  // Temizle düğmesi arama varken belirir ve listeyi geri getirir.
  check("Temizle düğmesi arama varken var", await page.locator("#wallClear").isVisible());
  await page.locator("#wallClear").click();
  await page.waitForTimeout(1200);
  check("Temizle tıklaması listeyi geri getirdi", (await kartSayisi()) === aramaOnce, `${await kartSayisi()} kart`);
  check("Arama kutusu temizlendi", (await page.locator("#wallSearch").inputValue()) === "");

  // Sıralama: en çok beğenilen seçilince liste yine dolu olmalı (çökme yok).
  await page.locator("#wallSort").selectOption("top");
  await page.waitForTimeout(1200);
  check("'En çok beğenilen' sıralaması çalıştı", (await kartSayisi()) > 0, `${await kartSayisi()} kart`);
  await page.locator("#wallSort").selectOption("new");
  await page.waitForTimeout(900);

  // Şikâyet: yabancı bir kartın düğmesi açılır, gönderilir.
  const reportBtn = page.locator('[data-act="report"]').first();
  check("Yabancı projede şikâyet düğmesi var", (await reportBtn.count()) > 0);
  if (await reportBtn.count()) {
    await reportBtn.click();
    await page.waitForTimeout(600);
    check("Şikâyet penceresi açıldı", await page.locator("#reportModal").isVisible());
    check("Gerekçe listesi dolu", (await page.locator("#reportReason option").count()) === 5);
    await page.locator("#reportSubmit").click();
    await page.waitForTimeout(1200);
    const ipucu = (await page.locator("#reportHint").textContent()) || "";
    check("Şikâyet gönderildi (ya da daha önce bildirilmişti)",
      (await page.locator("#reportModal").isHidden()) || /zaten bildirmişsin/.test(ipucu),
      ipucu.trim().slice(0, 60));
    if (!(await page.locator("#reportModal").isHidden())) {
      await page.locator("#reportCancel").click();
      await page.waitForTimeout(400);
    }
  }

  // Kendi profilinde avatar yükleyici var; başkasınıninkinde yok.
  // ÖNEMLİ: Duvar penceresi açıkken başlıktaki düğmelere tıklanamaz (overlay);
  // önce onu kapatıyoruz.
  await page.locator('[data-profile-handle]').first().click();
  await page.waitForTimeout(1200);
  check("Profil penceresi açıldı", await page.locator("#profileModal").isVisible());
  check("Başkasının profilinde avatar yükleyici yok", (await page.locator("#avatarFile").count()) === 0);
  await page.locator("#closeProfile").click();
  await page.waitForTimeout(400);
  await page.locator("#closeWall").click();
  await page.waitForTimeout(400);

  // Kendi profilimiz: avatar alanı görünür. Handle'ı sunucudan alıyoruz
  // (header metni güncellenmemişse yanıltırdı).
  const kendi = await page.evaluate(async (api) => {
    const token = localStorage.getItem("arduinoDreamLab.authToken.v1") || "";
    const r = await fetch(api + "/api/auth/me", { headers: { Authorization: "Bearer " + token } });
    return r.ok ? (await r.json()).user.handle : "";
  }, API_BASE);
  check("Oturum jetonu geçerli, handle alındı", Boolean(kendi), kendi || "handle alınamadı");
  if (kendi) {
    // Yazar düğmesi duvarın İÇİNDE; duvar kapalıyken tıklanamaz.
    await wallBtn.click();
    await page.waitForTimeout(1500);
    await page.locator(`#wallContent [data-profile-handle="${kendi}"]`).first().click();
    await page.waitForTimeout(1400);
    check("Kendi profilinde avatar yükleyici var", (await page.locator("#avatarFile").count()) > 0, "@" + kendi);
    check("Kendini şikâyet düğmesi yok", (await page.locator("#reportUser").count()) === 0);
    await page.locator("#closeProfile").click();
    await page.waitForTimeout(400);
  }

  check("Sayfada JS hatası yok", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (e) {
  check("Beklenmeyen hata", false, e.message);
} finally {
  if (browser) await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
process.exit(failed.length ? 1 : 0);