import { mockCheck } from "@/lib/mock-posts";
import { postsContext } from "@/lib/posts-server";
import { studioFailure, StudioError } from "@/lib/studio-server";
export async function GET(request: Request) {
  try {
    const ctx = await postsContext(),
      since = new URL(request.url).searchParams.get("since");
    if (!since || !Number.isFinite(Date.parse(since)))
      throw new StudioError("Invalid feed timestamp.");
    if (ctx.mock)
      return Response.json({ count: mockCheck(ctx.user.id, since) });
    const { count, error } = await ctx.admin
      .from("humor_captions")
      .select("id,humor_images!inner(status)", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("humor_images.status", "ready")
      .gt("created_at", since);
    if (error) throw error;
    return Response.json(
      { count: count || 0 },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return studioFailure(e);
  }
}
