import { postsContext, fetchPostPage } from "@/lib/posts-server";
import { mockList } from "@/lib/mock-posts";
import { studioFailure, StudioError } from "@/lib/studio-server";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const ctx = await postsContext(),
      q = new URL(request.url).searchParams,
      sort = q.get("sort") || "hot",
      limit = Number(q.get("limit") || 12);
    if (
      !["hot", "new"].includes(sort) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 12
    )
      throw new StudioError("Invalid feed request.");
    return Response.json(
      ctx.mock
        ? mockList(ctx.user.id, sort as "hot" | "new", q.get("cursor"), limit)
        : await fetchPostPage(
            ctx,
            sort as "hot" | "new",
            q.get("cursor"),
            limit,
          ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return studioFailure(e);
  }
}
