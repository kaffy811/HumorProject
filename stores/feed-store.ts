import { createStore } from "zustand/vanilla";
import type { PostSort } from "@/lib/post-contracts";
export function createFeedStore() {
  return createStore<{
    positions: Record<PostSort, number>;
    pages: Record<PostSort, number>;
    remember: (sort: PostSort, y: number, pages: number) => void;
    reset: () => void;
  }>((set) => ({
    positions: { hot: 0, new: 0 },
    pages: { hot: 1, new: 1 },
    remember: (sort, y, pages) =>
      set((s) => ({
        positions: { ...s.positions, [sort]: y },
        pages: { ...s.pages, [sort]: pages },
      })),
    reset: () =>
      set({ positions: { hot: 0, new: 0 }, pages: { hot: 1, new: 1 } }),
  }));
}
