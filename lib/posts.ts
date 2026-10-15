import type { PostPage, PostSort } from "./post-contracts";
export class PostError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function read<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new PostError(
      body.error || "The feed stumbled. Try again.",
      r.status,
    );
  return body;
}
export function listPosts({
  sort,
  cursor,
  limit = 12, page, snapshot,
}: {
  sort: PostSort;
  cursor?: string | null;
  limit?: number; page?:number; snapshot?:string|null;
}) {
  const q = new URLSearchParams({ sort, limit: String(limit) });
  if(page)q.set("page",String(page)); if(snapshot)q.set("snapshot",snapshot);
  if (cursor) q.set("cursor", cursor);
  return read<PostPage>(`/api/posts?${q}`);
}
export function toggleHa(postId: string) {
  return read<{ haCount: number; viewerHasHa: boolean }>(
    `/api/posts/${postId}/ha`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestKey: crypto.randomUUID() }),
    },
  );
}
export function deletePost(postId: string) {
  return read<{ ok: boolean }>(`/api/posts/${postId}`, { method: "DELETE" });
}
export function reportPost(postId: string, reason: string) {
  return read<{ ok: boolean }>(`/api/posts/${postId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}
export function checkPosts(since: string) {
  return read<{ count: number }>(
    `/api/posts/check?${new URLSearchParams({ since })}`,
  );
}

export function toggleSave(postId: string) {
  return read<{ viewerHasSaved: boolean; showSavedHint?:boolean }>(`/api/posts/${postId}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestKey: crypto.randomUUID() }),
  });
}
