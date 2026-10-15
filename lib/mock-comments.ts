import "server-only";
import { randomUUID } from "node:crypto";
import { mockGet, mockCommentCount } from "./mock-posts";
import {
  orderComments,
  type Comment,
  type CommentSort,
  type CommentPage,
} from "./comment-contracts";
import { StudioError } from "./studio-server";
type Session = {
  comments: Comment[];
  deleted: Set<string>;
  times: number[];
  requests: Map<
    string,
    { comment: Comment; body: string; reply: string | undefined }
  >;
  haRequests: Map<
    string,
    { id: string; haCount: number; viewerHasHa: boolean }
  >;
  reports: Set<string>;
};
const state = globalThis as typeof globalThis & {
  humorMockComments?: Map<string, Session>;
  humorMockCommentSnapshots?: Map<
    string,
    { user: string; postId: string; sort: CommentSort; ids: string[] }
  >;
};
state.humorMockComments ||= new Map();
state.humorMockCommentSnapshots ||= new Map();
function session(user: string, postId?: string) {
  let s = state.humorMockComments!.get(user);
  if (!s) {
    s = {
      comments: [],
      deleted: new Set(),
      times: [],
      requests: new Map(),
      haRequests: new Map(),
      reports: new Set(),
    };
    state.humorMockComments!.set(user, s);
  }
  if (postId) {
    const p = mockGet(user, postId);
    if (!p) throw new StudioError("Post not found.", 404);
    if (!s.comments.some((c) => c.postId === postId) && p.commentCount) {
      for (let i = 0; i < p.commentCount; i++)
        s.comments.push({
          id: `${postId}-comment-${i}`,
          postId,
          body:
            i === 0
              ? "This photo has a better social life than I do."
              : "I had a reply. It asked for an extension.",
          author:
            i === 1
              ? { ...p.author }
              : { id: "mock-reader", name: "@sam", avatarUrl: null },
          createdAt: new Date(Date.now() - i * 60000).toISOString(),
          haCount: i % 3,
          viewerHasHa: false,
          replyTo: null,
        });
    }
  }
  return s;
}
function visible(s: Session, id: string) {
  return s.comments.filter((c) => c.postId === id && !s.deleted.has(c.id));
}
export function mockCommentsList(
  user: string,
  postId: string,
  sort: CommentSort,
  cursor: string | null,
  limit: number,
): CommentPage {
  const s = session(user, postId);
  let key = "",
    offset = 0;
  if (cursor) {
    [key] = cursor.split(":");
    offset = Number(cursor.split(":")[1]);
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new StudioError("Invalid pagination.");
  } else {
    key = randomUUID();
    state.humorMockCommentSnapshots!.set(key, {
      user,
      postId,
      sort,
      ids: orderComments(visible(s, postId), sort).map((c) => c.id),
    });
  }
  const snap = state.humorMockCommentSnapshots!.get(key);
  if (
    !snap ||
    snap.user !== user ||
    snap.postId !== postId ||
    snap.sort !== sort
  )
    throw new StudioError("Invalid pagination.");
  const comments = snap.ids.slice(offset, offset + limit).flatMap((id) => {
    const c = s.comments.find((c) => c.id === id && !s.deleted.has(id));
    return c
      ? [
          {
            ...c,
            replyTo:
              c.replyTo && s.deleted.has(c.replyTo.id)
                ? { ...c.replyTo, authorName: "deleted" }
                : c.replyTo,
          },
        ]
      : [];
  });
  return {
    comments,
    nextCursor:
      offset + limit < snap.ids.length ? `${key}:${offset + limit}` : null,
    commentCount: visible(s, postId).length,
  };
}
export function mockCommentAdd(
  user: string,
  postId: string,
  body: string,
  replyId: string | undefined,
  key: string,
) {
  const s = session(user, postId),
    prev = s.requests.get(key);
  if (prev) {
    if (
      prev.comment.postId !== postId ||
      prev.body !== body ||
      prev.reply !== replyId
    )
      throw new StudioError("Invalid request.");
    return { comment: prev.comment, commentCount: visible(s, postId).length };
  }
  const now = Date.now();
  s.times = s.times.filter((t) => now - t < 10000);
  if (s.times.length >= 3) throw new StudioError("Comment rate limit", 429);
  const target = replyId
    ? s.comments.find(
        (c) => c.id === replyId && c.postId === postId && !s.deleted.has(c.id),
      )
    : null;
  if (replyId && !target) throw new StudioError("Reply no longer available.");
  const c: Comment = {
    id: randomUUID(),
    postId,
    body: body.trim(),
    author: { id: user, name: "@you", avatarUrl: null },
    createdAt: new Date(now).toISOString(),
    haCount: 0,
    viewerHasHa: false,
    replyTo: target ? { id: target.id, authorName: target.author.name,authorId:target.author.id } : null,
  };
  s.comments.push(c);
  s.times.push(now);
  s.requests.set(key, { comment: c, body, reply: replyId });
  mockCommentCount(user, postId, visible(s, postId).length);
  return { comment: c, commentCount: visible(s, postId).length };
}
export function mockCommentAction(
  user: string,
  id: string,
  kind: "ha" | "delete" | "report",
  key?: string,
) {
  const s = session(user),
    c = s.comments.find((c) => c.id === id);
  if (!c || !mockGet(user, c.postId) || s.deleted.has(id))
    throw new StudioError("Comment not found.", 404);
  if (kind === "ha") {
    const previous = key ? s.haRequests.get(key) : undefined;
    if (previous) {
      if (previous.id !== id) throw new StudioError("Invalid request.");
      return { haCount: previous.haCount, viewerHasHa: previous.viewerHasHa };
    }
    c.viewerHasHa = !c.viewerHasHa;
    c.haCount += c.viewerHasHa ? 1 : -1;
    const result = { haCount: c.haCount, viewerHasHa: c.viewerHasHa };
    if (key) s.haRequests.set(key, { id, ...result });
    return result;
  }
  if (kind === "delete") {
    if (c.author.id !== user)
      throw new StudioError("Only the author can delete this comment.", 403);
    s.deleted.add(id);
    c.body = "[deleted]";
    const count = visible(s, c.postId).length;
    mockCommentCount(user, c.postId, count);
    return { postId: c.postId, commentCount: count };
  }
  if (c.author.id === user)
    throw new StudioError("You can delete your own comment.");
  s.reports.add(id);
  return { ok: true };
}

export function mockCommentCleanup(user: string, postId: string) {
  const s = state.humorMockComments?.get(user);
  if (!s) return;
  const ids = new Set(
    s.comments.filter((c) => c.postId === postId).map((c) => c.id),
  );
  s.comments = s.comments.filter((c) => c.postId !== postId);
  ids.forEach((id) => {
    s.deleted.delete(id);
    s.reports.delete(id);
  });
  for (const [key, value] of s.requests)
    if (value.comment.postId === postId) s.requests.delete(key);
  for (const [key, value] of s.haRequests)
    if (ids.has(value.id)) s.haRequests.delete(key);
  for (const [key, value] of state.humorMockCommentSnapshots!)
    if (value.user === user && value.postId === postId)
      state.humorMockCommentSnapshots!.delete(key);
}
