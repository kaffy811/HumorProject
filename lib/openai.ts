import "server-only";
import { InvalidCaptions, validateCaptions } from "./gemini";

export type OpenAIOptions = {
  model: string;
  systemPrompt: string;
  schema: object | null;
  maxOutputTokens: number | null;
  temperature: number | null;
};

class SchemaRejected extends Error {}

// Same contract as generateCaptions in lib/gemini.ts: four validated captions
// with styles, or InvalidCaptions / a provider error.
export async function generateOpenAICaptions(
  bytes: Uint8Array,
  mime: string,
  prompt: string,
  options: OpenAIOptions,
) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Error("OpenAI API key is missing.");
  try {
    return await callOnce(key, bytes, mime, prompt, options);
  } catch (error) {
    // Strict mode accepts only part of JSON Schema; retry once in plain JSON mode.
    if (error instanceof SchemaRejected)
      return callOnce(key, bytes, mime, prompt, { ...options, schema: null });
    throw error;
  }
}

export function openAIRequest(
  bytes: Uint8Array,
  mime: string,
  prompt: string,
  options: OpenAIOptions,
) {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: [
      { role: "system", content: options.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,
            },
          },
        ],
      },
    ],
    response_format: options.schema
      ? {
          type: "json_schema",
          json_schema: { name: "captions", strict: true, schema: options.schema },
        }
      : { type: "json_object" },
  };
  if (options.maxOutputTokens) body.max_completion_tokens = options.maxOutputTokens;
  if (options.temperature !== null) body.temperature = options.temperature;
  return body;
}

async function callOnce(
  key: string,
  bytes: Uint8Array,
  mime: string,
  prompt: string,
  options: OpenAIOptions,
) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(openAIRequest(bytes, mime, prompt, options)),
    signal: AbortSignal.timeout(45000),
  });
  const result = await r.json().catch(() => null);
  if (!r.ok) {
    const detail = String(result?.error?.message ?? "");
    if (r.status === 400 && options.schema && /schema|response_format/i.test(detail))
      throw new SchemaRejected(detail);
    throw Error(`OpenAI returned HTTP ${r.status}`);
  }
  const message = result?.choices?.[0]?.message;
  if (message?.refusal) throw Error("Generation was blocked.");
  if (result?.choices?.[0]?.finish_reason !== "stop")
    throw new InvalidCaptions("Generation did not complete.");
  try {
    const captions = validateCaptions(JSON.parse(String(message?.content ?? "")));
    return { captions, description: "", usage: { attempts: [result.usage || {}] } };
  } catch (e) {
    if (e instanceof SyntaxError) throw new InvalidCaptions("The baby lost the punchline. Try again.");
    throw e;
  }
}
