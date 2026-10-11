import type { Comment, CommentPage, CommentSort } from "./comment-contracts";
import type { Post } from "./post-contracts";
import { PostError } from "./posts";
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, cache: "no-store" }),
    data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new PostError(
      data.error || "The comments stumbled. Try again.",
      r.status,
    );
  return data;
}
function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
export function getPost(id: string) {
  return request<Post>(`/api/posts/${encodeURIComponent(id)}`);
}
export function listComments({
  postId,
  sort,
  cursor,
  limit = 20,
}: {
  postId: string;
  sort: CommentSort;
  cursor?: string | null;
  limit?: number;
}) {
  const q = new URLSearchParams({ sort, limit: String(limit) });
  if (cursor) q.set("cursor", cursor);
  return request<CommentPage>(
    `/api/posts/${encodeURIComponent(postId)}/comments?${q}`,
  );
}
export function addComment({
  postId,
  body,
  replyToId,
  requestKey = crypto.randomUUID(),
}: {
  postId: string;
  body: string;
  replyToId?: string;
  requestKey?: string;
}) {
  return request<{ comment: Comment; commentCount: number }>(
    `/api/posts/${encodeURIComponent(postId)}/comments`,
    json({ body, replyToId, requestKey }),
  );
}
export function toggleCommentHa(id: string) {
  return request<{ haCount: number; viewerHasHa: boolean }>(
    `/api/comments/${encodeURIComponent(id)}/ha`,
    json({ requestKey: crypto.randomUUID() }),
  );
}
export function deleteComment(id: string) {
  return request<{ postId: string; commentCount: number }>(
    `/api/comments/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
export function reportComment(id: string, reason: string) {
  return request<{ ok: boolean }>(
    `/api/comments/${encodeURIComponent(id)}/report`,
    json({ reason }),
  );
}
