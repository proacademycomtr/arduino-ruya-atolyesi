import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "..", ".env") });

const bool = (v, d) => (v === undefined || v === "" ? d : /^(1|true|yes|on)$/i.test(String(v)));
const int = (v, d) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : d);

export const config = {
  env: process.env.NODE_ENV || "development",
  port: int(process.env.PORT, 3000),
  host: process.env.HOST || "127.0.0.1",
  databaseUrl: process.env.DATABASE_URL || "",
  // Statik sitenin origin'i. Virgülle ayrılmış birden fazla kaynak.
  appOrigins: (process.env.APP_ORIGIN || "http://localhost:8000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  sessionDays: int(process.env.SESSION_DAYS, 30),
  trustProxy: bool(process.env.TRUST_PROXY, false),
  wallEnabled: bool(process.env.WALL_ENABLED, true),
  version: "4.1.0"
};

export const pricing = {
  // İlk 1000 kişi: tek seferlik $1 ömür boyu üyelik.
  // Limit dolunca aylık abonelik devreye girer.
  lifetimeLimit: int(process.env.PRICING_LIFETIME_LIMIT, 1000),
  lifetimeCents: int(process.env.PRICING_LIFETIME_CENTS, 100),
  monthlyCents: int(process.env.PRICING_MONTHLY_CENTS, 100),
  currency: (process.env.PRICING_CURRENCY || "usd").toLowerCase()
};

export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY || "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  priceLifetime: process.env.STRIPE_PRICE_LIFETIME || "",
  priceMonthly: process.env.STRIPE_PRICE_MONTHLY || ""
};

export const s3Config = {
  endpoint: process.env.S3_ENDPOINT || "",
  publicUrl: (process.env.S3_PUBLIC_URL || "").replace(/\/+$/, ""),
  region: process.env.S3_REGION || "us-east-1",
  bucket: process.env.S3_BUCKET || "arlo-gorseller",
  accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true)
};

export function missingRequiredEnv() {
  const missing = [];
  if (!config.databaseUrl) missing.push("DATABASE_URL");
  return missing;
}