import "server-only";
import { mockList, mockGet } from "./mock-posts";
import {
  rankPosts,
  windowStart,
  type LeaderboardData,
  type RankingWindow,
} from "./leaderboard-contracts";
const state = globalThis as typeof globalThis & {
  humorMockRanks?: Map<string, LeaderboardData>;
};
state.humorMockRanks ||= new Map();
export function mockLeaderboard(
  owner: string,
  window: RankingWindow,
): LeaderboardData {
  const now = new Date(),
    start = windowStart(window, now),
    key = `${owner}:${window}:${start}`;
  let snap = state.humorMockRanks!.get(key);
  // Deletions invalidate immediately, even when the removed post was below the top 50.
  let cursor: string | null = null;
  const all = [];
  do {
    const page = mockList(owner, "new", cursor, 12);
    all.push(...page.posts);
    cursor = page.nextCursor;
  } while (cursor);
  const ranks = rankPosts(all, window, now);
  if (
    !snap ||
    Date.parse(snap.expiresAt) <= now.getTime() ||
    snap.posts.some((p) => !mockGet(owner, p.id))
  ) {
    const ownPost = ranks.posts.find((p) => p.author.id === owner),
      person = ranks.people.find((p) => p.user.id === owner);
    snap = {
      ...ranks,
      posts: ranks.posts.slice(0, 50),
      people: ranks.people.slice(0, 50),
      standing: {
        bestPostRank: ownPost?.rank ?? null,
        bestPostId: ownPost?.id ?? null,
        bestPostCaption: ownPost?.caption ?? null,
        peopleRank: person?.rank ?? null,
        haReceived: person?.haReceived ?? 0,
      },
      window,
      startsAt: start,
      computedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 300000).toISOString(),
      stale: false,
    };
    state.humorMockRanks!.set(key, snap);
  }
  return {
    ...snap,
    posts: snap.posts.flatMap((p) => {
      const live = mockGet(owner, p.id);
      return live ? [{ ...live, rank: p.rank }] : [];
    }),
    people: snap.people.map((p) => ({
      ...p,
      ...ranks.people.find((x) => x.user.id === p.user.id),
      rank: p.rank,
      haReceived:
        ranks.people.find((x) => x.user.id === p.user.id)?.haReceived || 0,
    })),
    standing: {
      ...snap.standing,
      haReceived:
        ranks.people.find((p) => p.user.id === owner)?.haReceived || 0,
    },
  };
}
