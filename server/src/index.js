import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { config, missingRequiredEnv, pricing } from "./config.js";
import { prisma } from "./db.js";
import { attachUser } from "./auth.js";
import { stripeConfigured, planFor } from "./stripe.js";
import { countLifetimeSeats } from "./seats.js";
import { ensureBucket, storageConfigured } from "./storage.js";

import authRoutes from "./routes/auth.js";
import aiPassRoutes from "./routes/aipass.js";
import wallRoutes from "./routes/wall.js";
import projectRoutes from "./routes/projects.js";
import socialRoutes from "./routes/social.js";
import userRoutes from "./routes/users.js";
import billingRoutes, { handleWebhook } from "./routes/billing.js";
import reportRoutes from "./routes/reports.js";

export function createApp() {
  const app = express();
  if (config.trustProxy) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  app.use(
    cors({
      origin(origin, cb) {
        // Site içi isteklerde origin yoktur; yalnız beyaz listedekiler kabul edilir.
        if (!origin || config.appOrigins.includes(origin)) return cb(null, true);
        cb(new Error("origin_not_allowed"));
      },
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "stripe-signature"],
      maxAge: 86400
    })
  );

  // Webhook ham gövdeye ihtiyaç duyar; JSON ayrıştırıcıdan ÖNCE bağlanır.
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), handleWebhook);

  app.use(express.json({ limit: "256kb" }));

  // Herkese açık rotalar da kullanıcıyı görür; üye olan rotalar kendi
  // kontrolünü yapar (requireAuth / requireMember).
  app.use(attachUser);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.env === "test" ? 10000 : 60,
    standardHeaders: true,
    legacyHeaders: false
  });

  app.get("/api/health", async (_req, res) => {
    let db = false;
    let used = 0;
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = true;
      // v4.4.0: doluluk barı için lansman kontenjanı sayısı.
      used = await countLifetimeSeats();
    } catch {
      db = false;
    }
    const decision = planFor(used);
    res.status(db ? 200 : 503).json({
      ok: db,
      version: config.version,
      db,
      stripe: stripeConfigured(),
      storage: storageConfigured(),
      wallEnabled: config.wallEnabled,
      pricing: {
        // Kademe sınırları + anlık doluluk (doluluk barı bunu kullanır).
        freeLimit: pricing.freeLimit,
        paidLimit: pricing.paidLimit,
        total: pricing.paidLimit,
        used,
        tier: decision.tier,
        remaining: decision.remaining,
        lifetimeCents: pricing.lifetimeCents,
        monthlyCents: pricing.monthlyCents,
        currency: pricing.currency
      }
    });
  });

  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/ai", aiPassRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api", reportRoutes);
  app.use("/api", socialRoutes);
  app.use("/api", wallRoutes);

  app.use("/api", (_req, res) => res.status(404).json({ error: "not_found" }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err && err.message === "origin_not_allowed") {
      return res.status(403).json({ error: "origin_not_allowed" });
    }
    const status = err.status || 500;
    if (status >= 500) console.error("[api]", err);
    res.status(status).json({ error: "server_error", message: status >= 500 ? "Beklenmeyen bir hata oluştu." : err.message });
  });

  return app;
}

export async function start() {
  const missing = missingRequiredEnv();
  if (missing.length) {
    console.error(`Eksik ortam değişkeni: ${missing.join(", ")} (server/.env dosyasını kontrol et)`);
    process.exit(1);
  }
  const app = createApp();
  const server = app.listen(config.port, config.host, async () => {
    console.log(`[api] http://${config.host}:${config.port} — ${config.env} (CORS: ${config.appOrigins.join(", ")})`);
    if (storageConfigured()) {
      const bucket = await ensureBucket();
      console.log(`[api] görsel deposu: ${bucket.ok ? (bucket.created ? "bucket oluşturuldu" : "hazır") : `hazır değil (${bucket.reason})`}`);
    } else {
      console.log("[api] görsel deposu yapılandırılmamış — paylaşım görselleri kapalı");
    }
  });
  const shutdown = async () => {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return server;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) start();

export default createApp;