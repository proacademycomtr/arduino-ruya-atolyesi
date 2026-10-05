/**
 * Proje sorgu seçimleri — prompt sızıntısının tek kapısı.
 * `promptBody` yalnız `MEMBER_SELECT` içinde bulunur; üye olmayan istekte
 * hiçbir koşulda Prisma'ya bu alan adı gönderilmez.
 */
const PUBLIC_SELECT = {
  id: true,
  title: true,
  summary: true,
  isShared: true,
  sharedAt: true,
  createdAt: true,
  owner: { select: { handle: true, displayName: true, avatarKey: true } },
  images: {
    select: { objectKey: true, width: true, height: true, sortOrder: true },
    orderBy: { sortOrder: "asc" }
  },
  // Beğeni/yorum sayıları herkese açıktır (içerik değil, sayaç).
  _count: { select: { likes: true, comments: true } }
};

const MEMBER_SELECT = { ...PUBLIC_SELECT, promptBody: true };

export function projectSelect(isMember) {
  return isMember ? MEMBER_SELECT : PUBLIC_SELECT;
}

export function shapeProject(project, { publicUrlFor }) {
  if (!project) return null;
  const counts = project._count || {};
  return {
    id: project.id,
    title: project.title,
    summary: project.summary,
    isShared: project.isShared,
    sharedAt: project.sharedAt,
    createdAt: project.createdAt,
    likeCount: counts.likes || 0,
    commentCount: counts.comments || 0,
    owner: {
      handle: project.owner.handle,
      displayName: project.owner.displayName,
      avatarUrl: publicUrlFor(project.owner.avatarKey)
    },
    images: project.images.map((img) => ({
      url: publicUrlFor(img.objectKey),
      width: img.width,
      height: img.height
    })),
    ...(Object.prototype.hasOwnProperty.call(project, "promptBody")
      ? { promptBody: project.promptBody }
      : {})
  };
}