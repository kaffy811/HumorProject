import { downloadStoredFile } from "@/lib/media/preview-storage";
import { featureFailure } from "@/lib/member-feature-server";
import { postsContext } from "@/lib/posts-server";
import { validUuid } from "@/lib/create-contracts";
import { StudioError } from "@/lib/studio-server";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await postsContext(false),
      { id } = await params;
    if (!validUuid(id)) throw new StudioError("Photo not found.", 404);
    const { data, error } = await ctx.admin
      .from("profiles")
      .select("avatar_path")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.avatar_path) throw new StudioError("Photo not found.", 404);
    const file = await downloadStoredFile(ctx.admin, "humor-avatars", data.avatar_path);
    if (file.error || !file.data)
      throw new StudioError("Photo not found.", 404);
    return new Response(file.data, {
      headers: {
        "Content-Type": file.data.type,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return featureFailure(e);
  }
}
