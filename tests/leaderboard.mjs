import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const code = ts.transpile(
  readFileSync("lib/leaderboard-contracts.ts", "utf8"),
  { module: ts.ModuleKind.CommonJS },
);
const m = { exports: {} };
new Function("module", "exports", "require", code)(m, m.exports, require);
const { windowStart, rankPosts, patchLeaderboard } = m.exports;
assert.equal(
  windowStart("week", new Date("2026-10-11T12:00:00Z")),
  "2026-10-04T12:00:00.000Z",
);
assert.equal(
  windowStart("week", new Date("2026-11-01T18:00:00Z")),
  "2026-10-25T18:00:00.000Z",
);
assert.equal(
  windowStart("week", new Date("2026-11-02T06:00:00Z")),
  "2026-10-26T06:00:00.000Z",
);
assert.equal(
  windowStart("month", new Date("2026-11-01T18:00:00Z")),
  "2026-10-02T18:00:00.000Z",
);
assert.equal(
  windowStart("month", new Date("2026-03-10T18:00:00Z")),
  "2026-02-08T18:00:00.000Z",
);
assert.equal(
  windowStart("week", new Date("2026-03-08T18:00:00Z")),
  "2026-03-01T18:00:00.000Z",
);
const p = (id, author, ha, createdAt) => ({
  id,
  author: { id: author, name: author, avatarUrl: null },
  haCount: ha,
  createdAt,
  caption: id,
  viewerHasHa: false,
  viewerHasSaved: false,
  commentCount: 0,
});
const posts = [
  p("old", "a", 100, "2026-10-03T23:00:00Z"),
  p("early", "b", 5, "2026-10-05T04:00:00Z"),
  p("late", "a", 5, "2026-10-06T04:00:00Z"),
  p("zero", "a", 0, "2026-10-07T04:00:00Z"),
  p("no-ha", "c", 0, "2026-10-08T04:00:00Z"),
];
const ranked = rankPosts(posts, "week", new Date("2026-10-11T12:00:00Z"));
assert.deepEqual(
  ranked.posts.map((p) => p.id),
  ["early", "late", "zero", "no-ha"],
);
assert.deepEqual(
  ranked.people.map((p) => [p.user.id, p.haReceived, p.postCount]),
  [
    ["b", 5, 1],
    ["a", 5, 2],
    ["c", 0, 1],
  ],
);
assert.equal(ranked.people[1].bestPost.id, "late");
assert.equal(
  rankPosts(posts, "all", new Date("2026-10-11T12:00:00Z")).people[0]
    .haReceived,
  105,
);
const many = Array.from({ length: 60 }, (_, i) =>
  p(
    String(i),
    i === 59 ? "me" : `author-${i}`,
    100 - i,
    "2026-10-06T12:00:00Z",
  ),
);
assert.equal(
  rankPosts(many, "week", new Date("2026-10-11T12:00:00Z")).people.find(
    (p) => p.user.id === "me",
  ).rank,
  60,
);
let data = {
  ...ranked,
  window: "week",
  startsAt: "2026-10-05T04:00:00Z",
  expiresAt: "2026-10-11T12:05:00Z",
  standing: {
    haReceived: 5,
    bestPostId: "late",
    bestPostRank: 2,
    peopleRank: 2,
  },
};
data = patchLeaderboard(data, posts[2], { haCount: 6, viewerHasHa: true }, "a");
assert.equal(data.posts[1].rank, 2);
assert.equal(data.posts[1].haCount, 6);
assert.equal(data.people[1].haReceived, 6);
assert.equal(data.standing.haReceived, 6);
data = patchLeaderboard(data, posts[2], { haCount: 6, viewerHasHa: true }, "a");
assert.equal(data.people[1].haReceived, 6);
data = patchLeaderboard(
  data,
  posts[2],
  { haCount: 5, viewerHasHa: false },
  "a",
);
assert.equal(data.people[1].haReceived, 5);
data = patchLeaderboard(data, posts[0], { haCount: 101 }, "a");
assert.equal(data.people[1].haReceived, 5);
data = patchLeaderboard(data, posts[2], null, "a");
assert.equal(data.posts.length, 3);
assert.equal(data.standing.bestPostRank, null);
assert.equal(data.stale, true);
console.log(
  "PASS rolling windows across DST, publication-window totals, both tie rules, zero-Ha inclusion, rank beyond 50, stable optimistic counts, retry/rollback and deletion invalidation",
);
