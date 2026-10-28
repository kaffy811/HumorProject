import {generateMockDraft} from "@/lib/mock-create";
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
import { generateOpenAICaptions } from "@/lib/openai";
import {
  BUILTIN_VERSION,
  fillPrompt,
  loadGenerationRoute,
  type GenerationRoute,
} from "@/lib/generation-route";

// What is recorded as generation_config for an admin-configured route.
function routeSettings(route: GenerationRoute) {
  if (route.provider === "openai")
    return {
      response_format: route.schema ? "json_schema" : "json_object",
      ...(route.schema ? { schema: route.schema } : {}),
      ...(route.maxOutputTokens ? { max_completion_tokens: route.maxOutputTokens } : {}),
      ...(route.temperature !== null ? { temperature: route.temperature } : {}),
    };
  return {
    ...GENERATION_CONFIG,
    responseJsonSchema: route.schema ?? GENERATION_CONFIG.responseJsonSchema,
    maxOutputTokens: route.maxOutputTokens ?? GENERATION_CONFIG.maxOutputTokens,
    ...(route.temperature !== null ? { temperature: route.temperature } : {}),
  };
}
function callRoute(route: GenerationRoute, bytes: Uint8Array, prompt: string) {
  if (route.provider === "openai")
    return generateOpenAICaptions(bytes, "image/png", prompt, route);
  return generateCaptions(bytes, "image/png", prompt, {
    model: route.model,
    systemPrompt: route.systemPrompt,
    config: routeSettings(route),
  });
}
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
    if(mockEnabled())return Response.json(generateMockDraft(ctx.user.id,input.uploadId));
    if (process.env.AI_ENABLED === "false")
      throw new StudioError(
        "The baby is on a creative break. Try again later.",
        503,
      );
    const mock = mockEnabled();
    // The admin's prompt-chain mix; null means the built-in Gemini prompt.
    let route = mock ? null : (await loadGenerationRoute(admin)).route;
    if (!mock && !route && !process.env.GEMINI_API_KEY)
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
    const builtinModel = () => (mock ? "demo-captions-v1" : geminiSettings().model);
    const reserve = (chosen: GenerationRoute | null, withVersion: boolean) =>
      admin!.rpc("reserve_humor_generation", {
        image_id: input.uploadId,
        owner: ctx.user.id,
        request_key: input.requestId,
        provider_name: mock ? "mock" : chosen?.provider ?? "google",
        model_name: chosen?.model ?? builtinModel(),
        system_text: chosen?.systemPrompt ?? SYSTEM_PROMPT,
        user_text: chosen ? fillPrompt(chosen.userTemplate, input.context) : prompt,
        settings: chosen ? routeSettings(chosen) : GENERATION_CONFIG,
        joke_style: "AUTO",
        extra_context: input.context,
        ...(withVersion ? { prompt_version_name: chosen?.promptVersion ?? BUILTIN_VERSION } : {}),
      });
    let { data: id, error: reservation } = await reserve(route, true);
    let reservedWithVersion = true;
    // Database without migration 202610290001: the old function, built-in prompt only.
    if (reservation?.code === "PGRST202") {
      route = null;
      reservedWithVersion = false;
      ({ data: id, error: reservation } = await reserve(null, false));
    }
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
      // Also pins the record to the route actually called: a retried request
      // reuses its reservation, and the mix may pick differently the second time.
      .update({
        failure_stage: "request_started",
        ...(mock
          ? {}
          : {
              provider: route?.provider ?? "google",
              model: route?.model ?? builtinModel(),
              system_prompt: route?.systemPrompt ?? SYSTEM_PROMPT,
              user_prompt: route ? fillPrompt(route.userTemplate, input.context) : prompt,
              generation_config: route ? routeSettings(route) : GENERATION_CONFIG,
              ...(reservedWithVersion ? { prompt_version: route?.promptVersion ?? BUILTIN_VERSION } : {}),
            }),
      })
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
    const bytes = new Uint8Array(await file.arrayBuffer());
    const started = Date.now();
    const result = mock
      ? {
          description: "Local demo image.",
          captions: [{caption:"A photo with the confidence of a group project leader.",style:"Deadpan" as const},{caption:"My camera roll has better attendance than I do.",style:"Roast" as const},{caption:"A small moment. An unnecessarily large personality.",style:"Absurd" as const},{caption:"Proof that a picture is worth at least four mediocre jokes.",style:"Wholesome" as const}],
          usage: {},
        }
      : route
        ? await callRoute(route, bytes, fillPrompt(route.userTemplate, input.context)).catch(async (failure) => {
            // The configured model failed: switch this run to the built-in Gemini
            // prompt, record the switch, and try once more.
            // Gemini can take up to 2 × 45 s; only retry while that still fits in maxDuration.
            if (!process.env.GEMINI_API_KEY || Date.now() - started > 25_000) throw failure;
            const from = { provider: route!.provider, model: route!.model, promptVersion: route!.promptVersion, error: failure instanceof Error ? failure.message : "failed" };
            const { error: switched } = await admin!
              .from("humor_generations")
              .update({ provider: "google", model: builtinModel(), system_prompt: SYSTEM_PROMPT, user_prompt: prompt, generation_config: GENERATION_CONFIG, prompt_version: BUILTIN_VERSION })
              .eq("id", id);
            if (switched) throw failure;
            const retry = await generateCaptions(bytes, "image/png", prompt);
            return { ...retry, usage: { ...retry.usage, fallbackFrom: from } };
          })
        : await generateCaptions(bytes, "image/png", prompt);
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
