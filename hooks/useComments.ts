"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { useSWRConfig } from "swr";
import {
  useFeedViewer,
  useViewerAuthor,
} from "@/components/feed/FeedCacheProvider";
import { addComment, deleteComment, listComments } from "@/lib/comments";
import {
  orderComments,
  patchComments,
  type Comment,
  type CommentPage,
  type CommentSort,
} from "@/lib/comment-contracts";
import type { Post } from "@/lib/post-contracts";
import { usePostCache } from "./usePostCache";
import { useMascot } from "@/stores/StoreProvider";
export function useComments(post: Post, sort: CommentSort) {
  const viewer = useFeedViewer(),
    author = useViewerAuthor(),
    { cache, mutate } = useSWRConfig(),
    patchPost = usePostCache(),
    setMood = useMascot((s) => s.setMood);
  const [pending, setPending] = useState<Comment[]>([]),
    [recent, setRecent] = useState<Comment[]>([]),
    [highlighted, setHighlighted] = useState<Set<string>>(() => new Set()),
    [announcement, setAnnouncement] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    failed = useRef<{ body: string; reply?: string; key: string } | null>(null),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    times = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const swr = useSWRInfinite<CommentPage>(
    (index, previous) =>
      previous && !previous.nextCursor
        ? null
        : JSON.stringify([
            "comments",
            viewer,
            post.id,
            sort,
            index,
            previous?.nextCursor || null,
          ]),
    async (key: string) => {
      const [, , postId, ordering, , cursor] = JSON.parse(key);
      return listComments({ postId, sort: ordering, cursor, limit: 20 });
    },
    { revalidateFirstPage: false },
  );
  const pages = swr.data || [],
    base = pages.flatMap((p) => p.comments),
    comments = orderComments(
      [...pending, ...recent, ...base].filter(
        (c, i, all) => all.findIndex((x) => x.id === c.id) === i,
      ),
      sort,
      new Set([...highlighted, ...pending.map((c) => c.id)]),
    );
  const patch = useCallback(
    async (id: string, change: Partial<Comment> | null) => {
      const patchRows = (rows: Comment[]) => patchComments(
        [{ comments: rows, nextCursor: null, commentCount: rows.length }], id, change,
      )[0].comments;
      setRecent(patchRows);
      await Promise.all(
        Array.from(cache.keys()).map(async (key) => {
          let parsed;
          try {
            parsed = JSON.parse(key.startsWith("$inf$") ? key.slice(5) : key);
          } catch {
            return;
          }
          if (parsed?.[1] === viewer && parsed[2] === post.id) {
            if (parsed[0] === "comment-ancestors") {
              await mutate(key, (rows: Comment[] | undefined) => rows && patchRows(rows), {revalidate:false});
              return;
            }
            if (parsed[0] === "comment-target") {
              await mutate(key, (row: Comment | null | undefined) => row ? patchRows([row])[0] || null : row, {revalidate:false});
              return;
            }
          }
          if (
            parsed?.[0] !== "comments" ||
            parsed[1] !== viewer ||
            parsed[2] !== post.id
          )
            return;
          await mutate(
            key,
            (value: CommentPage | CommentPage[] | undefined) => {
              if (!value) return value;
              const result = patchComments(
                Array.isArray(value) ? value : [value],
                id,
                change,
              );
              return Array.isArray(value) ? result : result[0];
            },
            { revalidate: false },
          );
        }),
      );
    },
    [cache, mutate, viewer, post.id],
  );
  const insert = useCallback(
    async (comment: Comment) => {
      await Promise.all(
        Array.from(cache.keys()).map(async (key) => {
          let parsed;
          try {
            parsed = JSON.parse(key.startsWith("$inf$") ? key.slice(5) : key);
          } catch {
            return;
          }
          if (
            parsed?.[0] !== "comments" ||
            parsed[1] !== viewer ||
            parsed[2] !== post.id ||
            parsed[4] !== 0
          )
            return;
          await mutate(
            key,
            (value: CommentPage | CommentPage[] | undefined) => {
              if (!value) return value;
              const result = (Array.isArray(value) ? value : [value]).map(
                (p, i) =>
                  i === 0
                    ? {
                        ...p,
                        comments: [
                          comment,
                          ...p.comments.filter((c) => c.id !== comment.id),
                        ],
                      }
                    : p,
              );
              return Array.isArray(value) ? result : result[0];
            },
            { revalidate: false },
          );
        }),
      );
    },
    [cache, mutate, viewer, post.id],
  );
  useEffect(() => {
    if (!swr.data?.length) return;
    for (const comment of recent) {
      if (
        !swr.data.some((page) =>
          page.comments.some((row) => row.id === comment.id),
        )
      )
        void insert(comment);
    }
  }, [swr.data, recent, insert]);
  function highlight(id: string) {
    setHighlighted((s) => new Set(s).add(id));
    timers.current.push(
      setTimeout(
        () =>
          setHighlighted((s) => {
            const next = new Set(s);
            next.delete(id);
            return next;
          }),
        2000,
      ),
    );
  }
  async function send(
    body: string,
    reply?: { id: string; authorName: string },
  ) {
    if (lock.current) throw new Error("One thought at a time.");
    const now = Date.now();
    times.current = times.current.filter((t) => now - t < 10000);
    if (times.current.length >= 3)
      throw new Error(
        "Three thoughts in ten seconds. Give the fourth a moment.",
      );
    lock.current = true;
    setBusy(true);
    const key =
      failed.current?.body === body && failed.current?.reply === reply?.id
        ? failed.current.key
        : crypto.randomUUID();
    const temp: Comment = {
      id: `pending-${key}`,
      postId: post.id,
      body: body.trim(),
      author: { id: viewer, name: author.name, avatarUrl: author.avatarUrl },
      createdAt: new Date().toISOString(),
      haCount: 0,
      viewerHasHa: false,
      replyTo: reply || null,
    };
    setPending((s) => [temp, ...s]);
    highlight(temp.id);
    setAnnouncement(
      `Your comment was added. ${post.commentCount + 1} comment${post.commentCount === 0 ? "" : "s"}.`,
    );
    await patchPost(post, { commentCount: post.commentCount + 1 });
    try {
      const result = await addComment({
        postId: post.id,
        body,
        replyToId: reply?.id,
        requestKey: key,
      });
      if (!result.comment)
        throw new Error("That comment is no longer available.");
      setRecent((rows) => [
        result.comment,
        ...rows.filter((c) => c.id !== result.comment.id),
      ]);
      await insert(result.comment);
      await patchPost(post, { commentCount: result.commentCount });
      setPending((s) => s.filter((c) => c.id !== temp.id));
      highlight(result.comment.id);
      times.current.push(Date.now());
      failed.current = null;
      setMood("wink");
    } catch (e) {
      setPending((s) => s.filter((c) => c.id !== temp.id));
      await patchPost(post, { commentCount: post.commentCount });
      setAnnouncement(
        "Comment could not be sent. Your words have been restored.",
      );
      failed.current = { body, reply: reply?.id, key };
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function remove(comment: Comment) {
    if (lock.current) throw new Error("Finish that thought first.");
    lock.current = true;
    setBusy(true);
    try {
      const result = await deleteComment(comment.id);
      await patch(comment.id, null);
      await patchPost(post, { commentCount: result.commentCount });
      setAnnouncement("Comment deleted. Replies were kept.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    comments,
    busy,
    highlighted,
    announcement,
    send,
    remove,
    patch,
    loading: !swr.data && !swr.error,
    error: swr.error,
    loadingMore: swr.isValidating && !!swr.data,
    nextCursor: pages.at(-1)?.nextCursor,
    loadMore: () => swr.setSize(swr.size + 1),
    retry: async () => {
      const fresh = await listComments({ postId: post.id, sort, limit: 20 });
      await mutate(
        JSON.stringify(["comments", viewer, post.id, sort, 0, null]),
        fresh,
        { revalidate: false },
      );
      await swr.setSize(1);
      await swr.mutate([fresh], { revalidate: false });
    },
  };
}
