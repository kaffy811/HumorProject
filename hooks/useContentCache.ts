"use client";
import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import type { Post, PostPage } from "@/lib/post-contracts";
const RELATED = new Set([
  "posts",
  "feed-page",
  "profile",
  "profile-posts",
  "leaderboard",
  "recommendations",
  "post",
  "profile-page",
  "feed-session",
]);
export function contentKey(value: string) {
  try {
    const p = JSON.parse(value.startsWith("$inf$") ? value.slice(5) : value);
    return Array.isArray(p) ? p : null;
  } catch {
    return null;
  }
}
export function insertNewest(page: PostPage, post: Post): PostPage {
  const posts = [post, ...page.posts.filter((p) => p.id !== post.id)]
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        b.id.localeCompare(a.id),
    )
    .slice(0, 9);
  return {
    ...page,
    posts,
    totalCount:
      (page.totalCount ?? page.posts.length) +
      (page.posts.some((p) => p.id === post.id) ? 0 : 1),
  };
}
export function useContentCache() {
  const { cache, mutate } = useSWRConfig(),
    viewer = useFeedViewer();
  return useCallback(
    async (post?: Post) => {
      const keys = Array.from(cache.keys()).filter((key) => {
        const p = contentKey(key);
        return p?.[1] === viewer && RELATED.has(p[0]);
      });
      if (post) {
        for (const key of keys) {
          const p = contentKey(key);
          if (p?.[0] === "feed-page" && p[2] === "new" && p[3] === 1)
            await mutate(
              key,
              (old: PostPage | undefined) =>
                old ? insertNewest(old, post) : old,
              { revalidate: false },
            );
        }
      }
      await Promise.allSettled(keys.map((key) => mutate(key)));
    },
    [cache, mutate, viewer],
  );
}
