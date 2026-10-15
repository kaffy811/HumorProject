import {trustedGooglePhoto} from "@/lib/google-avatar";
import { featureFailure } from "@/lib/member-feature-server";
import { postsContext } from "@/lib/posts-server";
import { validUuid } from "@/lib/create-contracts";
import { mockProfile } from "@/lib/mock-profiles";
import { StudioError } from "@/lib/studio-server";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await postsContext(),
      { id } = await params;
    if (ctx.mock) {
      const data = mockProfile(ctx.user.id, id);
      if (!data) throw new StudioError("Person not found.", 404);
      return Response.json({...data,googlePhotoUrl:id===ctx.user.id?trustedGooglePhoto(ctx.user):null});
    }
    if (!validUuid(id)) throw new StudioError("Person not found.", 404);
    const { data, error } = await ctx.admin.rpc("humor_profile_summary", {
      profile_id: id,
      viewer: ctx.user.id,
    });
    if (error) throw error;
    if (!data) throw new StudioError("Person not found.", 404);
    return Response.json({...data,googlePhotoUrl:id===ctx.user.id?trustedGooglePhoto(ctx.user):null}, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return featureFailure(e);
  }
}
