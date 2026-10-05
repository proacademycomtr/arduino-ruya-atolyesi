import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { searchTextFor } from "../src/str.js";

const prisma = new PrismaClient();

const users = [
  {
    email: "deniz@example.com",
    password: "demo1234",
    handle: "deniz-arduino",
    displayName: "Deniz Arduino",
    bio: "LED şerit projeleri yaparım.",
    freePasses: 0,
    member: true
  },
  {
    email: "ayse@example.com",
    password: "demo1234",
    handle: "ayse-muhendis",
    displayName: "Ayşe Mühendis",
    bio: "Sınıf öğretmeni.",
    freePasses: 0,
    member: true
  },
  {
    email: "merhaba@example.com",
    password: "demo1234",
    handle: "merhaba-konuk",
    displayName: "Misafir Öğrenci",
    bio: "Henüz üye olmadı.",
    freePasses: 1,
    member: false
  }
];

const projects = [
  {
    owner: "deniz-arduino",
    title: "Yağmur sensörüyle otomatik sulama",
    summary: "Toprak nemi düşünce pompayı 3 saniye çalıştıran mini proje.",
    promptBody: "Arduino Uno ile toprağın nemini ölçen bir sulama projesi istiyorum. Pompa 3 saniye çalışıp dursun, seri monitörde nem oranını göstersin.",
    images: []
  },
  {
    owner: "ayse-muhendis",
    title: "24 kişilik sınıf için LED sıra sayacı",
    summary: "Her öğrenci kartına dokununca sıra numarası yükseliyor.",
    promptBody: "Sınıf modunda 24 öğrenci için kart okuyucu ile sıra sayacı yapan bir proje. Devre şeması ve malzeme listesi lazım.",
    images: []
  }
];

const passwordHash = await hash("demo1234", { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });

for (const u of users) {
  const user = await prisma.user.upsert({
    where: { email: u.email },
    update: {},
    create: {
      email: u.email,
      passwordHash,
      handle: u.handle,
      displayName: u.displayName,
      bio: u.bio,
      freePasses: u.freePasses
    }
  });
  if (u.member) {
    await prisma.membership.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        plan: "LIFETIME",
        status: "ACTIVE",
        priceCents: 100,
        currency: "usd",
        lifetimeAt: new Date()
      }
    });
  }
}

for (const p of projects) {
  const owner = await prisma.user.findUnique({ where: { handle: p.owner } });
  const exists = await prisma.project.findFirst({ where: { ownerId: owner.id, title: p.title } });
  if (exists) continue;
  await prisma.project.create({
    data: {
      ownerId: owner.id,
      title: p.title,
      summary: p.summary,
      promptBody: p.promptBody,
      searchText: searchTextFor(p.title, p.summary),
      isShared: true,
      sharedAt: new Date(),
      images: {
        create: p.images.map((k, i) => ({ objectKey: k, sortOrder: i }))
      }
    }
  });
}

const follower = await prisma.user.findUnique({ where: { handle: "merhaba-konuk" } });
const deniz = await prisma.user.findUnique({ where: { handle: "deniz-arduino" } });
await prisma.follow.upsert({
  where: { followerId_followingId: { followerId: follower.id, followingId: deniz.id } },
  update: {},
  create: { followerId: follower.id, followingId: deniz.id }
});

console.log(`Seed tamam: ${users.length} kullanıcı, ${projects.length} proje.`);
console.log("Giriş: deniz@example.com / demo1234 (üye) · merhaba@example.com / demo1234 (üye değil)");
await prisma.$disconnect();