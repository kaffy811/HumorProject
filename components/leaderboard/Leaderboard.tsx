"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { rankingWindow, type RankingBoard } from "@/lib/leaderboard-contracts";
import { useMascot } from "@/stores/StoreProvider";
import { LeaderboardControls } from "./LeaderboardControls";
import { LeaderboardSkeleton } from "./LeaderboardSkeleton";
import { JokesPodium, PeoplePodium } from "./Podiums";
import { JokeRankRow, PeopleRankRow } from "./RankRows";
import { MyStandingBar } from "./MyStandingBar";
function Board() {
  const q = useSearchParams(),
    board: RankingBoard = q.get("board") === "people" ? "people" : "jokes",
    period = rankingWindow(q.get("window"));
  const { data, error, isValidating, mutate } = useLeaderboard(period),
    setMood = useMascot((s) => s.setMood),
    entered = useRef(false),
    checked = useRef(false),
    initialBoard = useRef(board);
  useEffect(() => {
    if (!entered.current) {
      entered.current = true;
      setMood("smug");
    }
  }, [setMood]);
  useEffect(() => {
    if (!data || checked.current) return;
    checked.current = true;
    if (
      initialBoard.current === "jokes"
        ? data.standing.bestPostRank
        : data.standing.peopleRank
    )
      setMood("omg");
  }, [data, setMood]);
  const entries = data ? (board === "jokes" ? data.posts : data.people) : [];
  return (
    <section className="leaderboard-page">
      <header className="feed-heading">
        <h1>The top.</h1>
        <p>Evidence that someone laughed. Possibly on purpose.</p>
      </header>
      <LeaderboardControls board={board} window={period} />
      <p className="rank-explanation">{board === "jokes" ? "RANKED BY HA" : "RANKED BY HA RECEIVED"} · {period === "week" ? "LAST 7 DAYS" : period === "month" ? "LAST 30 DAYS" : "ALL TIME"}</p>
      <div className="leaderboard-progress" role="status" aria-live="polite">
        {data && isValidating ? "Recounting the laughs…" : ""}
      </div>
      {error && (
        <div className="feed-status" role="alert">
          <p>{error.message || "The board lost count. Try again."}</p>
          <button className="comic-button" onClick={() => void mutate()}>
            Retry
          </button>
        </div>
      )}
      {!data && !error ? (
        <LeaderboardSkeleton />
      ) : data && entries.length ? (
        <>
          {board === "jokes" ? (
            <JokesPodium posts={data.posts.slice(0, 3)} />
          ) : (
            <PeoplePodium people={data.people.slice(0, 3)} />
          )}
          {entries.length > 3 && (
            <ol
              className="leaderboard-rows"
              start={4}
              aria-label={
                board === "jokes" ? "More top jokes" : "More top people"
              }
            >
              {board === "jokes"
                ? data.posts
                    .slice(3)
                    .map((post) => <JokeRankRow key={post.id} post={post} />)
                : data.people
                    .slice(3)
                    .map((person) => (
                      <PeopleRankRow key={person.user.id} person={person} />
                    ))}
            </ol>
          )}
        </>
      ) : (
        data && (
          <div className="feed-status">
            <p>
              Nobody&apos;s funny yet
              {period === "week"
                ? " this week"
                : period === "month"
                  ? " this month"
                  : ""}
              . Low bar.
            </p>
            <Link className="comic-button comic-button-primary" href="/create">
              Create
            </Link>
          </div>
        )
      )}
      {data && (
        <MyStandingBar
          key={`${board}:${data.window}:${data.computedAt}:${entries.length}`}
          board={board}
          standing={data.standing}
        />
      )}
    </section>
  );
}
export function Leaderboard() {
  return (
    <Suspense fallback={<LeaderboardSkeleton />}>
      <Board />
    </Suspense>
  );
}
