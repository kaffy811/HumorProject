"use client";
import { useSearchParams } from "next/navigation";
import type { RankingBoard, RankingWindow } from "@/lib/leaderboard-contracts";
export function LeaderboardControls({
  board,
  window: period,
}: {
  board: RankingBoard;
  window: RankingWindow;
}) {
  const params = useSearchParams();
  function choose(name: "board" | "window", value: string) {
    const q = new URLSearchParams(params.toString());
    q.set(name, value);
    // Next's native History integration updates search params without a navigation/fetch.
    window.history.replaceState(null, "", `/top?${q}`);
  }
  return (
    <div className="leaderboard-controls">
      <div className="leaderboard-tabs" aria-label="Leaderboard type">
        {(["jokes", "people"] as const).map((value) => (
          <button
            key={value}
            className={`style-option ${board === value ? "is-selected" : ""}`}
            aria-pressed={board === value}
            onClick={() => choose("board", value)}
          >
            {value === "jokes" ? "Jokes" : "People"}
          </button>
        ))}
      </div>
      <div className="leaderboard-window">
        <div className="leaderboard-tabs" aria-label="Ranking window">
          {(["week", "month", "all"] as const).map((value) => (
            <button
              key={value}
              className={`style-option ${period === value ? "is-selected" : ""}`}
              aria-pressed={period === value}
              onClick={() => choose("window", value)}
            >
              {value === "week"
                ? "This week"
                : value === "month"
                  ? "This month"
                  : "All time"}
            </button>
          ))}
        </div>
        {period === "week" && (
          <span className="comic-label leaderboard-reset">RESETS MONDAY</span>
        )}
      </div>
    </div>
  );
}
