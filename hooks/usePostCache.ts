"use client";
import { patchProfileCounts, type CachedProfile } from "@/lib/profile-cache";
import {useContentCache} from "./useContentCache";
import {useRouter} from "next/navigation";
import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import { patchPostPages } from "@/lib/post-cache";
import {
  patchLeaderboard,
  type LeaderboardData,
} from "@/lib/leaderboard-contracts";
import type { Post, PostPage } from "@/lib/post-contracts";
export function usePostCache() {
  const { cache, mutate } = useSWRConfig(),
    viewer = useFeedViewer(), refresh=useContentCache(), router=useRouter();
  return useCallback(
    async (post: Post, change: Partial<Post> | null) => {
      await Promise.all(
        Array.from(cache.keys()).map(async (key) => {
          let parsed;
          try {
            parsed = JSON.parse(key.startsWith("$inf$") ? key.slice(5) : key);
          } catch {
            return;
          }
          if (!Array.isArray(parsed) || parsed[1] !== viewer) return;
          if (parsed[0] === "profile" && parsed[2] === post.author.id) {
            await mutate(
              key,
              (value: CachedProfile | undefined) =>
                value ? patchProfileCounts(value, post, change) : value,
              { revalidate: false },
            );
            if (change === null) void mutate(key);
          }
          if (parsed[0] === "leaderboard") {
            await mutate<LeaderboardData>(
              key,
              (value) =>
                value ? patchLeaderboard(value, post, change, viewer) : value,
              { revalidate: false },
            );
            if (change === null) void mutate(key);
          }
          if (parsed[0] === "post" && parsed[2] === post.id) {
            await mutate<Post | null>(
              key,
              (value: Post | null | undefined) =>
                value && change
                  ? { ...value, ...change }
                  : change === null
                    ? null
                    : value,
              { revalidate: false },
            );
          }
          if (
            parsed[0] === "posts" ||
            parsed[0] === "recommendations" ||
            parsed[0] === "profile-posts" || parsed[0] === "feed-page" || parsed[0] === "feed-session"
          )
            await mutate(
              key,
              (value: PostPage | PostPage[] | undefined) => {
                if (!value) return value;
                const result = patchPostPages(
                  Array.isArray(value) ? value : [value],
                  post,
                  change,
                  parsed[2] === "saved" ||
                    (parsed[0] === "profile-posts" && parsed[3] === "saved"),
                  parsed[3] === 0 ||
                    (parsed[0] === "profile-posts" && parsed[4] === 0),
                );
                return Array.isArray(value) ? result : result[0];
              },
              { revalidate: false },
            );
        }),
      );
      if(change===null){await refresh();router.refresh();}
    },
    [cache, mutate, viewer, refresh, router],
  );
}
