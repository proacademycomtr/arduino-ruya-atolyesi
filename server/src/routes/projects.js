import express from "express";
import { prisma } from "../db.js";
import { requireMember } from "../auth.js";
import { imageContentTypeOk, newObjectKey, presignUpload, storageConfigured } from "../storage.js";
import { projectSelect, shapeProject } from "../projectSelect.js";
import { publicUrlFor } from "../storage.js";
import { searchTextFor } from "../str.js";

const router = express.Router();

const str = (v, max) => String(v ?? "").trim().slice(0, max);

/**
 * POST /api/projects — duvara paylaşım. Yalnız üyeler.
 * `promptBody` burada kaydedilir; okuma tarafı yalnız üyelere açar.
 */
router.post("/", requireMember, async (req, res, next) => {
  try {
    const title = str(req.body?.title, 120);
    const summary = str(req.body?.summary, 600);
    const promptBody = str(req.body?.promptBody, 8000);
    if (title.length < 3) return res.status(400).json({ error: "invalid_title", message: "Başlık en az 3 karakter olmalı." });
    if (promptBody.length < 10) return res.status(400).json({ error: "invalid_prompt", message: "Prompt en az 10 karakter olmalı." });

    const images = Array.isArray(req.body?.images) ? req.body.images.slice(0, 8) : [];
    for (const img of images) {
      const key = str(img?.objectKey, 300);
      // Görsel anahtarı yalnız kendi kullanıcı klasörüne ait olabilir.
      if (!key.startsWith(`u/${req.user.id}/`)) {
        return res.status(400).json({ error: "invalid_image_key" });
      }
    }

    let guideJson;
    if (req.body?.guideJson && typeof req.body.guideJson === "object") guideJson = req.body.guideJson;

    const project = await prisma.project.create({
      data: {
        ownerId: req.user.id,
        title,
        summary,
        promptBody,
        // Arama metni yazılırken katlanır; sorgu sırasında çalışma yok.
        searchText: searchTextFor(title, summary),
        guideJson,
        isShared: true,
        sharedAt: new Date(),
        images: {
          create: images.map((img, i) => ({
            objectKey: str(img.objectKey, 300),
            width: Number.isFinite(Number(img.width)) ? Number(img.width) : null,
            height: Number.isFinite(Number(img.height)) ? Number(img.height) : null,
            sortOrder: i
          }))
        }
      },
      select: projectSelect(true)
    });
    res.status(201).json({ project: shapeProject(project, { publicUrlFor }) });
  } catch (e) {
    next(e);
  }
});

/** POST /api/projects/:id/images/presign — tarayıcı görseli doğrudan MinIO'ya yükler. */
router.post("/:id/images/presign", requireMember, async (req, res, next) => {
  try {
    // Sıralama önemli: yetki ve içerik tipi ÖNCE doğrulanır. Aksi hâlde
    // depo yapılandırılmamışken her istek 503 alır ve gerçek hata (404/400)
    // gizlenir; ayrıca depo durumu yetkisiz kullanıcıya sızar.
    const project = await prisma.project.findUnique({ where: { id: String(req.params.id) }, select: { id: true, ownerId: true } });
    if (!project || project.ownerId !== req.user.id) return res.status(404).json({ error: "not_found" });

    const contentType = str(req.body?.contentType, 60).toLowerCase();
    if (!imageContentTypeOk(contentType)) {
      return res.status(400).json({ error: "unsupported_type", message: "Yalnız JPG, PNG, WEBP veya GIF." });
    }

    if (!storageConfigured()) {
      return res.status(503).json({ error: "storage_not_configured", message: "Görsel deposu yapılandırılmamış." });
    }
    const objectKey = newObjectKey(req.user.id, project.id, contentType);
    const url = await presignUpload(objectKey, contentType, 600);
    res.json({ objectKey, url, publicUrl: publicUrlFor(objectKey) });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/projects/:id/images — projeye oluşturulduktan sonra görsel ekle.
 * Paylaşım akışı: önce proje oluşur (görselsiz), sonra presigned PUT ile
 * dosya yüklenir, ardından bu uç nesne anahtarını projeye bağlar.
 */
router.post("/:id/images", requireMember, async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, ownerId: true, _count: { select: { images: true } } }
    });
    if (!project || project.ownerId !== req.user.id) return res.status(404).json({ error: "not_found" });
    if (project._count.images >= 8) return res.status(400).json({ error: "too_many_images", message: "En fazla 8 görsel." });

    const objectKey = str(req.body?.objectKey, 300);
    if (!objectKey.startsWith(`u/${req.user.id}/`)) return res.status(400).json({ error: "invalid_image_key" });

    await prisma.projectImage.create({
      data: {
        projectId: project.id,
        objectKey,
        width: Number.isFinite(Number(req.body?.width)) ? Number(req.body.width) : null,
        height: Number.isFinite(Number(req.body?.height)) ? Number(req.body.height) : null,
        sortOrder: project._count.images
      }
    });
    const updated = await prisma.project.findUnique({ where: { id: project.id }, select: projectSelect(true) });
    res.status(201).json({ project: shapeProject(updated, { publicUrlFor }) });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/projects/:id/share — duvardan kaldır (yalnız sahibi).
 * Proje SİLİNMEZ; yalnız paylaşım kapanır, sahibi rehberine erişmeye devam eder.
 */
router.delete("/:id/share", requireMember, async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, ownerId: true, isShared: true }
    });
    if (!project || project.ownerId !== req.user.id) return res.status(404).json({ error: "not_found" });
    if (!project.isShared) return res.json({ isShared: false, already: true });
    await prisma.project.update({
      where: { id: project.id },
      data: { isShared: false, sharedAt: null }
    });
    res.json({ isShared: false });
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /api/projects/:id/moderation — yalnız yönetici. Projeyi gizler
 * (duvardan düşer, kayıt kalır) ya da geri açar.
 */
router.patch("/:id/moderation", requireMember, async (req, res, next) => {
  try {
    if (req.user.isAdmin !== true) return res.status(403).json({ error: "forbidden" });
    const id = String(req.params.id);
    const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: "not_found" });
    const hidden = Boolean(req.body?.hidden);
    const project = await prisma.project.update({
      where: { id },
      data: { hiddenAt: hidden ? new Date() : null },
      select: { id: true, isShared: true, hiddenAt: true }
    });
    res.json({ project });
  } catch (e) {
    next(e);
  }
});

export default router;