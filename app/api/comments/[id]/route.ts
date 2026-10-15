import { postsContext } from "@/lib/posts-server";
import { sameOrigin } from "@/lib/humor-validation";
import { validUuid } from "@/lib/create-contracts";
import { StudioError } from "@/lib/studio-server";
import { commentFailure } from "@/lib/comments-server";
import { mockCommentAction, mockCommentGet } from "@/lib/mock-comments";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!sameOrigin(request)) throw new StudioError("Invalid origin.", 403);
    const ctx = await postsContext(),
      { id } = await params;
    if (ctx.mock)
      return Response.json(mockCommentAction(ctx.user.id, id, "delete"));
    if (!validUuid(id)) throw new StudioError("Comment not found.", 404);
    const { data, error } = await ctx.admin.rpc("delete_humor_comment", {
      comment_id: id,
      owner: ctx.user.id,
    });
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return commentFailure(e);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await postsContext(),
      { id } = await params,
      post = new URL(request.url).searchParams.get("postId");
    if (ctx.mock && post) return Response.json(mockCommentGet(ctx.user.id,post,id));
    if (!validUuid(id) || !validUuid(post))
      throw new StudioError("Comment not found.", 404);
    const { data: row, error } = await ctx.admin
      .from("humor_comments")
      .select("id")
      .eq("id", id)
      .eq("caption_id", post)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new StudioError("Comment not found.", 404);
    const active = await ctx.admin.rpc("humor_post", {
      post_id: post,
      viewer: ctx.user.id,
    });
    if (!active.data) throw new StudioError("Post not found.", 404);
    const result = await ctx.admin.rpc("humor_comment_row", {
      comment_id: id,
      viewer: ctx.user.id,
    });
    if (result.error) throw result.error;
    return Response.json(result.data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return commentFailure(e);
  }
}
