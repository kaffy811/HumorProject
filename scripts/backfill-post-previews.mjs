// One-time, restartable backfill. Load credentials from your server environment.
// node --env-file=.env.production.local scripts/backfill-post-previews.mjs
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    "Run with the server Supabase URL and service key configured. Never commit the environment file.",
  );
if (new URL(url).hostname !== "wqkpatxsbxwjsupojjcq.supabase.co")
  throw new Error("This script is restricted to Humor Project.");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let done = 0;
for (;;) {
  const { data: rows, error } = await db
    .from("humor_images")
    .select("id,storage_path")
    .eq("status", "ready")
    .is("locked_thumbnail_path", null)
    .order("id")
    .limit(20);
  if (error) throw error;
  if (!rows.length) break;
  for (const row of rows) {
    const { data: file, error: download } = await db.storage
      .from("humor-images")
      .download(row.storage_path);
    if (download) throw download;
    const bytes = await sharp(new Uint8Array(await file.arrayBuffer()), {
        animated: false,
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize({
          width: 48,
          height: 48,
          fit: "inside",
          withoutEnlargement: true,
        })
        .blur(6)
        .webp({ quality: 25 })
        .toBuffer(),
      path = `${row.id}/locked.webp`;
    const { error: upload } = await db.storage
      .from("humor-previews")
      .upload(path, bytes, { contentType: "image/webp", upsert: true });
    if (upload) throw upload;
    const { error: update } = await db
      .from("humor_images")
      .update({ locked_thumbnail_path: path })
      .eq("id", row.id)
      .is("locked_thumbnail_path", null);
    if (update) throw update;
    done++;
  }
  console.log(`${done} thumbnails stored.`);
}
console.log(
  `Complete: ${done} thumbnails. Already completed images were skipped.`,
);
