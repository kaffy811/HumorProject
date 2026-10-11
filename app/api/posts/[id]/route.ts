import { postsContext } from "@/lib/posts-server";
import { sameOrigin } from "@/lib/humor-validation";
import { validUuid } from "@/lib/create-contracts";
import { studioFailure, StudioError } from "@/lib/studio-server";
import { mockAction } from "@/lib/mock-posts";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!sameOrigin(request)) throw new StudioError("Invalid origin.", 403);
    const ctx = await postsContext(),
      { id } = await params;
    if (ctx.mock) return Response.json(mockAction(ctx.user.id, id, "delete"));
    if (!validUuid(id)) throw new StudioError("Post not found.", 404);
    const { data: post, error: lookup } = await ctx.admin
      .from("humor_captions")
      .select("id,humor_images!inner(user_id)")
      .eq("id", id)
      .maybeSingle();
    if (lookup) throw lookup;
    if (!post) throw new StudioError("Post not found.", 404);
    if (
      (post.humor_images as unknown as { user_id: string }).user_id !==
      ctx.user.id
    )
      throw new StudioError("Only the author can delete this post.", 403);
    const { error } = await ctx.admin
      .from("humor_captions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return studioFailure(e);
  }
}
