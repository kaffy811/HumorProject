import "server-only";
import { validUuid } from "./create-contracts";
import { StudioError, studioFailure } from "./studio-server";
import type { PostsContext } from "./posts-server";
import { COMMENT_DEPTH_ERROR } from "./comment-contracts";
export function commentFailure(e: unknown) {
  const message =
    typeof e === "object" && e && "message" in e ? String(e.message) : "";
  if (message.includes(COMMENT_DEPTH_ERROR))
    return Response.json({ error: COMMENT_DEPTH_ERROR }, { status: 400 });
  if (message.includes("rate limit"))
    return Response.json(
      { error: "Three thoughts in ten seconds. Give the fourth a moment." },
      { status: 429, headers: { "Retry-After": "10" } },
    );
  if (/not found/i.test(message))
    return Response.json({ error: message }, { status: 404 });
  if (/Only the author/i.test(message))
    return Response.json({ error: message }, { status: 403 });
  if (/Invalid|Reply no longer/i.test(message))
    return Response.json({ error: message }, { status: 400 });
  if (/snapshot expired/i.test(message))
    return Response.json(
      { error: "These comments need a fresh start. Retry to refresh." },
      { status: 410 },
    );
  return studioFailure(e);
}
export async function activeComment(ctx: PostsContext, id: string) {
  if (!validUuid(id)) throw new StudioError("Comment not found.", 404);
  const { data, error } = await ctx.admin
    .from("humor_comments")
    .select("id,caption_id,user_id,humor_captions!inner(deleted_at)")
    .eq("id", id)
    .is("deleted_at", null)
    .is("humor_captions.deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new StudioError("Comment not found.", 404);
  return data;
}
