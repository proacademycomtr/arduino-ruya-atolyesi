import express from "express";
import { prisma } from "../db.js";
import { isMember, requireAuth, requireMember } from "../auth.js";
import { projectSelect, shapeProject } from "../projectSelect.js";
import { publicUrlFor } from "../storage.js";
import { config } from "../config.js";
import { likeInfo } from "./social.js";

const router = express.Router();

const parseLimit = (raw) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 30) : 12;
};

/**
 * GET /api/wall — HERKESE AÇIK. Üye olmayan isteye promptBody gönderilmez.
 */
router.get("/wall", async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const rows = await prisma.project.findMany({
      where: { isShared: true },
      orderBy: [{ sharedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: projectSelect(isMember(req.user))
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const items = page.map((p) => shapeProject(p, { publicUrlFor }));
    // Görüntüleyenin kendi beğenileri (herkese açık; üye olmayan hep false).
    const likes = await likeInfo(page.map((p) => p.id), req.user ? req.user.id : null);
    res.json({
      items: items.map((p) => ({ ...p, likedByViewer: isMember(req.user) && likes.liked(p.id) })),
      nextCursor: hasMore ? rows[limit - 1].id : null,
      wallEnabled: config.wallEnabled,
      viewer: { isMember: isMember(req.user), handle: req.user ? req.user.handle : null }
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/feed/timeline — üye olmak zorunda. Yalnız takip edilenlerin
 * paylaştığı projeleri, /api/wall ile aynı sözleşmeyle döner.
 */
router.get("/feed/timeline", requireMember, async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const following = await prisma.follow.findMany({
      where: { followerId: req.user.id },
      select: { followingId: true }
    });
    const ids = following.map((f) => f.followingId);
    const viewer = { isMember: true, handle: req.user.handle, followingCount: ids.length };
    if (ids.length === 0) {
      return res.json({ items: [], nextCursor: null, followingCount: 0, viewer });
    }
    const rows = await prisma.project.findMany({
      where: { isShared: true, ownerId: { in: ids } },
      orderBy: [{ sharedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: projectSelect(true)
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const items = page.map((p) => shapeProject(p, { publicUrlFor }));
    const likes = await likeInfo(page.map((p) => p.id), req.user.id);
    res.json({
      items: items.map((p) => ({ ...p, likedByViewer: likes.liked(p.id) })),
      nextCursor: hasMore ? rows[limit - 1].id : null,
      followingCount: ids.length,
      viewer
    });
  } catch (e) {
    next(e);
  }
});

/** GET /api/projects/:id — herkese açık; prompt yalnız üyeye. */
router.get("/projects/:id", async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: String(req.params.id) },
      select: projectSelect(isMember(req.user))
    });
    if (!project) return res.status(404).json({ error: "not_found" });
    const isOwner = req.user && project.owner.handle === req.user.handle;
    if (!project.isShared && !isOwner) return res.status(404).json({ error: "not_found" });
    if (isOwner && req.user.isAdmin !== true) {
      const full = await prisma.project.findUnique({ where: { id: project.id }, select: { promptBody: true } });
      project.promptBody = full.promptBody;
    }
    const member = isMember(req.user);
    const likes = await likeInfo([project.id], req.user ? req.user.id : null);
    res.json({
      project: { ...shapeProject(project, { publicUrlFor }), likedByViewer: member && likes.liked(project.id) },
      canComment: config.wallEnabled && member,
      isOwner
    });
  } catch (e) {
    next(e);
  }
});

export default router;
export { parseLimit };
export const _requireAuth = requireAuth;