import express from "express";
import { prisma } from "../db.js";
import { isMember, requireAuth } from "../auth.js";

const router = express.Router();

/**
 * Demo akışının kapısı: gerçek AI çağrısı yapmadan önce sunucudan tek
 * seferlik geçiş istenir. Üye olmayan kullanıcıya ücretsiz hak kalmadıysa
 * 402 döner ve istemci paywall'a düşer.
 *
 * Not: AI kullanıcının kendi API anahtarıyla çalıştığı için bu bir
 * maliyet kontrolü değil, dönüşüm kapısıdır. Saf istemci olduğu için
 * %100 zorunlu kılınamaz; $1'lik üründe kabul edilen bir sınırdır.
 */
router.post("/pass", requireAuth, async (req, res, next) => {
  try {
    if (isMember(req.user)) {
      return res.json({ allowed: true, unlimited: true, freePasses: req.user.freePasses });
    }
    // Atomik azaltma: eşzamanlı iki istek sıfırı eksiye düşüremez.
    const updated = await prisma.user.updateMany({
      where: { id: req.user.id, freePasses: { gt: 0 } },
      data: { freePasses: { decrement: 1 } }
    });
    if (updated.count === 0) {
      return res.status(402).json({
        error: "upgrade_required",
        upgrade: true,
        message: "Ücretsiz proje hakkın kullanıldı. Üye olmak sınırsız devam eder."
      });
    }
    const fresh = await prisma.user.findUnique({ where: { id: req.user.id }, select: { freePasses: true } });
    res.json({ allowed: true, unlimited: false, freePasses: fresh ? fresh.freePasses : 0 });
  } catch (e) {
    next(e);
  }
});

export default router;