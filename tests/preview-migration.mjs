import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
export async function verifyPreviewMigration(db) {
  const id = randomUUID(),
    other = randomUUID();
  await db.exec("begin");
  async function rejected(sql, args, pattern) {
    await db.exec("savepoint expected_failure");
    try {
      await db.query(sql, args);
      assert.fail("Expected database rejection");
    } catch (e) {
      assert.match(e.message, pattern);
    } finally {
      await db.exec("rollback to expected_failure;release expected_failure");
    }
  }
  try {
    for (const uid of [id, other]) {
      await db.query("insert into auth.users(id)values($1)", [uid]);
      await db.query(
        "insert into public.profiles(id,username,first_name,last_name)values($1,$2,'Local','Fixture')",
        [uid, "test_" + uid.slice(0, 12).replaceAll("-", "")],
      );
    }
    const ids = [];
    const createdAt = new Date(Date.now() - 3600000).toISOString();
    for (let n = 0; n < 23; n++) {
      const image = randomUUID(),
        post = randomUUID();
      ids.push(post);
      await db.query(
        "insert into public.humor_images(id,user_id,status,storage_path,image_width,image_height,locked_thumbnail_path)values($1,$2,'ready',($2::uuid::text||'/'||$1::uuid::text||'.webp'),640,480,'local-only-locked.webp')",
        [image, id],
      );
      await db.query(
        "insert into public.humor_captions(id,image_id,content,created_at)values($1,$2,'Local fixture',$3)",
        [post, image, createdAt],
      );
    }
    const first = (
      await db.query("select public.humor_paged_feed($1,'hot',1,null)page", [
        id,
      ])
    ).rows[0].page;
    const all = [];
    for (let page = 1; page <= first.totalPages; page++) {
      const p = (
        await db.query("select public.humor_paged_feed($1,'hot',$2,$3)page", [
          id,
          page,
          first.snapshotId,
        ])
      ).rows[0].page;
      assert.ok(p.posts.length <= 9);
      all.push(...p.posts);
    }
    assert.equal(all.length, first.totalCount);
    assert.equal(new Set(all.map((p) => p.id)).size, all.length);
    assert.deepEqual(
      all.filter((p) => ids.includes(p.id)).map((p) => p.id),
      [...ids].sort().reverse(),
    );
    assert.ok(all.every((p) => p.author.name.startsWith("@")));
    await rejected(
      "select public.humor_paged_feed($1,'hot',2,$2)",
      [other, first.snapshotId],
      /snapshot expired/i,
    );
    const before = (
      await db.query("select public.humor_paged_feed($1,'hot',2,$2)page", [
        id,
        first.snapshotId,
      ])
    ).rows[0].page.posts.map((p) => p.id);
    await db.query(
      "insert into public.humor_votes(user_id,caption_id,value)values($1,$2,1)",
      [other, ids[22]],
    );
    const after = (
      await db.query("select public.humor_paged_feed($1,'hot',2,$2)page", [
        id,
        first.snapshotId,
      ])
    ).rows[0].page.posts.map((p) => p.id);
    assert.deepEqual(after, before);
    const board = (
      await db.query("select public.humor_leaderboard('week',$1)board", [id])
    ).rows[0].board;
    assert.equal(board.standing.peopleRank !== null, true);
    assert.ok(board.posts.some((p) => ids.includes(p.id) && p.haCount === 0));
    assert.deepEqual(
      board.posts
        .filter((p) => ids.includes(p.id) && p.haCount === 0)
        .map((p) => p.id),
      ids.filter((p) => p !== ids[22]).sort(),
    );
    assert.ok(
      Math.abs(
        Date.parse(board.computedAt) -
          Date.parse(board.startsAt) -
          7 * 86400000,
      ) < 5,
    );
    await db.query(
      "select public.humor_save_profile_v2($1,' First ',' Last ','local_handle','remove',null)",
      [id],
    );
    const profile = (
      await db.query("select public.humor_profile_summary($1,$1)p", [id])
    ).rows[0].p;
    assert.equal(profile.name, "@local_handle");
    assert.equal(profile.avatarUrl, null);
    assert.equal(profile.firstName, "First");
    assert.equal(
      (
        await db.query(
          "select public.humor_username_available($1,'local_handle')available",
          [other],
        )
      ).rows[0].available,
      false,
    );
    const image = randomUUID();
    await db.query(
      "insert into public.humor_images(id,user_id,status,storage_path,locked_thumbnail_path)values($1,$2,'ready',($2::uuid::text||'/'||$1::uuid::text||'.webp'),'local-only-locked.webp')",
      [image, id],
    );
    await db.query(
      "insert into public.humor_drafts(image_id,user_id,image_path,image_mime,byte_count,upload_status,ai_path,image_sha256)values($1,$2,($2::uuid::text||'/'||$1::uuid::text||'.webp'),'image/webp',10,'ready',($2::uuid::text||'/'||$1::uuid::text||'-ai.png'),repeat('a',64))",
      [image, id],
    );
    const text = "Handmade. Still subject to moderation.";
    const key = randomUUID();
    await rejected(
      "select public.publish_humor_handmade($1,$2,$3,$4)",
      [image, id, text, key],
      /Safety approval/,
    );
    await db.query(
      "insert into public.humor_moderation_checks(user_id,image_id,content_hash,model,allowed)values($1,$2,$3,'local-test',true)",
      [id, image, createHash("sha256").update(text).digest("hex")],
    );
    const publication = (
      await db.query("select public.publish_humor_handmade($1,$2,$3,$4)p", [
        image,
        id,
        text,
        key,
      ])
    ).rows[0].p;
    const again = (
      await db.query("select public.publish_humor_handmade($1,$2,$3,$4)p", [
        image,
        id,
        text,
        key,
      ])
    ).rows[0].p;
    assert.equal(publication.postId, again.postId);
    const row = (
      await db.query(
        "select style,source from public.humor_captions where id=$1",
        [publication.postId],
      )
    ).rows[0];
    assert.deepEqual(row, { style: "HANDMADE", source: "handmade" });
    await rejected(
      "select public.humor_paged_feed($1,'hot',1,$2)",
      [id, first.snapshotId],
      /snapshot expired/i,
    );
    const rls = (
      await db.query(
        "select count(*)::int total,count(*)filter(where c.relrowsecurity)::int protected from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relkind='r'",
      )
    ).rows[0];
    assert.equal(rls.total, rls.protected);
    const permission = (
      await db.query(
        "select has_function_privilege('authenticated','public.publish_humor_handmade(uuid,uuid,text,uuid)','execute')allowed",
      )
    ).rows[0];
    assert.equal(permission.allowed, false);
    console.log(
      "PASS migration: stable 9-post pages and tie IDs, owner-bound snapshots, frozen ranks, rolling windows/zero Ha, @username and optional avatar, moderation-gated/idempotent handmade, publication invalidation, RLS and restricted RPC",
    );
  } finally {
    await db.exec("rollback");
  }
}
