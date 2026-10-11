export interface PublishInput {
  draftId: string;
  generationId: string;
  candidateId: string;
  content: string;
  idempotencyKey: string;
}
export async function publishPost(
  input: PublishInput,
  signal?: AbortSignal,
): Promise<{ postId: string; href: `/post/${string}` }> {
  const response = await fetch("/api/humor/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const result = await response
    .json()
    .catch(() => ({ error: "Could not publish. Your joke is still here." }));
  if (!response.ok)
    throw new Error(
      result.error || "Could not publish. Your joke is still here.",
    );
  return result;
}
