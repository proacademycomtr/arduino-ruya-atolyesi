import crypto from "node:crypto";
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Config } from "./config.js";

let client = null;

export function storageConfigured() {
  return Boolean(s3Config.endpoint && s3Config.accessKeyId && s3Config.secretAccessKey && s3Config.bucket);
}

export function getClient() {
  if (!storageConfigured()) return null;
  if (!client) {
    client = new S3Client({
      region: s3Config.region,
      endpoint: s3Config.endpoint,
      forcePathStyle: s3Config.forcePathStyle,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey
      }
    });
  }
  return client;
}

const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export function imageContentTypeOk(contentType) {
  return Object.prototype.hasOwnProperty.call(EXT_BY_TYPE, String(contentType || "").toLowerCase());
}

export function newObjectKey(userId, projectId, contentType) {
  const ext = EXT_BY_TYPE[String(contentType || "").toLowerCase()] || "bin";
  const stamp = new Date().toISOString().slice(0, 10);
  return `u/${userId}/${projectId}/${stamp}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
}

/** Avatar anahtarı: proje içermez, kullanıcı klasörünün altında. */
export function newAvatarKey(userId, contentType) {
  const ext = EXT_BY_TYPE[String(contentType || "").toLowerCase()] || "bin";
  const stamp = new Date().toISOString().slice(0, 10);
  return `u/${userId}/avatar/${stamp}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
}

/** Avatar nesne anahtarı kullanıcının kendi klasörüne ait mi? */
export const isOwnAvatarKey = (objectKey, userId) =>
  String(objectKey || "").startsWith(`u/${userId}/avatar/`);

/** Tarayıcı görseli doğrudan MinIO'ya yükler; API dosyayı asla taşımaz. */
export async function presignUpload(objectKey, contentType, expiresIn = 600) {
  const c = getClient();
  if (!c) return null;
  const command = new PutObjectCommand({
    Bucket: s3Config.bucket,
    Key: objectKey,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable"
  });
  return getSignedUrl(c, command, { expiresIn });
}

/** Depolama başlarken bucket yoksa oluşturur. MinIO ve S3Mock ile çalışır. */
export async function ensureBucket() {
  const c = getClient();
  if (!c) return { ok: false, reason: "not_configured" };
  try {
    await c.send(new HeadBucketCommand({ Bucket: s3Config.bucket }));
    return { ok: true, created: false };
  } catch {
    try {
      await c.send(new CreateBucketCommand({ Bucket: s3Config.bucket }));
      return { ok: true, created: true };
    } catch (e) {
      return { ok: false, reason: e.name || "bucket_failed" };
    }
  }
}

export function publicUrlFor(objectKey) {
  if (!objectKey) return null;
  if (s3Config.publicUrl) return `${s3Config.publicUrl}/${objectKey}`;
  if (s3Config.endpoint) return `${s3Config.endpoint}/${s3Config.bucket}/${objectKey}`;
  return null;
}