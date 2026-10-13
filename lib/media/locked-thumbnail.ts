import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function ensureLockedThumbnail(
  db: SupabaseClient,
  imageId: string,
  sourcePath: string,
) {
  const { data: existing, error: lookup } = await db
    .from("humor_images")
    .select("locked_thumbnail_path")
    .eq("id", imageId)
    .single();
  if (lookup) throw lookup;
  if (existing.locked_thumbnail_path)
    return existing.locked_thumbnail_path as string;
  const { data: file, error } = await db.storage
    .from("humor-images")
    .download(sourcePath);
  if (error || !file) throw error || new Error("Missing image");
  const blurred = await sharp(new Uint8Array(await file.arrayBuffer()), {
    animated: false,
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize({ width: 48, height: 48, fit: "inside", withoutEnlargement: true })
    .blur(6)
    .webp({ quality: 25 })
    .toBuffer();
  const path = `${imageId}/locked.webp`;
  const { error: upload } = await db.storage
    .from("humor-previews")
    .upload(path, blurred, { contentType: "image/webp", upsert: true });
  if (upload) throw upload;
  const { error: update } = await db
    .from("humor_images")
    .update({ locked_thumbnail_path: path })
    .eq("id", imageId);
  if (update) throw update;
  return path;
}
