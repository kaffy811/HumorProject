import { storageBucket } from "@/lib/supabase/schema";
import { dataSchema } from "@/lib/supabase/schema";
import "server-only";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { memberAuth } from "./member-auth";
import { config } from "./supabase/config";
import { profileComplete } from "./profile-complete";
import { mockEnabled, StudioError } from "./studio-server";
import { validUuid, validStyle } from "./create-contracts";
import type { Post, PostPage, PostSort } from "./post-contracts";
export async function postsContext(complete = true) {
  const { db, user } = await memberAuth();
  if (!user) throw new StudioError("Sign in with Google to continue.", 401);
  const { data: profile, error } = await db
    .from("profiles")
    .select("first_name,last_name,username,avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (complete && !profileComplete(profile))
    throw new StudioError("Complete your Profile first.", 403);
  const mock = mockEnabled();
  const secret = mock
    ? config().key
    : process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret)
    throw new StudioError("The feed is awaiting configuration.", 503);
  return {
    user,
    admin: createClient(config().url, secret, {
      db: {schema: dataSchema()},
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    mock,
  };
}
export type PostsContext = Awaited<ReturnType<typeof postsContext>>;
export function parseCursor(value: string | null, sort: PostSort | "top") {
  if (!value) return { snapshot_id: null, page_offset: 0 };
  try {
    const c = JSON.parse(Buffer.from(value, "base64url").toString());
    if (
      !validUuid(c.snapshot) ||
      c.sort !== sort ||
      !Number.isSafeInteger(c.offset) ||
      c.offset < 0
    )
      throw 0;
    return { snapshot_id: c.snapshot, page_offset: c.offset };
  } catch {
    throw new StudioError("That page marker is invalid.", 400);
  }
}
interface RawPost {
  id: string;
  caption: string;
  style: string;
  createdAt: string;
  imageId: string;
  imagePath: string;
  imageWidth: number | null;
  imageHeight: number | null;
  author?: Post["author"];
  authorId: string;
  authorName: string;
  avatarPath: string | null;
  haCount: number;
  commentCount: number;
  viewerHasHa: boolean;
  viewerHasSaved: boolean;
}
export async function fetchPostPage(
  ctx: PostsContext,
  sort: PostSort,
  cursor: string | null,
  limit: number,
): Promise<PostPage> {
  const pagination = parseCursor(cursor, sort);
  const { data, error } = await ctx.admin.rpc("humor_feed_page", {
    owner: ctx.user.id,
    ordering: sort,
    ...pagination,
    page_limit: limit,
  });
  if (error) {
    if (error.message.includes("snapshot expired"))
      throw new StudioError(
        "This feed session has expired. Refresh the feed.",
        410,
      );
    throw error;
  }
  const posts: Post[] = await Promise.all(
    (data.posts as RawPost[]).map(async (raw) => {
      let width = raw.imageWidth,
        height = raw.imageHeight;
      if (!width || !height) {
        const file = await ctx.admin.storage
          .from(storageBucket("humor-images"))
          .download(raw.imagePath);
        if (file.data) {
          try {
            const m = await sharp(
              new Uint8Array(await file.data.arrayBuffer()),
              { animated: false, limitInputPixels: 40_000_000 },
            ).metadata();
            const swapped = (m.orientation || 0) >= 5;
            width = (swapped ? m.height : m.width) || 800;
            height = (swapped ? m.width : m.pageHeight || m.height) || 800;
            const saved = await ctx.admin
              .from("humor_images")
              .update({ image_width: width, image_height: height })
              .eq("id", raw.imageId);
            if (saved.error) throw saved.error;
          } catch {
            width = 800;
            height = 800;
          }
        }
      }
      return {
        id: raw.id,
        caption: raw.caption,
        style: raw.style === "HANDMADE" ? "HANDMADE" : validStyle(raw.style) ? raw.style : "Deadpan",
        createdAt: raw.createdAt,
        imageWidth: width || 800,
        imageHeight: height || 800,
        imageUrl: `/api/posts/${raw.id}/media`,
        author: raw.author || {
          id: raw.authorId,
          name: raw.authorName,
          avatarUrl: raw.avatarPath
            ? `/api/posts/${raw.id}/media?kind=avatar`
            : null,
        },
        haCount: raw.haCount,
        commentCount: raw.commentCount,
        viewerHasHa: raw.viewerHasHa,
        viewerHasSaved: raw.viewerHasSaved,
      };
    }),
  );
  return {
    posts,
    nextCursor:
      data.nextOffset === null
        ? null
        : Buffer.from(
            JSON.stringify({
              snapshot: data.snapshotId,
              offset: data.nextOffset,
              sort,
            }),
          ).toString("base64url"),
    cutoff: data.cutoff,
    mode: "live",
  };
}
export async function activePost(ctx: PostsContext, id: string) {
  if (!validUuid(id)) throw new StudioError("Post not found.", 404);
  const { data, error } = await ctx.admin
    .from("humor_captions")
    .select("id,image_id,humor_images!inner(user_id,status)")
    .eq("id", id)
    .is("deleted_at", null)
    .eq("humor_images.status", "ready")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new StudioError("Post not found.", 404);
  return data;
}
