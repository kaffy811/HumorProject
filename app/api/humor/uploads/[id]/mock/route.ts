import { postsContext } from "@/lib/posts-server";
import { mockEnabled, StudioError } from "@/lib/studio-server";
import { sameOrigin } from "@/lib/humor-validation";
import { mockDraft, uploadMockDraft } from "@/lib/mock-create";
import { featureFailure } from "@/lib/member-feature-server";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!mockEnabled()) throw new StudioError("Not found.", 404);
    if (!sameOrigin(request)) throw new StudioError("Invalid origin.", 403);
    const ctx = await postsContext(),
      { id } = await params;
    const form = await request.formData(),
      photo = form.get("photo");
    if (!(photo instanceof File) || photo.size > 10_000_000)
      throw new StudioError("Keep it under 10 MB.");
    return Response.json(await uploadMockDraft(ctx.user.id, id, photo));
  } catch (e) {
    return featureFailure(e);
  }
}
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!mockEnabled()) throw new StudioError("Not found.", 404);
    const ctx = await postsContext(),
      { id } = await params,
      d = mockDraft(ctx.user.id, id);
    if (!d?.image) throw new StudioError("Not found.", 404);
    return new Response(new Uint8Array(d.image), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return featureFailure(e);
  }
}
