import { featureFailure } from "@/lib/member-feature-server";
import { postsContext } from "@/lib/posts-server";
import { sameOrigin } from "@/lib/humor-validation";
import { validUuid } from "@/lib/create-contracts";
import { StudioError, readJson } from "@/lib/studio-server";
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new StudioError("Invalid origin.", 403);
    const ctx = await postsContext(),
      input = await readJson(request);
    if (!validUuid(input?.postId)) throw new StudioError("Invalid post.");
    if (ctx.mock) return Response.json({ show: false });
    const { data, error } = await ctx.admin
      .from("profiles")
      .update({ first_post_notice_seen_at: new Date().toISOString() })
      .eq("id", ctx.user.id)
      .eq("first_post_notice_id", input.postId)
      .is("first_post_notice_seen_at", null)
      .select("id");
    if (error) throw error;
    return Response.json(
      { show: !!data?.length },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return featureFailure(e);
  }
}
