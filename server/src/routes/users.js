import express from "express";
import { prisma } from "../db.js";
import { isMember, publicUser, requireAuth } from "../auth.js";
import { projectSelect, shapeProject } from "../projectSelect.js";
import { publicUrlFor } from "../storage.js";

const router = express.Router();

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
      where: member ? { ownerId: user.id } : { ownerId: user.id, isShared: true },
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