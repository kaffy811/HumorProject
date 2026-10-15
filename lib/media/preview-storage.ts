/* eslint-disable @typescript-eslint/no-explicit-any -- Schema is selected at deployment time. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { dataSchema, storageBucket } from "@/lib/supabase/schema";
type StorageClient = SupabaseClient<any, "public", "public" | "humor_preview">;
// Copy an existing object only into the isolated preview bucket. Production is read-only here.
export async function downloadStoredFile(
  db: StorageClient,
  bucket: string,
  path: string,
) {
  const target = storageBucket(bucket);
  const result = await db.storage.from(target).download(path);
  if (result.data || dataSchema() !== "humor_preview") return result;
  const original = await db.storage.from(bucket).download(path);
  if (!original.data) return original;
  const copied = await db.storage.from(target).upload(path, original.data, {
    contentType: original.data.type,
    upsert: false,
  });
  // A concurrent copy can win. Never overwrite an object created by preview users.
  if (copied.error) return db.storage.from(target).download(path);
  return original;
}
export async function ensurePreviewFile(
  db: StorageClient,
  bucket: string,
  path: string,
) {
  if (dataSchema() !== "humor_preview") return;
  const result = await downloadStoredFile(db, bucket, path);
  if (result.error || !result.data)
    throw new Error("Preview media is unavailable.");
}
