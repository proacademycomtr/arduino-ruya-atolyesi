/**
 * Türkçe harf duyarsız metin işlemleri.
 *
 * Postgres `lower()` yerel bağımsız çalışır: 'I' → 'i' ama 'ı' → 'ı' kalır
 * ve 'İ' → 'i̇' olur. Bu yüzden SQL tarafında "searchText ILIKE '%irmak%'"
 * araması "Irmak" kaydını bulmaz. Çözüm: metni KAYIT ANINDA katlayıp
 * küçültüp `Project.searchText` içine yazmak; sorgu sırasında katlama
 * gerekmez (istemcideki `foldTR` ile aynı sonucu üretir).
 */

const MAP = {
  İ: "i", I: "i", ı: "i", i: "i",
  Ş: "s", ş: "s", s: "s",
  Ğ: "g", ğ: "g", g: "g",
  Ü: "u", ü: "u", u: "u",
  Ö: "o", ö: "o", o: "o",
  Ç: "c", ç: "c", c: "c",
  Â: "a", â: "a", a: "a",
  Î: "i", î: "i", û: "u", Û: "u"
};

// Karakter sınıfı MAP'in anahtarlarından TÜRETİLİR. Elle yazılmış ikinci bir
// liste bir zaman kayacaktır: büyük harfler (Ş Ğ Ü Ö Ç) sınıfa girmeyi
// unutmuş, "İŞİK" → "isik" yerine "işik" olmuştu.
const FOLD_RE = new RegExp("[" + Object.keys(MAP).join("") + "]", "g");

/** 'Irmak Sensor' → 'irmak sensor'. */
export function foldTR(input) {
  return String(input == null ? "" : input)
    .replace(FOLD_RE, (ch) => MAP[ch])
    .toLowerCase();
}

/** Başlık + özet → aranabilir tek metin. */
export function searchTextFor(title, summary) {
  return foldTR(`${title || ""} ${summary || ""}`).trim();
}

/** Boş string'e indirger, uzunluğu kısaltır. */
export const str = (v, max) => String(v ?? "").trim().slice(0, max);
