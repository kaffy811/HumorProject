import { preparePreview } from "./prepare-preview.mjs";
import { verifyPreviewMigration } from "../../tests/preview-migration.mjs";
import { PGlite } from "@electric-sql/pglite";
import { readFile, writeFile } from "node:fs/promises";
const db = new PGlite();
try {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema extensions;create table auth.users(id uuid primary key);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt()returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create function storage.foldername(name text)returns text[]language sql as $$select string_to_array(name,'/')$$;`,
  );
  const sql = await readFile(
    "deliverables/backups/2026-10-14-public.sql",
    "utf8",
  );
  // In-memory auth stubs only satisfy restore foreign keys. No external accounts are created.
  const ids = [
    ...new Set(
      sql.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ) || [],
    ),
  ];
  for (const id of ids)
    await db.query(
      "insert into auth.users(id)values($1)on conflict do nothing",
      [id],
    );
  await db.exec(sql);
  const counts = await db.query(
    `select count(*)::int tables from pg_tables where schemaname='public'`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/202610140001_profile_feed_rank.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/202610140002_auto_styles_handmade.sql",
      "utf8",
    ),
  );
  const profiles = (await db.query("select id from public.profiles")).rows;
  for (const p of profiles) {
    await db.query("select public.humor_profile_summary($1,$1)", [p.id]);
  }
  await db.query("select public.humor_paged_feed($1,'hot',1,null)", [
    profiles[0].id,
  ]);
  await verifyPreviewMigration(db);
  await preparePreview();
  async function publicFingerprint() {
    const tables = (
      await db.query(
        "select tablename from pg_tables where schemaname='public'order by tablename",
      )
    ).rows;
    const hashes = {};
    for (const { tablename } of tables) {
      if (!/^[a-z_]+$/.test(tablename)) throw Error("Unexpected identifier.");
      hashes[tablename] = (
        await db.query(
          `select md5(coalesce(string_agg(j::text,''order by j::text),''))hash from(select to_jsonb(t)j from public.${tablename} t)s`,
        )
      ).rows[0].hash;
    }
    return JSON.stringify(hashes);
  }
  const fingerprint = await publicFingerprint();
  await db.exec(
    "create role authenticator;create table storage.buckets(id text primary key,name text,public boolean);",
  );
  await db.exec(
    await readFile("deliverables/backups/preview-clone.sql", "utf8"),
  );
  for (const name of [
    "202610140001_profile_feed_rank.sql",
    "202610140002_auto_styles_handmade.sql",
  ])
    await db.exec(
      await readFile("deliverables/backups/preview-" + name, "utf8"),
    );
  const isolation = await publicFingerprint();
  if (isolation !== fingerprint)
    throw Error("Preview changed original application rows.");
  const previewProfiles = (
    await db.query("select count(*)::int total from humor_preview.profiles")
  ).rows[0].total;
  if (previewProfiles !== profiles.length)
    throw Error("Preview profile count mismatch.");
  const protection = (
    await db.query(
      "select count(*)::int total,count(*)filter(where c.relrowsecurity)::int protected from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='humor_preview'and c.relkind='r'",
    )
  ).rows[0];
  if (protection.total !== protection.protected)
    throw Error("Preview RLS missing.");
  await db.query("select humor_preview.humor_paged_feed($1,'new',1,null)", [
    profiles[0].id,
  ]);
  console.log(
    "PASS isolated schema restore/migrations: all original application rows preserved, independent tables and all preview RLS enabled.",
  );

  console.log(
    `PASS: local backup restore (${counts.rows[0].tables} tables), both migrations and profile/feed RPC smoke checks.`,
  );
  await writeFile(
    "deliverables/backups/local-restore-verification.json",
    JSON.stringify(
      { restored: true, tables: counts.rows[0].tables, migrationsPassed: true },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(
    `Restore rehearsal failed: ${e.code || ""} ${e.message} at ${e.position || "unknown"}`,
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
