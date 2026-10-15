import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const m = { exports: {} };
  new Function(
    "module",
    "exports",
    "require",
    ts.transpile(readFileSync(file, "utf8"), {
      module: ts.ModuleKind.CommonJS,
    }),
  )(m, m.exports, (id) => (Object.hasOwn(deps, id) ? deps[id] : require(id)));
  return m.exports;
}
const contracts = load("lib/post-contracts.ts");
const mock = load("lib/mock-posts.ts", {
  "server-only": {},
  "./post-contracts": contracts,
});
const viewer = "publish-return-regression",
  cache = new Map(),
  requests = [];
const key = (...parts) => JSON.stringify(parts);
async function listPosts({ sort, page = 1, snapshot, limit = 9 }) {
  requests.push({ sort, page, snapshot });
  const first = mock.mockList(
      viewer,
      sort,
      snapshot ? `${snapshot}:0` : null,
      12,
    ),
    all = [...first.posts];
  let cursor = first.nextCursor;
  while (cursor) {
    const next = mock.mockList(viewer, sort, cursor, 12);
    all.push(...next.posts);
    cursor = next.nextCursor;
  }
  return {
    ...first,
    posts: all.slice((page - 1) * limit, page * limit),
    nextCursor: null,
    page,
    totalCount: all.length,
    totalPages: Math.ceil(all.length / limit),
  };
}
async function mutate(k, value) {
  const old = cache.get(k)?.data;
  cache.set(k, { data: typeof value === "function" ? value(old) : value });
}
for (const sort of ["hot", "new"]) {
  const first = await listPosts({ sort });
  cache.set(key("feed-session", viewer, sort), { data: first });
  for (const page of [1, 2, 3, 4]) {
    cache.set(key("feed-page", viewer, sort, page, first.snapshotId), {
      data: await listPosts({ sort, page, snapshot: first.snapshotId }),
    });
  }
}
cache.set(key("profile", viewer, viewer), { data: { postCount: 6 } });
cache.set("$inf$" + key("profile-posts", viewer, viewer, "mine", 0), {
  data: [{ posts: [], nextCursor: "old" }],
});
cache.set(key("leaderboard", viewer, "week", "rolling-v2"), {
  data: { posts: [] },
});
const hook = load("hooks/useContentCache.ts", {
  react: { useCallback: (fn) => fn },
  swr: { useSWRConfig: () => ({ cache, mutate }) },
  "@/components/feed/FeedCacheProvider": { useFeedViewer: () => viewer },
  "@/lib/posts": { listPosts },
  "@/lib/profiles": {
    getProfile: async () => ({ postCount: 7 }),
    listProfilePosts: async () => mock.mockList(viewer, "mine", null, 12),
  },
  "@/lib/leaderboard": { getLeaderboard: async () => ({ posts: [posted] }) },
  "@/lib/comments": { getPost: async (id) => mock.mockGet(viewer, id) },
});
// No mounted Feed fetchers are registered: this reproduces publication from /create.
const posted = mock.mockPublish(viewer, {
  caption: "This post exists before I refresh.",
  style: "HANDMADE",
  imageUrl: "/local-fixture.webp",
  imageWidth: 640,
  imageHeight: 480,
});
await hook.useContentCache()(posted);
const fresh = cache.get(key("feed-session", viewer, "new")).data;
assert.equal(fresh.posts[0].id, posted.id);
assert.equal(
  cache.get(key("feed-page", viewer, "new", 1, fresh.snapshotId)).data.posts[0]
    .id,
  posted.id,
);
assert.equal(cache.get(key("profile", viewer, viewer)).data.postCount, 7);
assert.equal(
  cache.get("$inf$" + key("profile-posts", viewer, viewer, "mine", 0)).data[0]
    .posts[0].id,
  posted.id,
);
assert.equal(
  cache.get(key("leaderboard", viewer, "week", "rolling-v2")).data.posts[0].id,
  posted.id,
);
for (const sort of ["hot", "new"]) {
  const s = cache.get(key("feed-session", viewer, sort)).data;
  const ids = [];
  for (const page of [1, 2, 3, 4]) {
    const data = cache.get(
      key("feed-page", viewer, sort, page, s.snapshotId),
    ).data;
    ids.push(...data.posts.map((p) => p.id));
  }
  assert.equal(ids.length, 31);
  assert.equal(new Set(ids).size, 31);
}
assert.equal(mock.mockGet("separate-preview-user", posted.id), null);
mock.mockAction(viewer, posted.id, "delete");
await hook.useContentCache()();
assert.equal(
  cache
    .get(key("feed-session", viewer, "new"))
    .data.posts.some((p) => p.id === posted.id),
  false,
);
assert.ok(requests.filter((r) => r.page > 1).length >= 12);
console.log(
  "PASS publish → cached /feed without page reload, all Hot/New pages refreshed, no duplicates, My posts/statistics/ranks refreshed, deletion and account isolation",
);
