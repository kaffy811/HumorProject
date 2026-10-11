import { createStore } from "zustand/vanilla";
import type { PostSort } from "@/lib/post-contracts";
export function createFeedStore() {
  return createStore<{
    detailBack: string | null;
    detailReturn: { sort: PostSort; y: number; pages: number } | null;
    consumeDetailReturn: () => void;
    markDetailEntry: (
      url: string,
      y: number,
      pages: number,
      sort: PostSort,
    ) => void;
    positions: Record<PostSort, number>;
    pages: Record<PostSort, number>;
    remember: (sort: PostSort, y: number, pages: number) => void;
    reset: () => void;
  }>((set) => ({
    detailBack: null,
    detailReturn: null,
    consumeDetailReturn: () => set({ detailReturn: null }),
    markDetailEntry: (url, y, pages, sort) =>
      set({ detailBack: url, detailReturn: { sort, y, pages } }),
    positions: { hot: 0, new: 0, mine: 0, saved: 0 },
    pages: { hot: 1, new: 1, mine: 1, saved: 1 },
    remember: (sort, y, pages) =>
      set((s) => ({
        positions: { ...s.positions, [sort]: y },
        pages: { ...s.pages, [sort]: pages },
      })),
    reset: () =>
      set({
        positions: { hot: 0, new: 0, mine: 0, saved: 0 },
        pages: { hot: 1, new: 1, mine: 1, saved: 1 },
      }),
  }));
}
