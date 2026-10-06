/**
 * Kademe testleri için ORTAM AYARI — bu dosya `pricing.test.js` içinde
 * diğer importlardan ÖNCE gelmelidir: ESM, modülleri bildirim sırasına göre
 * değerlendirir, böylece `src/config.js` bu değerleri okur.
 *
 * KÜÇÜK limitler seçilmiştir ki test 2–3 kayıt ile kademe geçişlerini
 * doğrulayabilsin (1000 kayıt üretmek yerine).
 */
process.env.PRICING_FREE_LIMIT = "2";
process.env.PRICING_PAID_LIMIT = "3";
