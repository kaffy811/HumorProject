"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MyStanding, RankingBoard } from "@/lib/leaderboard-contracts";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
export function MyStandingBar({
  board,
  standing,
}: {
  board: RankingBoard;
  standing: MyStanding;
}) {
  const viewer = useFeedViewer(),
    [visibleEntry, setVisibleEntry] = useState(false);
  const target = board === "jokes" ? standing.bestPostId : viewer;
  const rank = board === "jokes" ? standing.bestPostRank : standing.peopleRank;
  useEffect(() => {
    const attr =
      board === "jokes" ? "data-standing-post" : "data-standing-user";
    const node = Array.from(document.querySelectorAll(`[${attr}]`)).find(
      (n) => n.getAttribute(attr) === target,
    );
    if (!node || !rank) return;
    const observer = new IntersectionObserver(
      (entries) => setVisibleEntry(entries[0].isIntersecting),
      { rootMargin: "-120px 0px -140px 0px", threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [board, target, rank]);
  return (
    <aside
      className="my-standing"
      aria-label="Your ranking"
      hidden={visibleEntry}
    >
      <div className="my-standing-inner">
        {rank ? (
          board === "jokes" ? (
            <>
              <strong>Your best: #{rank}</strong>
              <span className="standing-caption">
                {standing.bestPostCaption}
              </span>
              <Link
                className="comic-button"
                href={`/post/${standing.bestPostId}`}
              >
                View
              </Link>
            </>
          ) : (
            <strong>
              You&apos;re #{rank} with {standing.haReceived} likes.
            </strong>
          )
        ) : (
          <>
            <strong>You&apos;re not on the board. Yet.</strong>
            <Link className="comic-button comic-button-primary" href="/create">
              Make something
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
