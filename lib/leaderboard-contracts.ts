import type { Post } from "./post-contracts";
export type RankingWindow = "week" | "month" | "all";
export type RankingBoard = "jokes" | "people";
export type RankedPost = Post & { rank: number };
export interface RankedPerson {
  rank: number;
  user: Post["author"];
  haReceived: number;
  postCount: number;
  bestPost: { id: string; caption: string };
}
export interface MyStanding {
  bestPostRank: number | null;
  bestPostId: string | null;
  bestPostCaption: string | null;
  peopleRank: number | null;
  haReceived: number;
}
export interface LeaderboardData {
  posts: RankedPost[];
  people: RankedPerson[];
  standing: MyStanding;
  window: RankingWindow;
  startsAt: string | null;
  computedAt: string;
  expiresAt: string;
  stale: boolean;
  postCounts?: Record<string, number>;
}
export function rankingWindow(value: string | null): RankingWindow {
  return value === "month" || value === "all" ? value : "week";
}
// Convert local calendar midnight to UTC using the offset at that midnight,
// not today's offset (a week can cross the DST change).
export function windowStart(
  window: RankingWindow,
  now = new Date(),
): string | null {
  if (window === "all") return null;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const day = new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      window === "month" ? 1 : Number(parts.day),
    ),
  );
  if (window === "week")
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  let instant = day.getTime();
  for (let i = 0; i < 3; i++) {
    const clock = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "longOffset",
    })
      .formatToParts(new Date(instant))
      .find((p) => p.type === "timeZoneName")!.value;
    const match = /GMT([+-])(\d{2}):(\d{2})/.exec(clock)!;
    const offset =
      (Number(match[2]) * 60 + Number(match[3])) *
      60000 *
      (match[1] === "+" ? 1 : -1);
    instant = day.getTime() - offset;
  }
  return new Date(instant).toISOString();
}
export function rankPosts(
  posts: Post[],
  window: RankingWindow,
  now = new Date(),
) {
  const start = windowStart(window, now);
  const eligible = posts.filter(
    (p) =>
      (!start || Date.parse(p.createdAt) >= Date.parse(start)) &&
      Date.parse(p.createdAt) <= now.getTime(),
  );
  const compare = (a: Post, b: Post) =>
    b.haCount - a.haCount ||
    Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
    a.id.localeCompare(b.id);
  const ranked = eligible
    .filter((p) => p.haCount > 0)
    .sort(compare)
    .map((p, i) => ({ ...p, rank: i + 1 }));
  const groups = new Map<string, Post[]>();
  for (const p of eligible)
    groups.set(p.author.id, [...(groups.get(p.author.id) || []), p]);
  const people = Array.from(groups.values())
    .map((posts) => {
      const best = [...posts].sort(compare)[0];
      return {
        user: best.author,
        haReceived: posts.reduce((n, p) => n + p.haCount, 0),
        postCount: posts.length,
        bestPost: { id: best.id, caption: best.caption },
      };
    })
    .filter((p) => p.haReceived > 0)
    .sort(
      (a, b) =>
        b.haReceived - a.haReceived ||
        a.postCount - b.postCount ||
        a.user.id.localeCompare(b.user.id),
    )
    .map((p, i) => ({ ...p, rank: i + 1 }));
  return { posts: ranked, people };
}
// Count changes patch all boards without moving their rows. Server snapshots own ranks.
export function patchLeaderboard(
  data: LeaderboardData,
  post: Post,
  change: Partial<Post> | null,
  viewerId: string,
): LeaderboardData {
  const eligible =
    !data.startsAt || Date.parse(post.createdAt) >= Date.parse(data.startsAt);
  const current = data.posts.find((p) => p.id === post.id);
  const previous =
    data.postCounts?.[post.id] ?? current?.haCount ?? post.haCount;
  const delta =
    eligible && change?.haCount !== undefined ? change.haCount - previous : 0;
  return {
    ...data,
    postCounts: { ...data.postCounts, [post.id]: change?.haCount ?? previous },
    posts: data.posts.flatMap((p) =>
      p.id !== post.id ? [p] : change ? [{ ...p, ...change }] : [],
    ),
    people: data.people.map((p) =>
      p.user.id === post.author.id
        ? {
            ...p,
            haReceived: Math.max(0, p.haReceived + delta),
            ...(change === null && eligible
              ? {
                  postCount: Math.max(0, p.postCount - 1),
                  haReceived: Math.max(0, p.haReceived - previous),
                }
              : {}),
          }
        : p,
    ),
    standing: {
      ...data.standing,
      ...(post.author.id === viewerId
        ? {
            haReceived: Math.max(
              0,
              data.standing.haReceived +
                (change === null && eligible ? -previous : delta),
            ),
          }
        : {}),
      ...(data.standing.bestPostId === post.id && change === null
        ? { bestPostId: null, bestPostRank: null, bestPostCaption: null }
        : {}),
    },
    ...(change === null
      ? { expiresAt: new Date(0).toISOString(), stale: true }
      : {}),
  };
}
