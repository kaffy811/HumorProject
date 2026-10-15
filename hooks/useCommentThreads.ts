"use client";
import useSWR from "swr";
import { commentAncestors, commentThreads } from "@/lib/comment-threads";
import type { Comment, CommentSort } from "@/lib/comment-contracts";
import { profileRequest } from "@/lib/profiles";
import { PostError } from "@/lib/posts";
export function useCommentThreads(rows: Comment[], viewer: string, post: string, sort: CommentSort, highlighted: Set<string>) {
  const present = new Set(rows.map(c => c.id));
  const missing = [...new Set(rows.filter(c => c.replyTo && c.replyTo.authorName !== "deleted" && !present.has(c.replyTo.id)).map(c => c.replyTo!.id))].sort();
  const parents = useSWR<Comment[]>(missing.length ? JSON.stringify(["comment-ancestors", viewer, post, missing]) : null, () => commentAncestors(rows, post, async (id) => {
    try {
      return await profileRequest<Comment>(`/api/comments/${id}?postId=${post}`);
    }
    catch (e) {
      if (e instanceof PostError && e.status === 404)
        return null;
      throw e;
    }
  }), { revalidateOnFocus: false });
  const active = new Set([...highlighted, ...rows.filter(c => c.id.startsWith("pending-")).map(c => c.id)]);
  return { threads: commentThreads([...(parents.data || []), ...rows], sort, active), parentsLoading: !!missing.length && !parents.data && !parents.error, parentError: parents.error, retryParents: () => parents.mutate() };
}
