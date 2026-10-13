import { featureFailure } from "@/lib/member-feature-server";
import { postsContext } from "@/lib/posts-server";
import { validUuid } from "@/lib/create-contracts";
import { mockList } from "@/lib/mock-posts";
import { StudioError } from "@/lib/studio-server";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await postsContext(),
      { id } = await params,
      q = new URL(request.url).searchParams;
    if (q.get("tab") === "saved")
      throw new StudioError(
        "Saved posts are private. Use your own Saved tab.",
        403,
      );
    if (ctx.mock) {
      const all = [];
      let cursor: string | null = null;
      do {
        const p = mockList(ctx.user.id, "new", cursor, 12);
        all.push(...p.posts);
        cursor = p.nextCursor;
      } while (cursor);
      const offset = Number(q.get("cursor") || 0);
      if (!Number.isSafeInteger(offset) || offset < 0)
        throw new StudioError("Invalid cursor.");
      const mine = all.filter((p) => p.author.id === id);
      return Response.json({
        posts: mine.slice(offset, offset + 12),
        nextCursor: offset + 12 < mine.length ? String(offset + 12) : null,
        cutoff: new Date().toISOString(),
        mode: "mock",
      });
    }
    if (!validUuid(id)) throw new StudioError("Person not found.", 404);
    let snapshot = null,
      offset = 0;
    const raw = q.get("cursor");
    if (raw) {
      try {
        const c = JSON.parse(Buffer.from(raw, "base64url").toString());
        if (
          c.profile !== id ||
          !validUuid(c.snapshot) ||
          !Number.isSafeInteger(c.offset) ||
          c.offset < 0
        )
          throw 0;
        snapshot = c.snapshot;
        offset = c.offset;
      } catch {
        throw new StudioError("Invalid cursor.");
      }
    }
    const { data, error } = await ctx.admin.rpc("humor_profile_posts", {
      profile_id: id,
      viewer: ctx.user.id,
      snapshot_id: snapshot,
      page_offset: offset,
    });
    if (error) {
      if (error.message.includes("expired"))
        throw new StudioError("Refresh this profile to keep reading.", 410);
      throw error;
    }
    return Response.json(
      {
        posts: data.posts,
        nextCursor:
          data.nextOffset === null
            ? null
            : Buffer.from(
                JSON.stringify({
                  profile: id,
                  snapshot: data.snapshotId,
                  offset: data.nextOffset,
                }),
              ).toString("base64url"),
        cutoff: new Date().toISOString(),
        mode: "live",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return featureFailure(e);
  }
}
