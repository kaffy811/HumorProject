"use client";
import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import { listPosts } from "@/lib/posts";
import { getProfile, listProfilePosts } from "@/lib/profiles";
import { getLeaderboard } from "@/lib/leaderboard";
import { getPost } from "@/lib/comments";
import type { Post, PostPage } from "@/lib/post-contracts";
const RELATED = new Set([
  "posts",
  "feed-page",
  "feed-session",
  "profile",
  "profile-posts",
  "leaderboard",
  "recommendations",
  "post",
  "profile-page",
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
  const count =
    (page.totalCount ?? page.posts.length) +
    (page.posts.some((p) => p.id === post.id) ? 0 : 1);
  return {
    ...page,
    posts: [post, ...page.posts.filter((p) => p.id !== post.id)]
      .sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          b.id.localeCompare(a.id),
      )
      .slice(0, 9),
    totalCount: count,
    totalPages: Math.max(1, Math.ceil(count / 9)),
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
      if (post)
        await mutate(JSON.stringify(["post", viewer, post.id]), post, {
          revalidate: false,
        });
      if (post)
        await Promise.all(
          keys
            .filter((k) => {
              const p = contentKey(k)!;
              return (
                p[2] === "new" &&
                (p[0] === "feed-session" ||
                  (p[0] === "feed-page" && p[3] === 1))
              );
            })
            .map((k) =>
              mutate(
                k,
                (old: PostPage | undefined) =>
                  old ? insertNewest(old, post) : old,
                { revalidate: false },
              ),
            ),
        );
      const sessions = new Map<string, PostPage>();
      await Promise.allSettled(
        ["hot", "new"]
          .filter((sort) =>
            keys.some((k) => {
              const p = contentKey(k)!;
              return (
                p[2] === sort && ["feed-page", "feed-session"].includes(p[0])
              );
            }),
          )
          .map(async (sort) => {
            const fresh = await listPosts({
              sort: sort as "hot" | "new",
              page: 1,
              limit: 9,
            });
            sessions.set(sort, fresh);
            await mutate(
              JSON.stringify(["feed-session", viewer, sort]),
              fresh,
              { revalidate: false },
            );
          }),
      );
      const visited = new Set<string>();
      await Promise.allSettled(
        keys.map(async (key) => {
          const p = contentKey(key)!;
          if (p[0] === "feed-session") return;
          if (p[0] === "feed-page") {
            const id = `${p[2]}:${p[3]}`;
            if (visited.has(id)) return;
            visited.add(id);
            const s = sessions.get(p[2]);
            if (!s) {
              await mutate(key, undefined, { revalidate: false });
              return;
            }
            const fresh =
              p[3] === 1
                ? s
                : await listPosts({
                    sort: p[2],
                    page: p[3],
                    snapshot: s.snapshotId,
                    limit: 9,
                  });
            await mutate(
              JSON.stringify([
                "feed-page",
                viewer,
                p[2],
                p[3],
                s.snapshotId || s.cutoff,
              ]),
              fresh,
              { revalidate: false },
            );
            if (
              key !==
              JSON.stringify([
                "feed-page",
                viewer,
                p[2],
                p[3],
                s.snapshotId || s.cutoff,
              ])
            )
              await mutate(key, undefined, { revalidate: false });
            return;
          }
          if (p[0] === "profile") {
            await mutate(key, await getProfile(p[2]), { revalidate: false });
            return;
          }
          if (p[0] === "leaderboard") {
            await mutate(key, await getLeaderboard({ window: p[2] }), {
              revalidate: false,
            });
            return;
          }
          if (p[0] === "profile-posts") {
            if (p[4] !== 0) {
              await mutate(key, undefined, { revalidate: false });
              return;
            }
            const fresh =
              p[3] === "saved"
                ? await listPosts({ sort: "saved" })
                : await listProfilePosts(p[2]);
            await mutate(key, key.startsWith("$inf$") ? [fresh] : fresh, {
              revalidate: false,
            });
            return;
          }
          if (p[0] === "post") {
            await mutate(key, await getPost(p[2]).catch(() => null), {
              revalidate: false,
            });
            return;
          }
          if (p[0] === "recommendations") {
            const fresh = await listPosts({ sort: "hot" });
            await mutate(
              key,
              {
                ...fresh,
                posts: fresh.posts.filter((x) => x.id !== p[2]).slice(0, 3),
                nextCursor: null,
              },
              { revalidate: false },
            );
            return;
          }
          await mutate(key, undefined, { revalidate: true });
        }),
      );
    },
    [cache, mutate, viewer],
  );
}
