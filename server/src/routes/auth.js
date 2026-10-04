import express from "express";
import { prisma } from "../db.js";
import {
  createSession,
  destroySession,
  hashPassword,
  isMember,
  publicUser,
  requireAuth,
  verifyPassword
} from "../auth.js";

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "Ayşe Mühendis" → "ayse-muhendis" */
export function slugify(input) {
  const trMap = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", İ: "i", Ş: "s", Ü: "u", Ö: "o", Ğ: "g", Ç: "c" };
  return String(input || "")
    .toLowerCase()
    .replace(/[çğıöşüİŞÜÖĞÇ]/g, (c) => trMap[c] || c)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
}

async function uniqueHandle(displayName) {
  const base = slugify(displayName) || "kullanici";
  for (let i = 0; i < 40; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const exists = await prisma.user.findUnique({ where: { handle: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function mePayload(user) {
  return {
    user: publicUser(user, {
      id: user.id,
      email: user.email,
      freePasses: user.freePasses,
      isMember: isMember(user)
    }),
    membership: user.membership
      ? {
          plan: user.membership.plan,
          status: user.membership.status,
          currentPeriodEnd: user.membership.currentPeriodEnd,
          lifetimeAt: user.membership.lifetimeAt,
          priceCents: user.membership.priceCents
        }
      : null,
    freePasses: user.freePasses
  };
}

router.post("/register", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const displayName = String(req.body?.displayName || "").trim();

    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "invalid_email" });
    if (password.length < 8) {
      return res.status(400).json({ error: "weak_password", message: "Parola en az 8 karakter olmalı." });
    }
    if (!displayName || displayName.length > 40) {
      return res.status(400).json({ error: "invalid_display_name" });
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return res.status(409).json({ error: "email_taken" });

    const handle = await uniqueHandle(displayName);
    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password), displayName, handle, freePasses: 1 },
      include: { membership: true }
    });
    const { token, expiresAt } = await createSession(user.id);
    res.status(201).json({ token, expiresAt, ...mePayload(user), handle });
  } catch (e) {
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = await prisma.user.findUnique({ where: { email }, include: { membership: true } });
    const ok = user ? await verifyPassword(user.passwordHash, password) : false;
    if (!ok) return res.status(401).json({ error: "invalid_credentials", message: "E-posta veya parola hatalı." });
    const { token, expiresAt } = await createSession(user.id);
    res.json({ token, expiresAt, ...mePayload(user) });
  } catch (e) {
    next(e);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await destroySession(req.token);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get("/me", async (req, res) => {
  if (!req.user) return res.json({ user: null, membership: null, freePasses: 0 });
  res.json(mePayload(req.user));
});

export default router;