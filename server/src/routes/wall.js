import express from "express";
import { prisma } from "../db.js";
import { isMember, requireAuth, requireMember } from "../auth.js";
import { projectSelect, shapeProject } from "../projectSelect.js";
import { publicUrlFor } from "../storage.js";
import { config } from "../config.js";
import { likeInfo } from "./social.js";
import { foldTR } from "../str.js";

const router = express.Router();

const parseLimit = (raw) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 30) : 12;
};

/**
 * Sıralama seçenekleri. `new` tarihe göre (paylaşılan andaki id ile imleçlenir,
 * geriye dönük uyum için değişmedi); sayısal sıralamalar geri çağırma
 * (relation count) kullanamayacağı için ofset imleciyle ilerler.
 */
const SORTS = {
  new: [{ sharedAt: "desc" }, { id: "desc" }],
  top: [{ likes: { _count: "desc" } }, { id: "desc" }],
  discussed: [{ comments: { _count: "desc" } }, { id: "desc" }]
};

/** Geçersiz sort değeri varsayılana düşer — istemci güvenilmezdir. */
export const parseSort = (raw) => {
  const s = String(raw || "new");
  return Object.prototype.hasOwnProperty.call(SORTS, s) ? s : "new";
};

/** Arama sorgusu: Türkçe harf duyarsız, `searchText` üzerinde `contains`. */
export const searchWhere = (q) => {
  const needle = foldTR(q).trim().slice(0, 80);
  return needle ? { searchText: { contains: needle, mode: "insensitive" } } : {};
};

/**
 * Paylaşılmış projeleri sayfalı getirir. /api/wall ve /api/feed/timeline
 * aynı sözleşmeyi döndürdüğü için tek yerde yazılmıştır.
 *
 * Gizlenen (moderasyon) projeler hiçbir zaman dönmez.
 */
async function fetchShared({ where, limit, cursor, sort, q, member }) {
  const page = { take: limit + 1, select: projectSelect(member) };
  const shared = { isShared: true, hiddenAt: null, ...where, ...searchWhere(q) };
  const byId = sort === "new";
  const rows = await prisma.project.findMany({
    where: shared,
    orderBy: SORTS[sort],
    ...(byId
      ? (cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      : { skip: Math.max(0, Number.parseInt(String(cursor || "0"), 10) || 0) }),
    ...page
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  return {
    items,
    hasMore,
    // `new` → son satırın kimliği; sayısal sıralama → sonraki ofset.
    nextCursor: hasMore ? (byId ? rows[limit - 1].id : String(limit + (Number.parseInt(String(cursor || "0"), 10) || 0))) : null
  };
}

/**
 * GET /api/wall — HERKESE AÇIK. Üye olmayan isteye promptBody gönderilmez.
 * Sorgu: ?q=aramak&sort=new|top|discussed&limit=&cursor=
 */
router.get("/wall", async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit);
    const sort = parseSort(req.query.sort);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const { items: rows, hasMore, nextCursor } = await fetchShared({
      where: {}, limit, cursor, sort, q: req.query.q, member: isMember(req.user)
    });
    const items = rows.map((p) => shapeProject(p, { publicUrlFor }));
    // Görüntüleyenin kendi beğenileri (herkese açık; üye olmayan hep false).
    const likes = await likeInfo(rows.map((p) => p.id), req.user ? req.user.id : null);
    res.json({
      items: items.map((p) => ({ ...p, likedByViewer: isMember(req.user) && likes.liked(p.id) })),
      nextCursor,
      sort,
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
    const sort = parseSort(req.query.sort);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const following = await prisma.follow.findMany({
      where: { followerId: req.user.id },
      select: { followingId: true }
    });
    const ids = following.map((f) => f.followingId);
    const viewer = { isMember: true, handle: req.user.handle, followingCount: ids.length };
    if (ids.length === 0) {
      return res.json({ items: [], nextCursor: null, followingCount: 0, sort, viewer });
    }
    const { items: rows, hasMore, nextCursor } = await fetchShared({
      where: { ownerId: { in: ids } }, limit, cursor, sort, q: req.query.q, member: true
    });
    const items = rows.map((p) => shapeProject(p, { publicUrlFor }));
    const likes = await likeInfo(rows.map((p) => p.id), req.user.id);
    res.json({
      items: items.map((p) => ({ ...p, likedByViewer: likes.liked(p.id) })),
      nextCursor,
      followingCount: ids.length,
      sort,
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
    // Gizlenen proje yalnız sahibine ve yöneticiye görünür.
    const admin = Boolean(req.user && req.user.isAdmin);
    if (project.hiddenAt && !isOwner && !admin) return res.status(404).json({ error: "not_found" });
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
