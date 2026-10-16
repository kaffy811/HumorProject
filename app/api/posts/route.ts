import { postsContext, fetchPostPage } from "@/lib/posts-server";
import type { PostSort } from "@/lib/post-contracts";
import { mockList } from "@/lib/mock-posts";
import { studioFailure, StudioError } from "@/lib/studio-server";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const ctx = await postsContext(),
      q = new URL(request.url).searchParams,
      sort = q.get("sort") || "new",
      limit = Number(q.get("limit") || 9);
    if (
      !["hot", "new", "mine", "saved"].includes(sort) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 12
    )
      throw new StudioError("Invalid feed request.");
    if (q.has("page")) {
      const page = Number(q.get("page"));
      if (!Number.isSafeInteger(page) || page < 1)
        throw new StudioError("Invalid page.");
      if (ctx.mock) {
        const first = mockList(
          ctx.user.id,
          sort as PostSort,
          q.get("snapshot") ? `${q.get("snapshot")}:0` : null,
          12,
        );
        const all = [...first.posts];
        let cursor = first.nextCursor;
        while (cursor) {
          const next = mockList(ctx.user.id, sort as PostSort, cursor, 12);
          all.push(...next.posts);
          cursor = next.nextCursor;
        }
        return Response.json({
          ...first,
          posts: all.slice((page - 1) * 9, page * 9),
          page,
          totalCount: all.length,
          totalPages: Math.max(1, Math.ceil(all.length / 9)),
          nextCursor: null,
        });
      }
      const r = await ctx.admin.rpc("humor_paged_feed", {
        owner: ctx.user.id,
        ordering: sort,
        page_number: page,
        snapshot_id: q.get("snapshot") || null,
      });
      if (r.error) {
        if (r.error.message.includes("snapshot expired"))
          throw new StudioError(
            "This feed session has expired. Refresh the feed.",
            410,
          );
        throw r.error;
      }
      return Response.json(
        { ...r.data, mode: "live" },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return Response.json(
      ctx.mock
        ? mockList(ctx.user.id, sort as PostSort, q.get("cursor"), limit)
        : await fetchPostPage(ctx, sort as PostSort, q.get("cursor"), limit),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return studioFailure(e);
  }
}
