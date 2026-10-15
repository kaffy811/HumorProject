import { dataSchema } from "@/lib/supabase/schema";
import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { config } from "./supabase/config";
import { validUuid } from "./create-contracts";
import { mockEnabled, StudioError } from "./studio-server";
import { mockGet } from "./mock-posts";
export function publicAdmin() {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new StudioError("The post is awaiting configuration.", 503);
  return createClient(config().url, key, {
    db: {schema: dataSchema()},
      auth: { persistSession: false, autoRefreshToken: false },
  });
}
export const publicPost = cache(async (id: string) => {
  if (mockEnabled()) {
    const p = mockGet("public-preview", id);
    return p
      ? {
          id: p.id,
          caption: p.caption,
          authorName: p.author.name,
          imageId: p.id,
          imagePath: p.imageUrl,
          thumbnailPath: null,
          ogPath: null,
          imageWidth: p.imageWidth,
          imageHeight: p.imageHeight,
        }
      : null;
  }
  if (!validUuid(id)) return null;
  const db = publicAdmin();
  const { data: c, error } = await db
    .from("humor_captions")
    .select("id,content,og_path,image_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!c) return null;
  const { data: i, error: ie } = await db
    .from("humor_images")
    .select(
      "storage_path,status,user_id,image_width,image_height,locked_thumbnail_path",
    )
    .eq("id", c.image_id)
    .single();
  if (ie) throw ie;
  if (i.status !== "ready") return null;
  const { data: p, error: pe } = await db
    .from("profiles")
    .select("username")
    .eq("id", i.user_id)
    .maybeSingle();
  if (pe) throw pe;
  return {
    id: c.id,
    caption: c.content,
    authorName: `@${p?.username || "member"}`,
    imageId: c.image_id,
    imagePath: i.storage_path,
    thumbnailPath: i.locked_thumbnail_path,
    ogPath: c.og_path,
    imageWidth: i.image_width || 800,
    imageHeight: i.image_height || 800,
  };
});
export function excerpt(text: string, limit: number, ellipsis = false) {
  const chars = Array.from(text);
  return chars.slice(0, limit).join("") + (ellipsis ? "…" : "");
}
export async function lockedPost(id: string) {
  const p = await publicPost(id);
  if (!p) return null;
  // The locked DTO intentionally contains neither the original URL nor caption.
  return {
    id: p.id,
    caption: excerpt(p.caption, 20, true),
    thumbnailUrl: `/post/${p.id}/thumbnail`,
    authorName: p.authorName,
  };
}
