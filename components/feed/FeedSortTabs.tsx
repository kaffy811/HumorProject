"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useStores } from "@/stores/StoreProvider";
import type { PostSort } from "@/lib/post-contracts";
export function FeedSortTabs({ sort }: { sort: PostSort }) {
  const router = useRouter(),
    q = useSearchParams(),
    { feed } = useStores();
  return (
    <div className="feed-sort" aria-label="Sort posts">
      {(["hot", "new"] as const).map((value) => (
        <button
          key={value}
          className={`style-option ${sort === value ? "is-selected" : ""}`}
          aria-pressed={sort === value}
          onClick={() => {
            if (value === sort) return;
            feed.getState().remember(value, 0, feed.getState().pages[value]);
            const next = new URLSearchParams(q.toString());
            next.set("sort", value);
            router.replace(`/feed?${next}`, { scroll: false });
          }}
        >
          {value === "hot" ? "Hot" : "New"}
        </button>
      ))}
    </div>
  );
}
