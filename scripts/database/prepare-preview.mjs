import { readFile, writeFile, chmod } from "node:fs/promises";
export function previewSql(sql) {
  const data = [];
  const stripped = sql.replace(
    /^INSERT INTO public\.\w+ SELECT \* FROM json_populate_recordset\([\s\S]*?\);(?=\n(?:INSERT|CREATE|ALTER|REVOKE|GRANT|$))/gm,
    (statement) => {
      const key = data.length;
      data.push(
        statement.replace(
          /^INSERT INTO public\.(\w+) SELECT \* FROM json_populate_recordset\(NULL::public\.(\w+),/,
          "INSERT INTO humor_preview.$1 SELECT * FROM json_populate_recordset(NULL::humor_preview.$2,",
        ),
      );
      return `-- PRESERVED_DATA_${key}`;
    },
  );
  let result = stripped
    .replace(/public\./g, "humor_preview.")
    .replace("search_path=public,", "search_path=humor_preview,");
  for (const name of ["images", "avatars", "previews"])
    result = result.replaceAll(`'humor-${name}'`, `'humor-preview-${name}'`);
  return result.replace(
    /-- PRESERVED_DATA_(\d+)/g,
    (_, index) => data[Number(index)],
  );
}
export async function preparePreview() {
  const backup = await readFile(
    "deliverables/backups/2026-10-14-public.sql",
    "utf8",
  );
  let sql = previewSql(backup);
  sql = sql.replace(
    /(CREATE TABLE humor_preview\.(\w+) \([\s\S]*?\);)/g,
    (_, statement, table) =>
      `${statement}\nALTER TABLE humor_preview.${table} ENABLE ROW LEVEL SECURITY;`,
  );
  const header = `begin;\ncreate schema humor_preview;\nrevoke all on schema humor_preview from public,anon;\ngrant usage on schema humor_preview to authenticated,service_role;\n`;
  const tail = `\ninsert into storage.buckets(id,name,public)values('humor-preview-images','humor-preview-images',false),('humor-preview-avatars','humor-preview-avatars',false),('humor-preview-previews','humor-preview-previews',false);\nalter role authenticator set pgrst.db_schemas='public,graphql_public,humor_preview';\nnotify pgrst,'reload config';\nnotify pgrst,'reload schema';\ncommit;\n`;
  await writeFile(
    "deliverables/backups/preview-clone.sql",
    header + sql + tail,
  );
  await chmod("deliverables/backups/preview-clone.sql", 0o600);
  for (const name of [
    "202610140001_profile_feed_rank.sql",
    "202610140002_auto_styles_handmade.sql",
  ]) {
    const out = "deliverables/backups/preview-" + name;
    await writeFile(
      out,
      previewSql(await readFile("supabase/migrations/" + name, "utf8")),
    );
    await chmod(out, 0o600);
  }
  const files = [
    "preview-clone.sql",
    "preview-202610140001_profile_feed_rank.sql",
    "preview-202610140002_auto_styles_handmade.sql",
  ];
  const chunks = [];
  for (const file of files)
    chunks.push(
      (await readFile("deliverables/backups/" + file, "utf8"))
        .trim()
        .replace(/^begin;\s*/i, "")
        .replace(/commit;$/i, ""),
    );
  await writeFile(
    "deliverables/backups/preview-apply.sql",
    "begin;\n" + chunks.join("\n") + "\ncommit;\n",
  );
  await chmod("deliverables/backups/preview-apply.sql", 0o600);
  console.log(
    "Prepared private preview SQL; original row payloads preserved. No network or database changes.",
  );
}
if (
  process.argv[1]?.endsWith("/prepare-preview.mjs") ||
  process.argv[1] === "scripts/database/prepare-preview.mjs"
)
  await preparePreview();
