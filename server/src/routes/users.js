import express from "express";
import { prisma } from "../db.js";
import { isMember, publicUser, requireAuth } from "../auth.js";
import { projectSelect, shapeProject } from "../projectSelect.js";
import { publicUrlFor } from "../storage.js";
import {
  imageContentTypeOk,
  isOwnAvatarKey,
  newAvatarKey,
  presignUpload,
  storageConfigured
} from "../storage.js";
import { str } from "../str.js";

const router = express.Router();

/**
 * POST /api/users/me/avatar/presign — avatarı doğrudan depoya yükler.
 * Sıralama projects.js ile aynı: içerik tipi ÖNCE denetlenir, depo
 * yapılandırılmamışsa 503 en sonda gelir (aksi hâlde gerçek hata gizlenir).
 */
router.post("/me/avatar/presign", requireAuth, async (req, res, next) => {
  try {
    const contentType = str(req.body?.contentType, 60).toLowerCase();
    if (!imageContentTypeOk(contentType)) {
      return res.status(400).json({ error: "unsupported_type", message: "Yalnız JPG, PNG, WEBP veya GIF." });
    }
    if (!storageConfigured()) {
      return res.status(503).json({ error: "storage_not_configured", message: "Görsel deposu yapılandırılmamış." });
    }
    const objectKey = newAvatarKey(req.user.id, contentType);
    const url = await presignUpload(objectKey, contentType, 600);
    res.json({ objectKey, url, publicUrl: publicUrlFor(objectKey) });
  } catch (e) {
    next(e);
  }
});

/** POST /api/users/me/avatar — yüklenen nesne anahtarını profile bağla. */
router.post("/me/avatar", requireAuth, async (req, res, next) => {
  try {
    const objectKey = str(req.body?.objectKey, 300);
    // Başkasının anahtarını bağlamak mümkün değil.
    if (!isOwnAvatarKey(objectKey, req.user.id)) {
      return res.status(400).json({ error: "invalid_object_key" });
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarKey: objectKey },
      select: { handle: true, avatarKey: true }
    });
    res.json({ user: { handle: user.handle, avatarUrl: publicUrlFor(user.avatarKey) } });
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/users/me/avatar — avatarı kaldır. */
router.delete("/me/avatar", requireAuth, async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { avatarKey: null } });
    res.json({ user: { handle: req.user.handle, avatarUrl: null } });
  } catch (e) {
    next(e);
  }
});

/** GET /api/users/:handle — herkese açık profil; prompt yalnız üyeye. */
router.get("/:handle", async (req, res, next) => {
  try {
    const handle = String(req.params.handle || "").toLowerCase();
    const user = await prisma.user.findUnique({
      where: { handle },
      select: {
        id: true,
        handle: true,
        displayName: true,
        bio: true,
        avatarKey: true,
        createdAt: true,
        _count: { select: { followers: true, following: true, projects: true } }
      }
    });
    if (!user) return res.status(404).json({ error: "not_found" });

    const viewerId = req.user ? req.user.id : null;
    const isFollowing = viewerId
      ? Boolean(await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: user.id } } }))
      : false;

    const member = isMember(req.user);
    const projects = await prisma.project.findMany({
      where: member ? { ownerId: user.id } : { ownerId: user.id, isShared: true, hiddenAt: null },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: projectSelect(member)
    });

    res.json({
      user: publicUser(user, {
        avatarUrl: publicUrlFor(user.avatarKey),
        followerCount: user._count.followers,
        followingCount: user._count.following,
        projectCount: user._count.projects
      }),
      isSelf: viewerId === user.id,
      isFollowing,
      // Kendi profilinde avatar değiştirme düğmesi; başkasında yok.
      canEditAvatar: viewerId === user.id,
      projects: projects.map((p) => shapeProject(p, { publicUrlFor }))
    });
  } catch (e) {
    next(e);
  }
});

router.post("/:handle/follow", requireAuth, async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({ where: { handle: String(req.params.handle || "").toLowerCase() }, select: { id: true } });
    if (!target) return res.status(404).json({ error: "not_found" });
    if (target.id === req.user.id) return res.status(400).json({ error: "cannot_follow_self" });
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: req.user.id, followingId: target.id } },
      create: { followerId: req.user.id, followingId: target.id },
      update: {}
    });
    res.json({ isFollowing: true });
  } catch (e) {
    next(e);
  }
});

router.delete("/:handle/follow", requireAuth, async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({ where: { handle: String(req.params.handle || "").toLowerCase() }, select: { id: true } });
    if (!target) return res.status(404).json({ error: "not_found" });
    await prisma.follow.deleteMany({ where: { followerId: req.user.id, followingId: target.id } });
    res.json({ isFollowing: false });
  } catch (e) {
    next(e);
  }
});

export default router;
