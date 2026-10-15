import { postsContext, activePost } from "@/lib/posts-server";
import { sameOrigin } from "@/lib/humor-validation";
import { validUuid } from "@/lib/create-contracts";
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
    if (!validUuid(input?.requestKey))
      throw new StudioError("Invalid save request.");
    if (ctx.mock)
      return Response.json(
        mockAction(ctx.user.id, id, "save", input.requestKey),
      );
    await activePost(ctx, id);
    const { data, error } = await ctx.admin.rpc("toggle_humor_save_v2", {
      post_id: id,
      owner: ctx.user.id,
      request_key: input.requestKey,
    });
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return studioFailure(e);
  }
}
