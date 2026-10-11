import { postsContext } from "@/lib/posts-server";
import { sameOrigin } from "@/lib/humor-validation";
import { validUuid } from "@/lib/create-contracts";
import { StudioError } from "@/lib/studio-server";
import { commentFailure } from "@/lib/comments-server";
import { mockCommentAction } from "@/lib/mock-comments";
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
