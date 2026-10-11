import type {
  GenerateCaptionsInput,
  GenerateCaptionsResult,
} from "./create-contracts";
export async function generateCaptions(
  input: GenerateCaptionsInput,
  signal?: AbortSignal,
): Promise<GenerateCaptionsResult> {
  const response = await fetch("/api/humor/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const result = await response
    .json()
    .catch(() => ({
      error: "The studio lost its train of thought. Try again.",
    }));
  if (!response.ok)
    throw new Error(result.error || "Could not generate captions. Try again.");
  return result;
}
