import { postsContext, activePost } from "@/lib/posts-server";
import { parseCursor } from "@/lib/posts-server";
import { sameOrigin } from "@/lib/humor-validation";
import { validUuid } from "@/lib/create-contracts";
import { readJson, StudioError } from "@/lib/studio-server";
import { commentFailure } from "@/lib/comments-server";
import { validateComment, COMMENT_DEPTH_ERROR, MAX_COMMENT_DEPTH, type CommentSort } from "@/lib/comment-contracts";
import { mockCommentsList, mockCommentAdd } from "@/lib/mock-comments";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await postsContext(),
      { id } = await params,
      q = new URL(request.url).searchParams,
      sort = q.get("sort") || "top",
      limit = Number(q.get("limit") || 20);
    if (
      !["top", "new"].includes(sort) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 20
    )
      throw new StudioError("Invalid comments request.");
    if (ctx.mock)
      return Response.json(
        mockCommentsList(
          ctx.user.id,
          id,
          sort as CommentSort,
          q.get("cursor"),
          limit,
        ),
        { headers: { "Cache-Control": "private, no-store" } },
      );
    await activePost(ctx, id);
    const cursor = parseCursor(q.get("cursor"), sort as CommentSort);
    const { data, error } = await ctx.admin.rpc("humor_comments_page", {
      post_id: id,
      owner: ctx.user.id,
      ordering: sort,
      ...cursor,
      page_limit: limit,
    });
    if (error) throw error;
    return Response.json(
      {
        comments: data.comments,
        commentCount: data.commentCount,
        nextCursor:
          data.nextOffset === null
            ? null
            : Buffer.from(
                JSON.stringify({
                  snapshot: data.snapshotId,
                  sort,
                  offset: data.nextOffset,
                }),
              ).toString("base64url"),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return commentFailure(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!sameOrigin(request)) throw new StudioError("Invalid origin.", 403);
    const ctx = await postsContext(),
      { id } = await params,
      input = await readJson(request);
    if (
      !validateComment(input?.body) ||
      !validUuid(input?.requestKey) ||
      (input.replyToId != null && !validUuid(input.replyToId) && !ctx.mock)
    )
      throw new StudioError("Choose a comment between 1 and 280 characters.");
    if (ctx.mock)
      return Response.json(
        mockCommentAdd(
          ctx.user.id,
          id,
          input.body,
          input.replyToId,
          input.requestKey,
        ),
      );
    await activePost(ctx, id);
    if (input.replyToId) {
      const depth = await ctx.admin.rpc("humor_comment_depth", { comment_id: input.replyToId });
      if (depth.error) throw depth.error;
      if (depth.data >= MAX_COMMENT_DEPTH) throw new StudioError(COMMENT_DEPTH_ERROR);
    }
    const { data, error } = await ctx.admin.rpc("add_humor_comment", {
      post_id: id,
      owner: ctx.user.id,
      body: input.body,
      reply_id: input.replyToId || null,
      request_key: input.requestKey,
    });
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return commentFailure(e);
  }
}
