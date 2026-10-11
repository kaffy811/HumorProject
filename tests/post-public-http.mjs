import assert from "node:assert/strict";
import sharp from "sharp";
const origin = process.env.TEST_ORIGIN || "http://localhost:3000",
  id = process.env.TEST_POST_ID || "mock-1";
const page = await fetch(`${origin}/post/${id}`);
assert.equal(page.status, 200);
const html = await page.text();
assert.ok(html.includes("The membership is free."));
assert.equal(html.includes("Say something funnier."), false);
assert.equal(html.includes('"imageUrl"'), false);
assert.equal(html.includes("/baby/smirk.png"), false);
for (const path of [
  `/api/posts/${id}`,
  `/api/posts/${id}/comments`,
  `/api/posts/${id}/media`,
])
  assert.equal((await fetch(origin + path)).status, 401, path);
assert.equal(
  (await fetch(origin + "/feed", { redirect: "manual" })).status,
  307,
);
const thumb = await fetch(`${origin}/post/${id}/thumbnail`);
assert.equal(thumb.status, 200);
const tm = await sharp(Buffer.from(await thumb.arrayBuffer())).metadata();
assert.ok(tm.width <= 48 && tm.height <= 48);
const og = await fetch(`${origin}/post/${id}/opengraph-image`);
assert.equal(og.status, 200);
const image = Buffer.from(await og.arrayBuffer());
const m = await sharp(image).metadata();
assert.equal(m.width, 1200);
assert.equal(m.height, 630);
assert.equal(
  (
    await fetch(
      origin + "/post/00000000-0000-4000-8000-000000000000/opengraph-image",
    )
  ).status,
  404,
);
for (const target of [
  "//evil.example",
  "/%2f%2fevil.example",
  "/\\evil.example",
])
  assert.equal(
    (
      await fetch(origin + "/auth/return", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify({ target }),
      })
    ).status,
    400,
  );
console.log(
  "PASS public locked DTO, no comments/original media, private APIs, stored thumbnail dimensions, 1200×630 OG, deleted/missing OG 404 and rejected external return paths",
);
