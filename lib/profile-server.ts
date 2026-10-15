import { storageBucket } from "@/lib/supabase/schema";
import "server-only";
import { mockStageAvatar } from "./mock-profiles";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { PostsContext } from "./posts-server";
import { StudioError } from "./studio-server";
export async function stageProfileAvatar(
  ctx: PostsContext,
  bytes: Uint8Array,
  crop?: { x: number; y: number; size: number },
) {
  const base = sharp(bytes, {
    animated: false,
    limitInputPixels: 40_000_000,
    failOn: "warning",
  }).rotate();
  const rotated = await base.toBuffer();
  const meta = await sharp(rotated).metadata();
  if (!meta.width || !meta.height)
    throw new StudioError("That photo could not be opened.");
  const size = crop?.size ?? Math.min(meta.width, meta.height),
    x = crop?.x ?? Math.floor((meta.width - size) / 2),
    y = crop?.y ?? Math.floor((meta.height - size) / 2);
  if (
    ![size, x, y].every(Number.isSafeInteger) ||
    size < 1 ||
    x < 0 ||
    y < 0 ||
    x + size > meta.width ||
    y + size > meta.height
  )
    throw new StudioError("That crop is outside the photo.");
  const compressed = await sharp(rotated)
    .extract({ left: x, top: y, width: size, height: size })
    .resize(256, 256)
    .webp({ quality: 88 })
    .toBuffer();
  const id = randomUUID(),
    path = `${ctx.user.id}/${id}.webp`;
  if (ctx.mock) {
    mockStageAvatar(ctx.user.id, id, compressed);
    return { uploadId: id, avatarUrl: `/api/profile/avatar/preview?id=${id}` };
  }
  const upload = await ctx.admin.storage
    .from(storageBucket("humor-avatars"))
    .upload(path, compressed, { contentType: "image/webp" });
  if (upload.error) throw upload.error;
  const row = await ctx.admin
    .from("humor_avatar_uploads")
    .insert({ id, user_id: ctx.user.id, storage_path: path });
  if (row.error) {
    await ctx.admin.storage.from(storageBucket("humor-avatars")).remove([path]);
    throw row.error;
  }
  return { uploadId: id, avatarUrl: `/api/profile/avatar/preview?id=${id}` };
}
