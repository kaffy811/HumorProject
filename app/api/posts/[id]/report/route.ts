import { postsContext, activePost } from "@/lib/posts-server";
import { sameOrigin } from "@/lib/humor-validation";
import { REPORT_REASONS } from "@/lib/post-contracts";
import { readJson, studioFailure, StudioError } from "@/lib/studio-server";
import { mockAction } from "@/lib/mock-posts";
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
    if (ctx.mock) return Response.json(mockAction(ctx.user.id, id, "report"));
    const p = await activePost(ctx, id);
    if (
      (p.humor_images as unknown as { user_id: string }).user_id === ctx.user.id
    )
      throw new StudioError("This is your own post.");
    const { error } = await ctx.admin
      .from("humor_reports")
      .upsert(
        { user_id: ctx.user.id, caption_id: id, reason: input.reason },
        { onConflict: "caption_id,user_id" },
      );
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return studioFailure(e);
  }
}
