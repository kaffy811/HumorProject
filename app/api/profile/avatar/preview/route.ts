import { storageBucket } from "@/lib/supabase/schema";
import { mockAvatar, mockAbandonAvatar } from "@/lib/mock-profiles";
import { featureFailure } from "@/lib/member-feature-server";
import { postsContext } from "@/lib/posts-server";
import { MAX_AVATAR_BYTES } from "@/lib/profile-contracts";
import { imageType, sameOrigin } from "@/lib/humor-validation";
import { stageProfileAvatar } from "@/lib/profile-server";
import { StudioError } from "@/lib/studio-server";
import { validUuid } from "@/lib/create-contracts";
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new StudioError("Invalid origin.", 403);
    const ctx = await postsContext(false);
    if (
      Number(request.headers.get("content-length")) >
      MAX_AVATAR_BYTES + 100000
    )
      throw new StudioError("Keep the photo under 5 MB.", 413);
    const form = await request.formData(),
      file = form.get("photo");
    if (!(file instanceof File) || file.size > MAX_AVATAR_BYTES || !file.size)
      throw new StudioError("Choose a JPG, PNG or WebP under 5 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer()),
      mime = imageType(bytes);
    if (!mime || mime !== file.type)
      throw new StudioError("Choose a JPG, PNG or WebP.");
    let crop;
    try {
      crop = JSON.parse(String(form.get("crop")));
    } catch {
      throw new StudioError("Choose a square crop.");
    }
    return Response.json(await stageProfileAvatar(ctx, bytes, crop));
  } catch (e) {
    return featureFailure(e);
  }
}
export async function GET(request: Request) {
  try {
    const ctx = await postsContext(false),
      id = new URL(request.url).searchParams.get("id");
    if (!validUuid(id)) throw new StudioError("Preview not found.", 404);
    if (ctx.mock) {
      const bytes = mockAvatar(ctx.user.id, id);
      if (!bytes) throw new StudioError("Preview expired.", 404);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "private, no-store",
        },
      });
    }
    const { data } = await ctx.admin
      .from("humor_avatar_uploads")
      .select("storage_path")
      .eq("id", id)
      .eq("user_id", ctx.user.id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!data) throw new StudioError("Preview expired.", 404);
    const file = await ctx.admin.storage
      .from(storageBucket("humor-avatars"))
      .download(data.storage_path);
    if (!file.data) throw new StudioError("Preview expired.", 404);
    return new Response(file.data, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return featureFailure(e);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request)) throw new StudioError("Invalid origin.", 403);
    const ctx = await postsContext(false),
      id = new URL(request.url).searchParams.get("id");
    if (!validUuid(id)) throw new StudioError("Invalid preview.");
    if (ctx.mock) {
      mockAbandonAvatar(ctx.user.id, id);
      return Response.json({ ok: true });
    }
    const result = await ctx.admin.rpc("humor_abandon_avatar", {
      owner: ctx.user.id,
      upload_id: id,
    });
    if (result.error) throw result.error;
    if (result.data)
      await ctx.admin.storage.from(storageBucket("humor-avatars")).remove([result.data]);
    return Response.json({ ok: true });
  } catch (e) {
    return featureFailure(e);
  }
}
