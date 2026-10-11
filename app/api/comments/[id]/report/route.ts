import { postsContext } from "@/lib/posts-server";
import { sameOrigin } from "@/lib/humor-validation";
import { readJson, StudioError } from "@/lib/studio-server";
import { commentFailure, activeComment } from "@/lib/comments-server";
import { REPORT_REASONS } from "@/lib/post-contracts";
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
    if (!REPORT_REASONS.includes(input?.reason))
      throw new StudioError("Choose a report reason.");
    if (ctx.mock)
      return Response.json(mockCommentAction(ctx.user.id, id, "report"));
    const c = await activeComment(ctx, id);
    if (c.user_id === ctx.user.id)
      throw new StudioError("You can delete your own comment.", 400);
    const { error } = await ctx.admin
      .from("humor_comment_reports")
      .upsert(
        { comment_id: id, user_id: ctx.user.id, reason: input.reason },
        { onConflict: "comment_id,user_id", ignoreDuplicates: true },
      );
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return commentFailure(e);
  }
}
