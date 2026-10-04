import { prisma } from "../src/db.js";
import { hashPassword } from "../src/auth.js";

let counter = 0;

/** Testler arlo_test veritabanını kullanır; sırayla çalışır, tabloları temizler. */
export async function resetDb() {
  await prisma.project.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

export function uniqueEmail(tag = "test") {
  counter += 1;
  return `${tag}-${counter}-${Date.now().toString(36)}@example.com`;
}

export async function makeUser(opts = {}) {
  const {
    email = uniqueEmail(),
    password = "test1234",
    displayName = "Test Kullanıcı",
    member = false,
    plan = "LIFETIME",
    freePasses = 1
  } = opts;
  counter += 1;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      displayName,
      handle: `test-${Date.now().toString(36)}-${counter}`,
      freePasses
    }
  });
  if (member) {
    await prisma.membership.create({
      data: {
        userId: user.id,
        plan,
        status: "ACTIVE",
        priceCents: 100,
        lifetimeAt: plan === "LIFETIME" ? new Date() : null,
        currentPeriodEnd: plan === "MONTHLY" ? new Date(Date.now() + 86400000) : null
      }
    });
  }
  return prisma.user.findUnique({ where: { id: user.id }, include: { membership: true } });
}

export async function makeProject(ownerId, opts = {}) {
  const {
    title = "Test Projesi",
    summary = "Kısa özet.",
    promptBody = "GIZLI_PROMPT_METNI_12345",
    shared = true
  } = opts;
  return prisma.project.create({
    data: {
      ownerId,
      title,
      summary,
      promptBody,
      isShared: shared,
      sharedAt: shared ? new Date() : null
    }
  });
}

/** Üye olmayan yanıtta prompt hiçbir biçimde geçmemeli — ham metin taranır. */
export function assertNoPromptLeak(payload, needle = "GIZLI_PROMPT_METNI") {
  const raw = JSON.stringify(payload);
  if (raw.includes(needle)) {
    throw new Error(`PROMPT SIZINTISI: üye olmayan yanıtta ${needle} bulundu → ${raw.slice(0, 400)}`);
  }
  if (raw.includes("promptBody")) {
    throw new Error(`PROMPT SIZINTISI: yanıtta promptBody alanı var → ${raw.slice(0, 400)}`);
  }
}