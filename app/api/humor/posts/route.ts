import { mockEnabled } from "@/lib/studio-server";
import { publishMockDraft } from "@/lib/mock-create";
import { createHash } from "node:crypto";
import { checkCaptionSafety } from "@/lib/moderation";
import { ensureLockedThumbnail } from "@/lib/post-previews";
import { characterCount, validUuid } from "@/lib/create-contracts";
import {
  readJson,
  studioContext,
  studioFailure,
  StudioError,
} from "@/lib/studio-server";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { user, admin } = await studioContext(request);
    const input = await readJson(request);
    if (
      !input ||
      !["ai","handmade"].includes(input.mode) ||
      ![input.draftId, input.idempotencyKey].every(validUuid) ||
      (input.mode !== "handmade" &&
        ![input.generationId, input.candidateId].every(validUuid)) ||
      typeof input.content !== "string" ||
      !input.content.trim() ||
      characterCount(input.content) > 200 ||
      /[\u0000-\u0008]/.test(input.content)
    )
      throw new StudioError("Choose a caption between 1 and 200 characters.");
    if (mockEnabled())
      return Response.json(
        publishMockDraft(
          user.id,
          input.draftId,
          input.content.trim(),
          input.mode === "handmade",
          input.candidateId,
        ),
      );
    const { data: ready, error: readyError } = await admin
      .from("humor_drafts")
      .select("image_path,caption_id,upload_status")
      .eq("image_id", input.draftId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readyError) throw readyError;
    if (!ready || ready.upload_status !== "ready")
      throw new StudioError("Upload the photo first.");
    if (ready.caption_id)
      return Response.json({
        postId: ready.caption_id,
        href: `/post/${ready.caption_id}`,
      });
    let generation: {
      provider: string;
      caption_candidates: { id: string }[];
    } | null = null;
    if (input.mode !== "handmade") {
      const { data: foundGeneration, error } = await admin
        .from("humor_generations")
        .select("provider,caption_candidates")
        .eq("id", input.generationId)
        .eq("image_id", input.draftId)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .maybeSingle();
      if (error) throw error;
      generation = foundGeneration;
      if (
        !generation ||
        !generation.caption_candidates?.some(
          (c: { id: string }) => c.id === input.candidateId,
        )
      )
        throw new StudioError(
          "That caption does not belong to this draft.",
          403,
        );
    }
    const mock =
      process.env.CAPTION_GENERATION_MODE === "mock" &&
      process.env.VERCEL_ENV !== "production";
    if (!mock) {
      const approval = await checkCaptionSafety(input.content.trim());
      const proof = await admin
        .from("humor_moderation_checks")
        .upsert({
          user_id: user.id,
          image_id: input.draftId,
          content_hash: createHash("sha256")
            .update(input.content.trim())
            .digest("hex"),
          model: approval.model,
          allowed: true,
          created_at: new Date().toISOString(),
        });
      if (proof.error) throw proof.error;
    }
    if (input.mode === "handmade") {
      await ensureLockedThumbnail(admin, input.draftId, ready.image_path);
      const r = await admin.rpc("publish_humor_handmade", {
        image_id: input.draftId,
        owner: user.id,
        final_text: input.content.trim(),
        publication_key: input.idempotencyKey,
      });
      if (r.error) throw r.error;
      return Response.json({
        postId: r.data.postId,
        href: `/post/${r.data.postId}`,
        isFirstPost: r.data.isFirstPost,
      });
    }
    if (generation?.provider === "mock")
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
