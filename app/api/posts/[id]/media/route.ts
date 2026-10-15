import { storageBucket } from "@/lib/supabase/schema";
import { downloadStoredFile, ensurePreviewFile } from "@/lib/media/preview-storage";
import sharp from "sharp";
import { postsContext, activePost } from "@/lib/posts-server";
import { studioFailure, StudioError } from "@/lib/studio-server";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await postsContext(),
      { id } = await params;
    const post = await activePost(ctx, id);
    const kind = new URL(request.url).searchParams.get("kind") || "image";
    let path: string | null = null,
      bucket = "humor-images";
    if (kind === "image" || kind === "thumb") {
      const { data, error } = await ctx.admin
        .from("humor_images")
        .select("storage_path")
        .eq("id", post.image_id)
        .single();
      if (error) throw error;
      path = data.storage_path;
    } else if (kind === "avatar") {
      bucket = "humor-avatars";
      const { data, error } = await ctx.admin
        .from("profiles")
        .select("avatar_path")
        .eq("id", (post.humor_images as unknown as { user_id: string }).user_id)
        .maybeSingle();
      if (error) throw error;
      path = data?.avatar_path || null;
    } else throw new StudioError("Invalid media.", 400);
    if (!path) throw new StudioError("Image not found.", 404);
    if (kind === "thumb") {
      const file = await downloadStoredFile(ctx.admin,bucket,path);
      if (!file.data) throw new StudioError("Image not found.", 404);
      const bytes = await sharp(new Uint8Array(await file.data.arrayBuffer()), {
        animated: false,
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize(128, 128, { fit: "cover" })
        .webp({ quality: 80 })
        .toBuffer();
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "private, max-age=300",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    await ensurePreviewFile(ctx.admin,bucket,path);
    const { data, error } = await ctx.admin.storage
      .from(storageBucket(bucket))
      .createSignedUrl(path, 300);
    if (error) throw error;
    return new Response(null, {
      status: 302,
      headers: {
        Location: data.signedUrl,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return studioFailure(e);
  }
}
