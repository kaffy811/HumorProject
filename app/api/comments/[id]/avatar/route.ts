import { postsContext } from "@/lib/posts-server";
import { activeComment, commentFailure } from "@/lib/comments-server";
import { StudioError } from "@/lib/studio-server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await postsContext(),
      { id } = await params,
      c = await activeComment(ctx, id);
    const { data: p, error } = await ctx.admin
      .from("profiles")
      .select("avatar_path")
      .eq("id", c.user_id)
      .maybeSingle();
    if (error) throw error;
    if (!p?.avatar_path) throw new StudioError("Image not found.", 404);
    const { data, error: se } = await ctx.admin.storage
      .from("humor-avatars")
      .createSignedUrl(p.avatar_path, 300);
    if (se) throw se;
    return new Response(null, {
      status: 302,
      headers: {
        Location: data.signedUrl,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return commentFailure(e);
  }
}
