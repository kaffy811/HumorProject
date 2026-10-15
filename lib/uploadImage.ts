import { createClient } from "@/lib/supabase/client";
import { imageError } from "@/lib/create-contracts";
async function json(response: Response) {
  const result = await response
    .json()
    .catch(() => ({ error: "Upload interrupted. Try again." }));
  if (!response.ok)
    throw new Error(result.error || "Upload interrupted. Try again.");
  return result;
}
export async function uploadImage(
  file: File,
  signal: AbortSignal,
): Promise<{ draftId: string; uploadId: string }> {
  const error = imageError(file);
  if (error) throw new Error(error);
  const prepared = await json(
    await fetch("/api/humor/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mimeType: file.type,
        bytes: file.size,
        filename: file.name,
      }),
      signal,
    }),
  );
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const { error: uploadError } = await createClient()
    .storage.from(prepared.bucket)
    .uploadToSignedUrl(prepared.path, prepared.token, file, {
      contentType: file.type,
    });
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (uploadError)
    throw new Error("The image did not make it. Try uploading again.");
  return json(
    await fetch(`/api/humor/uploads/${prepared.uploadId}/complete`, {
      method: "POST",
      signal,
    }),
  );
}
