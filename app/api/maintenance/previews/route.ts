import { postsContext } from "@/lib/posts-server";
import { isMaintainer } from "@/lib/maintenance";
import { ensureLockedThumbnail } from "@/lib/post-previews";
import { sameOrigin } from "@/lib/humor-validation";
import { studioFailure, StudioError } from "@/lib/studio-server";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new StudioError("Invalid origin.", 403);
    const ctx = await postsContext();
    if (!isMaintainer(ctx.user.id))
      throw new StudioError("Project owner only.", 403);
    if (ctx.mock) return Response.json({ processed: 0, remaining: 0 });
    const { data: rows, error } = await ctx.admin
      .from("humor_images")
      .select("id,storage_path")
      .eq("status", "ready")
      .is("locked_thumbnail_path", null)
      .order("id")
      .limit(6);
    if (error) throw error;
    for (const row of rows)
      await ensureLockedThumbnail(ctx.admin, row.id, row.storage_path);
    const { count, error: ce } = await ctx.admin
      .from("humor_images")
      .select("id", { count: "exact", head: true })
      .eq("status", "ready")
      .is("locked_thumbnail_path", null);
    if (ce) throw ce;
    return Response.json(
      { processed: rows.length, remaining: count },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return studioFailure(e);
  }
}
