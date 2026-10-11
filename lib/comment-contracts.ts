import type { Post } from "./post-contracts";
export interface Comment {
  id: string;
  postId: string;
  body: string;
  author: Post["author"];
  createdAt: string;
  haCount: number;
  viewerHasHa: boolean;
  replyTo: { id: string; authorName: string } | null;
}
export type CommentSort = "top" | "new";
export interface CommentPage {
  comments: Comment[];
  nextCursor: string | null;
  commentCount: number;
}
export function validateComment(body: unknown) {
  return (
    typeof body === "string" &&
    body.trim().length > 0 &&
    Array.from(body).length <= 280 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body)
  );
}
export function orderComments(
  comments: Comment[],
  sort: CommentSort,
  highlighted: Set<string> = new Set(),
) {
  return [...comments].sort(
    (a, b) =>
      Number(highlighted.has(b.id)) - Number(highlighted.has(a.id)) ||
      (sort === "top" ? b.haCount - a.haCount : 0) ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      b.id.localeCompare(a.id),
  );
}
export function patchComments(
  pages: CommentPage[],
  id: string,
  change: Partial<Comment> | null,
) {
  return pages.map((p) => ({
    ...p,
    comments: p.comments.flatMap((c) =>
      c.id === id
        ? change
          ? [{ ...c, ...change }]
          : []
        : [
            {
              ...c,
              replyTo:
                c.replyTo?.id === id && !change
                  ? { ...c.replyTo, authorName: "deleted" }
                  : c.replyTo,
            },
          ],
    ),
  }));
}
