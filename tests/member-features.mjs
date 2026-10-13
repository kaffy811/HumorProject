import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
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
const contracts = load("lib/create-contracts.ts"),
  profile = load("lib/profile-contracts.ts");
assert.equal(profile.displayName("  Kai Jones  "), "Kai Jones");
assert.equal(profile.displayName("毛头"), "毛头");
for (const name of ["", " ", "a", "a".repeat(31), "abc\nxyz", "a\x7fb"])
  assert.throws(() => profile.displayName(name));
const seeds = load("lib/seed-validation.ts", {
  "./create-contracts": contracts,
});
const base = {
  imageFile: "campus.png",
  caption: " A very expensive place to remember I have homework. ",
  style: "Deadpan",
};
assert.equal(
  seeds.seedPosts([base], "production")[0].caption,
  base.caption.trim(),
);
assert.equal(
  seeds.seedPosts([{ ...base, imageFile: "校园照片.png" }], "production")[0]
    .imageFile,
  "校园照片.png",
);
for (const imageFile of [
  "../secret.png",
  "/tmp/photo.png",
  "https://site/image.png",
  "images//a.png",
  "placeholder-city.png",
])
  assert.throws(() => seeds.seedPosts([{ ...base, imageFile }], "production"));
assert.throws(() =>
  seeds.seedPosts([{ ...base, placeholder: true }], "production"),
);
assert.equal(
  seeds.seedPosts([{ ...base, placeholder: true }], "development").length,
  1,
);
assert.throws(() => seeds.seedPosts([base, base], "production"));
assert.throws(() =>
  seeds.seedPosts([{ ...base, caption: "x".repeat(201) }], "production"),
);
assert.throws(() =>
  seeds.seedPosts([{ ...base, style: "Fake" }], "production"),
);
seeds.seedTarget("production", "https://wqkpatxsbxwjsupojjcq.supabase.co");
seeds.seedTarget("development", "http://127.0.0.1:54321");
assert.throws(() =>
  seeds.seedTarget("development", "https://wqkpatxsbxwjsupojjcq.supabase.co"),
);
assert.throws(() =>
  seeds.seedTarget("production", "https://another.supabase.co"),
);
assert.throws(() =>
  seeds.seedTarget(
    "production",
    "https://user:pass@wqkpatxsbxwjsupojjcq.supabase.co",
  ),
);
const cache = load("lib/profile-cache.ts");
const post = { id: "p", haCount: 5 };
let value = { id: "u", postCount: 2, haReceived: 8 };
value = cache.patchProfileCounts(value, post, { haCount: 6 });
assert.equal(value.haReceived, 9);
value = cache.patchProfileCounts(value, post, { haCount: 6 });
assert.equal(value.haReceived, 9);
value = cache.patchProfileCounts(value, post, { haCount: 5 });
assert.equal(value.haReceived, 8);
value = cache.patchProfileCounts(value, post, null);
assert.equal(value.haReceived, 3);
assert.equal(value.postCount, 1);
const notices = load("lib/notification-contracts.ts"),
  item = {
    actor: { name: "Kai" },
    actorCount: 5,
    type: "ha",
    postId: "p",
    commentId: null,
  };
assert.equal(
  notices.notificationText(item),
  "Kai and 4 others laughed at your post",
);
assert.equal(notices.notificationHref(item), "/post/p");
assert.equal(
  notices.notificationHref({
    ...item,
    type: "reply",
    actorCount: 1,
    commentId: "c",
  }),
  "/post/p?comment=c#comments",
);
const mock = load("lib/mock-notifications.ts", { "server-only": {} });
assert.equal(mock.mockInbox("a").summary.unreadCount, 1);
assert.equal(mock.mockInbox("a", true).summary.unreadCount, 0);
assert.equal(mock.mockInbox("a").summary.unreadCount, 0);
assert.equal(mock.mockInbox("b").summary.unreadCount, 1);
for (const env of ["development", "production"]) {
  const run = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/seed.ts", "--env", env, "--dry-run"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /No account, files or database rows were written/);
}
const reject = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "scripts/seed.ts",
    "--env",
    "production",
    "--manifest",
    "seed/development/posts.json",
    "--dry-run",
  ],
  { encoding: "utf8" },
);
assert.equal(reject.status, 1);
assert.match(reject.stderr, /refuses placeholder/);
console.log(
  "PASS display names, filename/path/environment and placeholder rejection, dry-run image normalization with no writes, profile count retry/rollback, notification grouping text/targets and mock inbox isolation",
);
const sharp = require("sharp");
let staged;
const avatarServer = load("lib/profile-server.ts", {
  "server-only": {},
  sharp: { default: sharp },
  "./mock-profiles": {
    mockStageAvatar(owner, id, bytes) {
      staged = { owner, id, bytes };
    },
  },
  "./studio-server": { StudioError: class StudioError extends Error {} },
});
const widePhoto = await sharp({
  create: { width: 800, height: 400, channels: 3, background: "#eb6048" },
})
  .png()
  .toBuffer();
const ctx = { mock: true, user: { id: "local-photo-test" } };
await avatarServer.stageProfileAvatar(ctx, widePhoto, {
  x: 350,
  y: 40,
  size: 256,
});
const avatarInfo = await sharp(staged.bytes).metadata();
assert.equal(avatarInfo.width, 256);
assert.equal(avatarInfo.height, 256);
assert.equal(avatarInfo.format, "webp");
await assert.rejects(
  () =>
    avatarServer.stageProfileAvatar(ctx, widePhoto, {
      x: 750,
      y: 0,
      size: 256,
    }),
  /outside/,
);
await assert.rejects(
  () =>
    avatarServer.stageProfileAvatar(ctx, widePhoto, { x: -1, y: 0, size: 200 }),
  /outside/,
);
console.log(
  "PASS server square avatar crop, 256×256 WebP compression and out-of-bounds rejection without Storage writes",
);
