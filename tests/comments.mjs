import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const code = ts.transpile(readFileSync(file, "utf8"), {
    module: ts.ModuleKind.CommonJS,
  });
  const m = { exports: {} };
  new Function("module", "exports", "require", code)(m, m.exports, (id) =>
    Object.hasOwn(deps, id) ? deps[id] : require(id),
  );
  return m.exports;
}
const { safeReturnPath } = load("lib/auth-return.ts");
for (const value of [
  "https://evil.test",
  "//evil.test",
  "/\\evil.test",
  "/%2f%2fevil.test",
  "/%252f%252fevil.test",
  "/path\n/evil",
  "/auth/callback",
  "/api/delete",
  "/%zz",
])
  assert.equal(safeReturnPath(value), null, value);
assert.equal(safeReturnPath("/post/123#comments"), "/post/123#comments");
const contract = load("lib/comment-contracts.ts"),
  post = load("lib/post-contracts.ts");
assert.equal(contract.validateComment(" \n "), false);
assert.equal(contract.validateComment("🙂".repeat(280)), true);
assert.equal(contract.validateComment("🙂".repeat(281)), false);
assert.equal(contract.validateComment("A\nB"), true);
assert.equal(contract.validateComment("a\u0000b"), false);
const mockPost = load("lib/mock-posts.ts", {
  "server-only": {},
  "./post-contracts": post,
});
class StudioError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const mock = load("lib/mock-comments.ts", {
  "server-only": {},
  "./mock-posts": mockPost,
  "./comment-contracts": contract,
  "./studio-server": { StudioError },
});
const owner = "comment-tester",
  id = "mock-1",
  second = "mock-2";
mock.mockCommentsList(owner, id, "top", null, 20);
const result = mock.mockCommentAdd(
  owner,
  id,
  "A proper test.",
  undefined,
  "request1",
);
assert.equal(result.commentCount, 1);
assert.equal(
  mock.mockCommentAdd(owner, id, "A proper test.", undefined, "request1")
    .comment.id,
  result.comment.id,
);
assert.equal(mockPost.mockGet(owner, id).commentCount, 1);
assert.throws(
  () =>
    mock.mockCommentAdd(owner, id, "A changed test.", undefined, "request1"),
  /Invalid request/,
);
const reply = mock.mockCommentAdd(
  owner,
  id,
  "A reply.",
  result.comment.id,
  "request2",
);
assert.equal(reply.comment.replyTo.authorName, "@you");
assert.throws(
  () =>
    mock.mockCommentAdd(
      owner,
      second,
      "Cross-post reply.",
      result.comment.id,
      "cross",
    ),
  /Reply no longer/,
);
let ha = mock.mockCommentAction(owner, result.comment.id, "ha", "ha1");
assert.equal(ha.haCount, 1);
assert.equal(
  mock.mockCommentAction(owner, result.comment.id, "ha", "ha1").haCount,
  1,
);
const third = mock.mockCommentAdd(
  owner,
  id,
  "Third thought.",
  undefined,
  "request3",
);
assert.equal(third.commentCount, 3);
assert.throws(
  () =>
    mock.mockCommentAdd(owner, id, "Fourth thought.", undefined, "request4"),
  /rate limit/,
);
const removed = mock.mockCommentAction(owner, result.comment.id, "delete");
assert.equal(removed.commentCount, 2);
const rows = mock.mockCommentsList(owner, id, "new", null, 20).comments;
assert.equal(
  rows.find((c) => c.id === reply.comment.id).replyTo.authorName,
  "deleted",
);
assert.equal(
  rows.some((c) => c.id === result.comment.id),
  false,
);
const page = {
  comments: [result.comment, reply.comment],
  nextCursor: null,
  commentCount: 2,
};
const patched = contract.patchComments([page], result.comment.id, null);
assert.equal(patched[0].comments[0].replyTo.authorName, "deleted");
assert.equal(
  mock
    .mockCommentsList("another-viewer", id, "new", null, 20)
    .comments.some((c) => c.id === reply.comment.id),
  false,
);
const sorted = contract.orderComments(
  [
    { ...reply.comment, haCount: 1 },
    { ...third.comment, haCount: 0 },
  ],
  "top",
  new Set([third.comment.id]),
);
assert.equal(sorted[0].id, third.comment.id);
console.log(
  "PASS internal return paths, Unicode/comment validation, idempotent send/Ha, rate limit, same-post replies, @deleted, cache patching and temporary Top ordering",
);

const { createFeedStore } = load("stores/feed-store.ts");
const store = createFeedStore();
store.getState().markDetailEntry("/feed?sort=hot", 900, 3, "hot");
store.getState().remember("hot", 0, 3);
assert.equal(store.getState().detailReturn.y, 900);
assert.equal(store.getState().detailReturn.pages, 3);
store.getState().consumeDetailReturn();
assert.equal(store.getState().detailReturn, null);
console.log("PASS detail return position survives route scroll reset");
