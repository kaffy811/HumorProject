import { postsContext } from "@/lib/posts-server";
import { sameOrigin } from "@/lib/humor-validation";
import { validUuid } from "@/lib/create-contracts";
import { readJson, StudioError } from "@/lib/studio-server";
import { commentFailure } from "@/lib/comments-server";
import { mockCommentAction } from "@/lib/mock-comments";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!sameOrigin(request)) throw new StudioError("Invalid origin.", 403);
    const ctx = await postsContext(),
      { id } = await params,
      input = await readJson(request);
    if (!validUuid(input?.requestKey) || (!ctx.mock && !validUuid(id)))
      throw new StudioError("Invalid rating request.");
    if (ctx.mock)
      return Response.json(
        mockCommentAction(ctx.user.id, id, "ha", input.requestKey),
      );
    const { data, error } = await ctx.admin.rpc("toggle_humor_comment_ha", {
      comment_id: id,
      owner: ctx.user.id,
      request_key: input.requestKey,
    });
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return commentFailure(e);
  }
}
