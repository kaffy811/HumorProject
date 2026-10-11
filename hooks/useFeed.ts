"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { useSWRConfig } from "swr";
import { listPosts, checkPosts, PostError } from "@/lib/posts";
import { usePostCache } from "./usePostCache";
import type { PostPage, PostSort } from "@/lib/post-contracts";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import { useStores } from "@/stores/StoreProvider";
export function useFeed(sort: PostSort) {
  const viewer = useFeedViewer(),
    { feed } = useStores(),
    { mutate: allMutate } = useSWRConfig();
  const [initial] = useState(() => {
    const state = feed.getState();
    return state.detailReturn?.sort === sort
      ? state.detailReturn.pages
      : state.pages[sort];
  });
  const [newCount, setNewCount] = useState(0),
    [checkingError, setCheckingError] = useState("");
  const swr = useSWRInfinite<PostPage>(
    (index, prev) =>
      prev && !prev.nextCursor
        ? null
        : JSON.stringify([
            "posts",
            viewer,
            sort,
            index,
            prev?.nextCursor || null,
          ]),
    async (key: string) => {
      const [, , ordering, , cursor] = JSON.parse(key);
      return listPosts({ sort: ordering, cursor, limit: 12 });
    },
    { initialSize: initial, revalidateFirstPage: false },
  );
  const pages = swr.data || [],
    posts = pages
      .flatMap((p) => p.posts)
      .filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i),
    last = pages.at(-1),
    cutoff = pages[0]?.cutoff;
  useEffect(() => {
    const onScroll = () =>
      feed.getState().remember(sort, window.scrollY, swr.size);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      onScroll();
    };
  }, [feed, sort, swr.size]);
  useEffect(() => {
    if (!cutoff || (sort !== "hot" && sort !== "new")) return;
    let alive = true;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { count } = await checkPosts(cutoff);
        if (alive) {
          setNewCount(count);
          setCheckingError("");
        }
      } catch {
        if (alive)
          setCheckingError("New-post check missed a beat. It will try again.");
      }
    }, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [cutoff, sort]);
  const patch = usePostCache();
  const { isValidating, size, error, setSize } = swr;
  const loadMore = useCallback(() => {
    if (!isValidating && size <= pages.length && last?.nextCursor && !error)
      void setSize(size + 1);
  }, [isValidating, size, error, setSize, last?.nextCursor, pages.length]);
  const refreshing = useRef(false);
  async function refresh() {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const page = await listPosts({ sort, limit: 12 });
      await allMutate(JSON.stringify(["posts", viewer, sort, 0, null]), page, {
        revalidate: false,
      });
      await swr.setSize(1);
      await swr.mutate([page], { revalidate: false });
      setNewCount(0);
      feed.getState().remember(sort, 0, 1);
      window.scrollTo({ top: 0, behavior: "instant" });
    } finally {
      refreshing.current = false;
    }
  }
  return {
    posts,
    pages,
    size: swr.size,
    error: swr.error as PostError | undefined,
    loading: !swr.data && !swr.error,
    loadingMore: swr.isValidating || (swr.size > pages.length && !swr.error),
    ended: !!last && !last.nextCursor,
    newCount,
    checkingError,
    patch,
    refresh,
    loadMore,
    retry: () => (swr.error?.status === 410 ? refresh() : swr.mutate()),
  };
}
