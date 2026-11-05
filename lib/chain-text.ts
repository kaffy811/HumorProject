import "server-only";

// One text step of a multi-step chain (any step before the final captions):
// prompts in, plain text out. Gemini or OpenAI, with the photo when the step sees it.
export type TextStep = {
  provider: string; model: string; systemPrompt: string; prompt: string;
  image: { bytes: Uint8Array; mime: string } | null;
  maxOutputTokens: number | null; temperature: number | null;
};

export async function generateText(step: TextStep, fetcher: typeof fetch = fetch) {
  const signal = AbortSignal.timeout(30000);
  if (step.provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw Error("OpenAI API key is missing.");
    const content: object[] = [{ type: "text", text: step.prompt }];
    if (step.image) content.push({ type: "image_url", image_url: { url: `data:${step.image.mime};base64,${Buffer.from(step.image.bytes).toString("base64")}` } });
    const body: Record<string, unknown> = { model: step.model, messages: [{ role: "system", content: step.systemPrompt }, { role: "user", content }] };
    if (step.maxOutputTokens) body.max_completion_tokens = step.maxOutputTokens;
    if (step.temperature !== null) body.temperature = step.temperature;
    const r = await fetcher("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    const json = await r.json().catch(() => null);
    if (!r.ok) throw Error(`OpenAI returned HTTP ${r.status}`);
    if (json?.choices?.[0]?.message?.refusal) throw Error("Generation was blocked.");
    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw Error("OpenAI returned no text.");
    return { text, usage: json.usage || {} };
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Error("Gemini API key is missing.");
  const parts: object[] = [{ text: step.prompt }];
  if (step.image) parts.push({ inlineData: { mimeType: step.image.mime, data: Buffer.from(step.image.bytes).toString("base64") } });
  const config: Record<string, unknown> = {};
  if (step.maxOutputTokens) config.maxOutputTokens = step.maxOutputTokens;
  if (step.temperature !== null) config.temperature = step.temperature;
  const r = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(step.model)}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: step.systemPrompt }] }, contents: [{ role: "user", parts }], generationConfig: config }), signal,
  });
  const result = await r.json().catch(() => null);
  if (!r.ok) throw Error(`Gemini returned HTTP ${r.status}`);
  const candidate = result?.candidates?.[0];
  if (result?.promptFeedback?.blockReason || ["SAFETY", "RECITATION", "PROHIBITED_CONTENT"].includes(candidate?.finishReason)) throw Error("Generation was blocked.");
  const text = (candidate?.content?.parts ?? []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? "").join("").trim();
  if (!text) throw Error("Gemini returned no text.");
  return { text, usage: result.usageMetadata || {} };
}
