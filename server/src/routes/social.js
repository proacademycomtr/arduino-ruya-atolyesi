import express from "express";
import { prisma } from "../db.js";
import { isMember, publicUser, requireAuth, requireMember } from "../auth.js";
import { publicUrlFor } from "../storage.js";
import { config } from "../config.js";

const router = express.Router();

const str = (v, max) => String(v ?? "").trim().slice(0, max);

/** Projeyi yalnız varlık + paylaşımlık için bulur (içerik döndürmez). */
async function findProject(id) {
  return prisma.project.findUnique({
    where: { id: String(id) },
    select: { id: true, ownerId: true, isShared: true }
  });
}

/** Görüntüleyen kullanıcının beğendiği projelerin kimlikleri. */
async function likedByViewer(projectIds, viewerId) {
  if (!viewerId || projectIds.length === 0) return new Set();
  const rows = await prisma.like.findMany({
    where: { userId: viewerId, projectId: { in: projectIds } },
    select: { projectId: true }
  });
  return new Set(rows.map((r) => r.projectId));
}

/** Beğeni durumu ve sayısı. Sıralama sonrası N+1 önlemek için tek sorguda. */
export async function likeInfo(projectIds, viewerId) {
  const [counts, liked] = await Promise.all([
    projectIds.length
      ? prisma.like.groupBy({
          by: ["projectId"],
          where: { projectId: { in: projectIds } },
          _count: { _all: true }
        })
      : Promise.resolve([]),
    likedByViewer(projectIds, viewerId)
  ]);
  const map = new Map();
  for (const c of counts) map.set(c.projectId, c._count._all);
  return {
    counts: (id) => map.get(id) || 0,
    liked: (id) => liked.has(id)
  };
}

/**
 * GET /api/projects/:id/comments — herkese açık okuma.
 * Yazmak üyelere açıktır; yazarı silmek yalnız yazara.
 */
router.get("/projects/:id/comments", async (req, res, next) => {
  try {
    const project = await findProject(req.params.id);
    if (!project || !project.isShared) return res.status(404).json({ error: "not_found" });
    const rows = await prisma.comment.findMany({
      where: { projectId: project.id, hiddenAt: null },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        body: true,
        createdAt: true,
        authorId: true,
        author: { select: { handle: true, displayName: true, avatarKey: true } }
      }
    });
    const viewerId = req.user ? req.user.id : null;
    const isAdmin = req.user ? req.user.isAdmin === true : false;
    res.json({
      comments: rows.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: publicUser(c.author, { avatarUrl: publicUrlFor(c.author.avatarKey) }),
        // Proje sahibi de kendi yorumlarını silebilir (aşağıdaki DELETE kuralı).
        isOwn: viewerId === c.authorId,
        canDelete: viewerId !== null && (viewerId === c.authorId || viewerId === project.ownerId),
        // Gizleme (moderasyon) düğmesi: yazar, proje sahibi veya yönetici.
        canHide: viewerId !== null && (isAdmin || viewerId === c.authorId || viewerId === project.ownerId)
      })),
      canComment: config.wallEnabled && isMember(req.user)
    });
  } catch (e) {
    next(e);
  }
});

/** POST /api/projects/:id/comments — yalnız üyeler. */
router.post("/projects/:id/comments", requireMember, async (req, res, next) => {
  try {
    const project = await findProject(req.params.id);
    if (!project || !project.isShared) return res.status(404).json({ error: "not_found" });
    const body = str(req.body?.body, 1000);
    if (body.length < 2) {
      return res.status(400).json({ error: "empty_comment", message: "Yorum en az 2 karakter olmalı." });
    }
    const comment = await prisma.comment.create({
      data: { projectId: project.id, authorId: req.user.id, body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { handle: true, displayName: true, avatarKey: true } }
      }
    });
    res.status(201).json({
      comment: {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        author: publicUser(comment.author, { avatarUrl: publicUrlFor(comment.author.avatarKey) }),
        isOwn: true
      },
      commentCount: await prisma.comment.count({ where: { projectId: project.id } })
    });
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/comments/:id — yalnız yazar veya proje sahibi. */
router.delete("/comments/:id", requireAuth, async (req, res, next) => {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, authorId: true, project: { select: { id: true, ownerId: true } } }
    });
    if (!comment) return res.status(404).json({ error: "not_found" });
    const allowed = comment.authorId === req.user.id || comment.project.ownerId === req.user.id;
    if (!allowed) return res.status(403).json({ error: "forbidden" });
    await prisma.comment.delete({ where: { id: comment.id } });
    res.json({
      deleted: true,
      commentCount: await prisma.comment.count({ where: { projectId: comment.project.id } })
    });
  } catch (e) {
    next(e);
  }
});

/** POST /api/projects/:id/like — üye olmak zorunda (herkese açık beğeni spam'e açık olurdu). */
router.post("/projects/:id/like", requireMember, async (req, res, next) => {
  try {
    const project = await findProject(req.params.id);
    if (!project || !project.isShared) return res.status(404).json({ error: "not_found" });
    await prisma.like.upsert({
      where: { userId_projectId: { userId: req.user.id, projectId: project.id } },
      create: { userId: req.user.id, projectId: project.id },
      update: {}
    });
    res.json({ liked: true, likeCount: await prisma.like.count({ where: { projectId: project.id } }) });
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/projects/:id/like */
router.delete("/projects/:id/like", requireMember, async (req, res, next) => {
  try {
    const project = await findProject(req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    await prisma.like.deleteMany({ where: { userId: req.user.id, projectId: project.id } });
    res.json({ liked: false, likeCount: await prisma.like.count({ where: { projectId: project.id } }) });
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /api/comments/:id — yorumu gizle/geri aç. Yalnız yazan, proje sahibi
 * veya yönetici yapabilir. Silmekten ayrıdır: içerik korunur, listelerden düşer.
 * Yönetici olmayanların gizlediği yorum yalnız kendisine gizli görünür
 * (`canHide` false döner), böylece gizleme şikâyet kaydı gibi yorumlanmaz.
 */
router.patch("/comments/:id", requireAuth, async (req, res, next) => {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, authorId: true, projectId: true, project: { select: { id: true, ownerId: true } } }
    });
    if (!comment) return res.status(404).json({ error: "not_found" });
    const isAdmin = req.user.isAdmin === true;
    const isModerator = isAdmin || comment.authorId === req.user.id || comment.project.ownerId === req.user.id;
    if (!isModerator) return res.status(403).json({ error: "forbidden" });
    const hidden = Boolean(req.body?.hidden);
    const updated = await prisma.comment.update({
      where: { id: comment.id },
      data: { hiddenAt: hidden ? new Date() : null, hiddenById: hidden ? req.user.id : null },
      select: { id: true, hiddenAt: true }
    });
    res.json({
      comment: updated,
      canHide: isAdmin || comment.project.ownerId === req.user.id,
      // Gizli yorumlar listeden düştüğü için sayaç da düşer.
      commentCount: await prisma.comment.count({ where: { projectId: comment.projectId, hiddenAt: null } })
    });
  } catch (e) {
    next(e);
  }
});

export default router;