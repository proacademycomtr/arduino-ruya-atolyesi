import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireMember } from "../auth.js";
import { str } from "../str.js";

const router = express.Router();

/** Bildirilebilir hedefler ve gerekçeler — istemciden gelen değerler doğrulanır. */
const TARGETS = { COMMENT: "COMMENT", PROJECT: "PROJECT", USER: "USER" };
const REASONS = { SPAM: 1, HARASSMENT: 1, OFF_TOPIC: 1, UNSAFE: 1, OTHER: 1 };

/** Hedef gerçekten var mı? Şikâyet var olmayan bir şeye açılamaz. */
async function targetExists(type, id) {
  if (type === "COMMENT") return Boolean(await prisma.comment.findUnique({ where: { id }, select: { id: true } }));
  if (type === "PROJECT") return Boolean(await prisma.project.findUnique({ where: { id }, select: { id: true } }));
  if (type === "USER") return Boolean(await prisma.user.findUnique({ where: { handle: id.toLowerCase() }, select: { id: true } }));
  return false;
}

/**
 * POST /api/reports — şikâyet bildir. Üyelere açıktır: misafirin
 * gürültü üretmesi spam'e yol açardı. Aynı hedef iki kez bildirilemez.
 */
router.post("/reports", requireMember, async (req, res, next) => {
  try {
    const targetType = str(req.body?.targetType, 20).toUpperCase();
    const targetId = str(req.body?.targetId, 64);
    const reason = str(req.body?.reason, 20).toUpperCase();
    const details = str(req.body?.details, 500);
    if (!Object.prototype.hasOwnProperty.call(TARGETS, targetType)) {
      return res.status(400).json({ error: "invalid_target" });
    }
    if (!Object.prototype.hasOwnProperty.call(REASONS, reason)) {
      return res.status(400).json({ error: "invalid_reason" });
    }
    if (!targetId) return res.status(400).json({ error: "invalid_target" });
    // Kullanıcı hedefleri handle ile bildirilir; büyük/küçük harf farkını
    // kapatıp aynı kişi için iki kayıt oluşmasını engelliyoruz.
    const hedefId = targetType === "USER" ? targetId.toLowerCase() : targetId;
    if (!(await targetExists(targetType, hedefId))) return res.status(404).json({ error: "not_found" });
    // Kendi içeriğini şikâyet edemezsin.
    if (targetType === "USER" && hedefId === req.user.handle) {
      return res.status(400).json({ error: "cannot_report_self" });
    }

    const mevcut = await prisma.report.findUnique({
      where: { reporterId_targetType_targetId: { reporterId: req.user.id, targetType, targetId: hedefId } },
      select: { id: true, status: true }
    });
    if (mevcut) return res.status(409).json({ error: "already_reported", reportId: mevcut.id });

    const report = await prisma.report.create({
      data: { reporterId: req.user.id, targetType, targetId: hedefId, reason, details },
      select: { id: true, status: true, createdAt: true }
    });
    res.status(201).json({ report });
  } catch (e) {
    next(e);
  }
});

/** GET /api/reports — yalnız yönetici. Açık şikâyetler en yeni başta. */
router.get("/reports", requireAuth, async (req, res, next) => {
  try {
    if (req.user.isAdmin !== true) return res.status(403).json({ error: "forbidden" });
    const status = str(req.query.status, 20).toUpperCase();
    const where = ["OPEN", "RESOLVED", "DISMISSED"].includes(status) ? { status } : {};
    const rows = await prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        details: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        reporter: { select: { handle: true, displayName: true } },
        resolvedBy: { select: { handle: true, displayName: true } }
      }
    });
    res.json({
      reports: rows,
      counts: {
        open: await prisma.report.count({ where: { status: "OPEN" } })
      }
    });
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/reports/:id — yalnız yönetici: çözüldü / reddedildi. */
router.patch("/reports/:id", requireAuth, async (req, res, next) => {
  try {
    if (req.user.isAdmin !== true) return res.status(403).json({ error: "forbidden" });
    const status = str(req.body?.status, 20).toUpperCase();
    if (status !== "RESOLVED" && status !== "DISMISSED") {
      return res.status(400).json({ error: "invalid_status" });
    }
    const report = await prisma.report.findUnique({ where: { id: String(req.params.id) }, select: { id: true } });
    if (!report) return res.status(404).json({ error: "not_found" });
    const updated = await prisma.report.update({
      where: { id: report.id },
      data: { status, resolvedById: req.user.id, resolvedAt: new Date() },
      select: { id: true, status: true, resolvedAt: true, resolvedBy: { select: { handle: true } } }
    });
    res.json({ report: updated });
  } catch (e) {
    next(e);
  }
});

export { REASONS, TARGETS };
export default router;
