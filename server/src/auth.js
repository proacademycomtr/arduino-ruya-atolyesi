import crypto from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { prisma } from "./db.js";
import { config } from "./config.js";

const ARGON = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

export function hashPassword(plain) {
  return hash(plain, ARGON);
}

export async function verifyPassword(passwordHash, plain) {
  if (!passwordHash || typeof plain !== "string") return false;
  try {
    return await verify(passwordHash, plain, ARGON);
  } catch {
    return false;
  }
}

export const newToken = () => crypto.randomBytes(32).toString("base64url");
export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export async function createSession(userId) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + config.sessionDays * 86400000);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function destroySession(token) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function userFromToken(token) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { membership: true } } }
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session.user;
}

/** Üyelik aktif mi? LIFETIME her zaman, MONTHLY için dönem bitmemiş olmalı. */
export function isMember(user) {
  const m = user && user.membership;
  if (!m || m.status !== "ACTIVE") return false;
  if (m.plan === "LIFETIME") return true;
  if (m.plan === "MONTHLY") {
    return !m.currentPeriodEnd || m.currentPeriodEnd.getTime() > Date.now();
  }
  return false;
}

function bearer(req) {
  const header = req.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : "";
}

/** req.user'ı doldurur; yoksa null bırakır (herkese açık rotalar bunu kullanır). */
export async function attachUser(req, _res, next) {
  const token = bearer(req);
  if (token) {
    req.token = token;
    req.user = await userFromToken(token);
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "unauthorized", message: "Giriş yapmalısın." });
  next();
}

export function requireMember(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "unauthorized", message: "Giriş yapmalısın." });
  if (!isMember(req.user)) {
    return res.status(403).json({ error: "member_only", message: "Bu içerik sadece üyelere görünür." });
  }
  next();
}

export function publicUser(user, extra = {}) {
  if (!user) return null;
  return {
    handle: user.handle,
    displayName: user.displayName,
    bio: user.bio || "",
    avatarKey: user.avatarKey || null,
    createdAt: user.createdAt,
    ...extra
  };
}