import { featureFailure } from "@/lib/member-feature-server";
import { postsContext } from "@/lib/posts-server";
import { mockInbox } from "@/lib/mock-notifications";
export async function GET() {
  try {
    const ctx = await postsContext();
    if (ctx.mock) return Response.json(mockInbox(ctx.user.id).summary);
    const { data, error } = await ctx.admin.rpc("humor_notification_summary", {
      viewer: ctx.user.id,
    });
    if (error) throw error;
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return featureFailure(e);
  }
}
