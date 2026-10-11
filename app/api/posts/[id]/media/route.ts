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
    if (kind === "image") {
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
    const { data, error } = await ctx.admin.storage
      .from(bucket)
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
