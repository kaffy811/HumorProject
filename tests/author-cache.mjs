import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const cache = new Map(),
  viewer = "me",
  key = (...p) => JSON.stringify(p),
  old = {
    id: "me",
    name: "@before",
    username: "before",
    avatarUrl: "old.webp",
  };
const feed = key("feed-page", viewer, "new", 1, "s"),
  comments = key("comments", viewer, "p", "top", 0, null),
  ranks = key("leaderboard", viewer, "week", "rolling-v2"),
  inbox = key("notifications", viewer, 0, null);
cache.set(feed, { data: { posts: [{ id: "p", author: old }] } });
cache.set(comments, {
  data: [
    {
      comments: [
        {
          id: "c",
          author: old,
          replyTo: { id: "parent", authorId: "me", authorName: "@before" },
        },
        {
          id: "d",
          replyTo: { id: "deleted", authorId: "me", authorName: "deleted" },
        },
      ],
    },
  ],
});
cache.set(ranks, { data: { people: [{ user: old }] } });
cache.set(inbox, { data: { items: [{ actor: old }] } });
let header;
const deps = {
  react: { useCallback: (f) => f },
  swr: {
    useSWRConfig: () => ({
      cache,
      mutate: async (k, update) => {
        cache.set(k, { data: update(cache.get(k)?.data) });
      },
    }),
  },
  "@/components/feed/FeedCacheProvider": { useFeedViewer: () => viewer },
  "@/stores/author-store": {
    useAuthorStore: (f) => f({ put: (p) => (header = p) }),
  },
};
const m = { exports: {} };
new Function(
  "module",
  "exports",
  "require",
  ts.transpile(readFileSync("hooks/useAuthorCache.ts", "utf8"), {
    module: ts.ModuleKind.CommonJS,
  }),
)(m, m.exports, (id) => deps[id]);
await m.exports.useAuthorCache()({
  ...old,
  name: "@after",
  username: "after",
  avatarUrl: "new.webp",
});
assert.equal(header.name, "@after");
assert.equal(cache.get(feed).data.posts[0].author.avatarUrl, "new.webp");
assert.equal(cache.get(comments).data[0].comments[0].author.name, "@after");
assert.equal(
  cache.get(comments).data[0].comments[0].replyTo.authorName,
  "@after",
);
assert.equal(
  cache.get(comments).data[0].comments[1].replyTo.authorName,
  "deleted",
);
assert.equal(cache.get(ranks).data.people[0].user.username, "after");
assert.equal(cache.get(inbox).data.items[0].actor.name, "@after");
console.log(
  "PASS profile edits synchronize header, all cached post/comment/notification/rank authors and live reply mentions, preserving @deleted",
);
