import { featureFailure } from "@/lib/member-feature-server";
import { postsContext } from "@/lib/posts-server";
import { StudioError } from "@/lib/studio-server";
import { sameOrigin } from "@/lib/humor-validation";
import { validUuid } from "@/lib/create-contracts";
import { mockInbox } from "@/lib/mock-notifications";
async function inbox(request: Request, opening: boolean) {
  try {
    if (opening && !sameOrigin(request))
      throw new StudioError("Invalid origin.", 403);
    const ctx = await postsContext();
    if (ctx.mock) return Response.json(mockInbox(ctx.user.id, opening));
    const cursor = new URL(request.url).searchParams.get("cursor");
    let time = null,
      id = null;
    if (cursor) {
      try {
        const c = JSON.parse(Buffer.from(cursor, "base64url").toString());
        if (
          c.owner !== ctx.user.id ||
          !validUuid(c.id) ||
          !Number.isFinite(Date.parse(c.time))
        )
          throw 0;
        time = c.time;
        id = c.id;
      } catch {
        throw new StudioError("Invalid notification page.");
      }
    }
    const { data, error } = await ctx.admin.rpc("humor_notifications_page", {
      viewer: ctx.user.id,
      opening,
      before_time: time,
      before_id: id,
    });
    if (error) throw error;
    return Response.json(
      {
        ...data,
        nextCursor: data.nextCursor
          ? Buffer.from(
              JSON.stringify({ ...data.nextCursor, owner: ctx.user.id }),
            ).toString("base64url")
          : null,
        mode: "live",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return featureFailure(e);
  }
}
export async function GET(r: Request) {
  return inbox(r, false);
}
export async function POST(r: Request) {
  return inbox(r, true);
}
