import type { LeaderboardData, RankingWindow } from "./leaderboard-contracts";
import { PostError } from "./posts";
export async function getLeaderboard({
  window,
}: {
  window: RankingWindow;
}): Promise<LeaderboardData> {
  const response = await fetch(`/api/leaderboard?window=${window}`, {
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new PostError(
      data.error || "The board lost count. Try again.",
      response.status,
    );
  return data;
}
// The shared hook fetches one bundle so both boards and the standing use one snapshot.
export async function listTopPosts(options: { window: RankingWindow }) {
  return (await getLeaderboard(options)).posts;
}
export async function listTopPeople(options: { window: RankingWindow }) {
  return (await getLeaderboard(options)).people;
}
export async function getMyStanding(options: { window: RankingWindow }) {
  return (await getLeaderboard(options)).standing;
}
