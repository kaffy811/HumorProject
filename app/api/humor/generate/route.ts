import { storageBucket } from "@/lib/supabase/schema";
import { randomUUID } from "node:crypto";
import {
  characterCount,
  validUuid,
  type CaptionCandidate,
} from "@/lib/create-contracts";
import {
  readJson,
  studioContext,
  studioFailure,
  StudioError,
  mockEnabled,
} from "@/lib/studio-server";
import {
  geminiSettings,
  generateCaptions,
  captionPrompt,
  SYSTEM_PROMPT,
  GENERATION_CONFIG,
} from "@/lib/gemini";
export const maxDuration = 120;
export async function POST(request: Request) {
  let generationId: string | undefined;
  let admin: Awaited<ReturnType<typeof studioContext>>["admin"] | undefined;
  try {
    const ctx = await studioContext(request);
    admin = ctx.admin;
    const input = await readJson(request);
    if (
      !input ||
      !validUuid(input.uploadId) ||
      !validUuid(input.requestId) ||
      typeof input.context !== "string" ||
      characterCount(input.context) > 120 ||
      /[\u0000-\u0008]/.test(input.context)
    )
      throw new StudioError(
        "Keep your direction under 120 characters.",
      );
    if (process.env.AI_ENABLED === "false")
      throw new StudioError(
        "The baby is on a creative break. Try again later.",
        503,
      );
    const mock = mockEnabled();
    if (!mock && !process.env.GEMINI_API_KEY)
      throw new StudioError(
        "The studio is awaiting Gemini configuration.",
        503,
      );
    const { data: draft, error } = await admin
      .from("humor_drafts")
      .select("*")
      .eq("image_id", input.uploadId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!draft || draft.upload_status !== "ready")
      throw new StudioError("Finish uploading the image first.");
    if (draft.caption_id)
      throw new StudioError(
        "This draft has already been posted. Start a new one.",
        409,
      );
    const prompt = captionPrompt(input.context);
    const model = mock ? "demo-captions-v1" : geminiSettings().model;
    const { data: id, error: reservation } = await admin.rpc(
      "reserve_humor_generation",
      {
        image_id: input.uploadId,
        owner: ctx.user.id,
        request_key: input.requestId,
        provider_name: mock ? "mock" : "google",
        model_name: model,
        system_text: SYSTEM_PROMPT,
        user_text: prompt,
        settings: GENERATION_CONFIG,
        joke_style: "AUTO",
        extra_context: input.context,
      },
    );
    if (reservation) {
      if (reservation.message.includes("Generation busy")) throw new StudioError("A caption is already brewing. Wait for it to finish.", 409);
      if (reservation.message.includes("Generation limit"))
        throw new StudioError(
          "Today’s generation limit has been reached. Try again tomorrow.",
          429,
        );
      throw reservation;
    }
    generationId = id;
    const { data: existing, error: lookup } = await admin
      .from("humor_generations")
      .select("status,caption_candidates")
      .eq("id", id)
      .single();
    if (lookup) throw lookup;
    if (existing.status === "completed")
      return Response.json({
        generationId: id,
        mode: mock ? "mock" : "live",
        candidates: existing.caption_candidates,
      });
    // Only the reservation creator may launch a billable request; duplicates see 409.
    const { data: claimed, error: claim } = await admin
      .from("humor_generations")
      .update({ failure_stage: "request_started" })
      .eq("id", id)
      .is("failure_stage", null)
      .select("id");
    if (claim) throw claim;
    if (!claimed?.length)
      throw new StudioError(
        "This generation is already running. Give it a moment.",
        409,
      );
    const { data: file, error: download } = await admin.storage
      .from(storageBucket("humor-images"))
      .download(draft.ai_path);
    if (download || !file) throw download;
    const result = mock
      ? {
          description: "Local demo image.",
          captions: [{caption:"A photo with the confidence of a group project leader.",style:"Deadpan" as const},{caption:"My camera roll has better attendance than I do.",style:"Roast" as const},{caption:"A small moment. An unnecessarily large personality.",style:"Absurd" as const},{caption:"Proof that a picture is worth at least four mediocre jokes.",style:"Wholesome" as const}],
          usage: {},
        }
      : await generateCaptions(
          new Uint8Array(await file.arrayBuffer()),
          "image/png",
          prompt,
        );
    const candidates: CaptionCandidate[] = result.captions.map(({caption:text,style}) => ({
      style,
      id: randomUUID(),
      generationId: id,
      originalText: text,
      text,
      source: "generated",
    }));
    const { error: saved } = await admin
      .from("humor_generations")
      .update({
        status: "completed",
        caption_candidates: candidates,
        scene: result.description,
        usage_metadata: result.usage,
        completed_at: new Date().toISOString(),
        failure_stage: null,
      })
      .eq("id", id);
    if (saved) throw saved;
    return Response.json({
      generationId: id,
      mode: mock ? "mock" : "live",
      candidates,
    });
  } catch (error) {
    if (
      generationId &&
      admin &&
      !(error instanceof StudioError && error.status === 409)
    )
      await admin
        .from("humor_generations")
        .update({ status: "failed", failure_stage: "generation" })
        .eq("id", generationId)
        .eq("status", "processing");
    return studioFailure(error);
  }
}
