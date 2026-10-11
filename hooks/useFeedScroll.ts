"use client";
import { useEffect, useRef } from "react";
import { useStores } from "@/stores/StoreProvider";
import type { PostSort } from "@/lib/post-contracts";
export function useFeedScroll(sort: PostSort, ready: boolean) {
  const { feed } = useStores();
  const restored = useRef(false);
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const top = feed.getState().positions[sort];
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() =>
        window.scrollTo({ top, behavior: "instant" }),
      );
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [feed, ready, sort]);
}
