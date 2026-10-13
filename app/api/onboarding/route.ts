import { featureFailure } from "@/lib/member-feature-server";
import { postsContext } from "@/lib/posts-server";
import { sameOrigin } from "@/lib/humor-validation";
import { StudioError } from "@/lib/studio-server";
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new StudioError("Invalid origin.", 403);
    const ctx = await postsContext();
    if (!ctx.mock) {
      const result = await ctx.admin
        .from("profiles")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("id", ctx.user.id)
        .is("onboarded_at", null);
      if (result.error) throw result.error;
    }
    return Response.json({ ok: true });
  } catch (e) {
    return featureFailure(e);
  }
}
