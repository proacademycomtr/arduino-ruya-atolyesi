import { prisma } from "./db.js";
import { pricing } from "./config.js";

/**
 * Lansman kontenjanında DOLU koltuk: ömür boyu (ücretsiz ya da $1) aktif üyelik.
 * Aylık abonelikler kontenjanı doldurmaz — onlar 2000 sonrası açık kalan yol.
 */
export async function countLifetimeSeats() {
  return prisma.membership.count({ where: { plan: "LIFETIME", status: "ACTIVE" } });
}

/**
 * ÜCRETSİZ kontenjan (ilk `freeLimit` kişi): ödeme adımı yok, üyelik anında verilir.
 *
 * Döner: `{ granted, tier, remaining, used }`.
 * Koltuk kalmamışsa `granted: false` — çağıran ücretli kademeye geçmelidir.
 *
 * NOT: sayaç + ekleme iki ayrı adım; tam 1000. sınırdaki eşzamanlı kayıtlarda
 * kontenjan 1 kişi aşabilir (üyelik `userId` tekildir, aynı kişi iki kez alamaz).
 * Sınır kritikleşirse koltuk için ayrı bir tablo + `SELECT ... FOR UPDATE` gerekir.
 */
export async function grantFreeSeat(userId) {
  const used = await countLifetimeSeats();
  if (used >= pricing.freeLimit) {
    return { granted: false, tier: used < pricing.paidLimit ? "LIFETIME" : "MONTHLY", used, remaining: 0 };
  }
  await prisma.membership.upsert({
    where: { userId },
    create: { userId, plan: "LIFETIME", status: "ACTIVE", priceCents: 0, currency: pricing.currency, lifetimeAt: new Date() },
    update: { plan: "LIFETIME", status: "ACTIVE", priceCents: 0, currency: pricing.currency, lifetimeAt: new Date() }
  });
  return { granted: true, tier: "FREE", used: used + 1, remaining: pricing.freeLimit - (used + 1) };
}
