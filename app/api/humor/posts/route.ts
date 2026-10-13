import { ensureLockedThumbnail } from "@/lib/post-previews";
import { characterCount, validUuid } from "@/lib/create-contracts";
import {
  readJson,
  studioContext,
  studioFailure,
  StudioError,
} from "@/lib/studio-server";
export async function POST(request: Request) {
  try {
    const { user, admin } = await studioContext(request);
    const input = await readJson(request);
    if (
      !input ||
      ![
        input.draftId,
        input.generationId,
        input.candidateId,
        input.idempotencyKey,
      ].every(validUuid) ||
      typeof input.content !== "string" ||
      !input.content.trim() ||
      characterCount(input.content) > 200 ||
      /[\u0000-\u0008]/.test(input.content)
    )
      throw new StudioError("Choose a caption between 1 and 200 characters.");
    const { data: generation, error } = await admin
      .from("humor_generations")
      .select("provider,caption_candidates")
      .eq("id", input.generationId)
      .eq("image_id", input.draftId)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .maybeSingle();
    if (error) throw error;
    if (
      !generation ||
      !generation.caption_candidates?.some(
        (c: { id: string }) => c.id === input.candidateId,
      )
    )
      throw new StudioError("That caption does not belong to this draft.", 403);
    if (generation.provider === "mock")
      return Response.json({
        postId: input.generationId,
        href: `/post/${input.generationId}`,
      });
    const { data: draft, error: draftError } = await admin
      .from("humor_drafts")
      .select("image_path")
      .eq("image_id", input.draftId)
      .eq("user_id", user.id)
      .single();
    if (draftError) throw draftError;
    await ensureLockedThumbnail(admin, input.draftId, draft.image_path);
    const { data: postId, error: published } = await admin.rpc(
      "humor_publish_onboarded",
      {
        image_id: input.draftId,
        owner: user.id,
        generation_id: input.generationId,
        candidate_id: input.candidateId,
        final_text: input.content.trim(),
        publication_key: input.idempotencyKey,
      },
    );
    if (published) throw published;
    return Response.json({
      postId: postId.postId,
      href: `/post/${postId.postId}`,
      isFirstPost: postId.isFirstPost,
    });
  } catch (error) {
    return studioFailure(error);
  }
}
