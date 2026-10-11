"use client";
import { useEffect, useRef, useState } from "react";
import { useStores } from "@/stores/StoreProvider";
import type { PostSort } from "@/lib/post-contracts";
export function useFeedScroll(sort: PostSort, ready: boolean) {
  const { feed } = useStores();
  const restored = useRef(false);
  const [top] = useState(() => {
    const state = feed.getState();
    return state.detailReturn?.sort === sort
      ? state.detailReturn.y
      : state.positions[sort];
  });
  useEffect(() => {
    if (!ready || restored.current) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        window.scrollTo({ top, behavior: "instant" });
        restored.current = true;
        feed
          .getState()
          .remember(
            sort,
            top,
            feed.getState().detailReturn?.pages || feed.getState().pages[sort],
          );
        if (feed.getState().detailReturn?.sort === sort)
          feed.getState().consumeDetailReturn();
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [feed, ready, sort, top]);
}
