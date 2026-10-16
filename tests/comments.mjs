import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const code = ts.transpile(readFileSync(file, "utf8"), {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
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
const {commentThreads,commentAncestors} = load("lib/comment-threads.ts", {"./comment-contracts":contract});
const threadComment = (id,reply=null,ha=0,at=1) => ({id,postId:"thread-post",body:id,author:{id:"author",name:"@author",avatarUrl:null},createdAt:new Date(at*1000).toISOString(),haCount:ha,viewerHasHa:false,replyTo:reply?{id:reply,authorName:"@parent"}:null});
const parent = threadComment("parent",null,1), child = threadComment("child","parent",100,3), peer=threadComment("peer",null,5,2), grandchild=threadComment("grandchild","child",0,4);
let threads=commentThreads([child,grandchild,peer,parent],"top",new Set());
assert.deepEqual(threads.map(t=>t.comment.id),["peer","parent"]);
assert.equal(threads[1].replies[0].comment.id,"child");
assert.equal(threads[1].replies[0].replies[0].comment.id,"grandchild");
threads=commentThreads([peer,child,parent],"top",new Set(["child"]));
assert.equal(threads[0].comment.id,"parent");assert.equal(threads[0].replies[0].comment.id,"child");
assert.equal(commentThreads([child],"new",new Set())[0].comment.id,"child");
assert.equal(commentThreads([threadComment("a","b"),threadComment("b","a")],"new",new Set()).length,2);
assert.equal(commentThreads([threadComment("a","a")],"new",new Set()).length,1);
assert.equal(commentThreads([parent,{...child,postId:"other"}],"top",new Set()).length,2);
const ancestorRequests=[];
const ancestors=await commentAncestors([grandchild],"thread-post",async id=>{ancestorRequests.push(id);return [parent,child].find(c=>c.id===id)||null;});
assert.deepEqual(ancestors.map(c=>c.id),["child","parent"]);
assert.deepEqual(ancestorRequests,["child","parent"]);
assert.deepEqual(await commentAncestors([child],"thread-post",async()=>({...parent,postId:"another-post"})),[]);
assert.deepEqual(await commentAncestors([{...child,replyTo:{id:"parent",authorName:"deleted"}}],"thread-post",async()=>assert.fail("Deleted parents must not be fetched")),[]);
// Four comments do not imply four levels: the last answers the root again.
const sibling = threadComment("fourth","parent",0,5);
for(const sort of ["top","new"]) {
 const grouped=commentThreads([grandchild,sibling,child,parent],sort,new Set([sibling.id]));
 assert.equal(grouped.length,1);
 assert.deepEqual(grouped[0].replies.map(t=>t.comment.id),["child","fourth"]);
 assert.equal(grouped[0].replies[0].replies[0].comment.id,"grandchild");
 assert.equal(grouped[0].replies[1].parent.id,"parent");
 assert.equal(grouped[0].replies[1].parent.body,"parent");
 assert.equal(grouped[0].replies[0].replies[0].parent.id,"child");
}
console.log("PASS replies stay under their parent in Top/New, highlighted replies promote conversations, missing ancestors load once, deleted/cyclic/cross-post replies remain safe");
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

const savedNow=Date.now;
try {
 let clock=2_000_000_000_000;Date.now=()=>clock;
 const u='three-layer-local',p=mockPost.mockList(u,'new',null,12).posts[0].id;
 const root=mock.mockCommentAdd(u,p,'Level one',undefined,'depth-1').comment;
 const child=mock.mockCommentAdd(u,p,'Level two',root.id,'depth-2').comment;
 const leaf=mock.mockCommentAdd(u,p,'Level three',child.id,'depth-3').comment;
 assert.deepEqual([root.depth,child.depth,leaf.depth],[1,2,3]);
 clock+=11000;
 assert.throws(()=>mock.mockCommentAdd(u,p,'Level four',leaf.id,'depth-4'),/three levels deep/);
 mock.mockCommentAction(u,root.id,'delete');
 assert.throws(()=>mock.mockCommentAdd(u,p,'Still level four',leaf.id,'depth-4b'),/three levels deep/);
 const failures=load('lib/comments-server.ts',{'server-only':{},'./create-contracts':{},'./studio-server':{},'./comment-contracts':contract});
 assert.equal(failures.commentFailure(Error(contract.COMMENT_DEPTH_ERROR)).status,400);
} finally {Date.now=savedNow;}
console.log('PASS mock and API errors enforce three comment levels, including replies whose ancestors were deleted');
