import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { createHash, randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { seedPosts, seedTarget } from "../lib/seed-validation";
import { prepareImage } from "../lib/media/prepare-image";
import { ensureLockedThumbnail } from "../lib/media/locked-thumbnail";
async function main() {
  const args = process.argv.slice(2),
    allowed = new Set(["--env", "--dry-run", "--manifest"]);
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw Error(`Unknown option: ${args[i]}`);
    if (args[i] !== "--dry-run") i++;
  }
  const value = (key: string) => {
      const i = args.indexOf(key);
      return i < 0 ? undefined : args[i + 1];
    },
    env = value("--env");
  if (env !== "production" && env !== "development")
    throw Error("Specify --env production or --env development.");
  const dry = args.includes("--dry-run"),
    root = resolve(fileURLToPath(new URL("..", import.meta.url))),
    manifest = resolve(
      root,
      value("--manifest") ||
        (env === "production"
          ? "seed/posts.json"
          : "seed/development/posts.json"),
    );
  const rootPath = await realpath(root),
    manifestPath = await realpath(manifest);
  if (relative(rootPath, manifestPath).startsWith(".."))
    throw Error("Manifest must be inside this project.");
  const imageRoot = await realpath(resolve(manifest, "..", "images")),
    entries = seedPosts(JSON.parse(await readFile(manifest, "utf8")), env);
  const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex"),
    babyHashes = new Set<string>(),
    placeholderHashes = new Set<string>();
  for (const folder of ["public/baby", "public/baby/bust"])
    for (const file of await readdir(resolve(root, folder))) {
      if (file.endsWith(".png"))
        babyHashes.add(hash(await readFile(resolve(root, folder, file))));
    }
  for (const file of await readdir(resolve(root, "seed/development/images")))
    placeholderHashes.add(
      hash(await readFile(resolve(root, "seed/development/images", file))),
    );
  const prepared = [];
  let openings = 0;
  for (const entry of entries) {
    const path = await realpath(resolve(imageRoot, entry.imageFile));
    if (
      relative(imageRoot, path).startsWith("..") ||
      relative(imageRoot, path).startsWith(sep)
    )
      throw Error(`Image escapes seed/images: ${entry.imageFile}`);
    if ((await stat(path)).size > 10_000_000)
      throw Error(`Image exceeds 10 MB: ${entry.imageFile}`);
    const source = await readFile(path),
      digest = hash(source),
      baby = babyHashes.has(digest),
      placeholder = entry.placeholder || placeholderHashes.has(digest);
    if (env === "production" && placeholder)
      throw Error(
        `Production refuses known placeholder bytes: ${entry.imageFile}`,
      );
    if (baby && entry.kind !== "opening")
      throw Error(
        `Mascot images are only for kind=opening: ${entry.imageFile}`,
      );
    if (entry.kind === "opening") {
      if (!baby)
        throw Error(
          `Opening posts must use the existing mascot: ${entry.imageFile}`,
        );
      openings++;
    }
    const image = await prepareImage(source);
    prepared.push({ entry: { ...entry, placeholder: !!placeholder }, image });
  }
  if (openings > 5 || (openings > 0 && openings < 3))
    throw Error("Provide 3–5 mascot opening posts together, or none.");
  console.log(
    `${dry ? "DRY RUN" : "IMPORT"} · ${env} · ${prepared.length} posts`,
  );
  for (const { entry, image } of prepared)
    console.log(
      JSON.stringify({
        imageFile: entry.imageFile,
        caption: entry.caption,
        style: entry.style,
        kind: entry.kind || "community",
        placeholder: entry.placeholder,
        imageSize: `${image.width}×${image.height}`,
        ha: 0,
        comments: 0,
      }),
    );
  if (dry) {
    console.log(
      "Validated upload normalization and publication inputs. No account, files or database rows were written.",
    );
    return;
  }
  if (!prepared.length) {
    console.log("No posts to import.");
    return;
  }
  const url =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    key =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw Error(
      "Configure the server Supabase URL and service key in your shell. Never put them in posts.json.",
    );
  seedTarget(env, url);
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const { entry, image } of prepared) {
    const reserve = await db.rpc("humor_reserve_seed", {
      image_file: entry.imageFile,
      environment: env,
      is_placeholder: entry.placeholder,
    });
    if (reserve.error)
      throw Error(
        `Could not reserve ${entry.imageFile}. Check migration and server permissions.`,
      );
    const r = reserve.data;
    if (r.status === "published") {
      console.log(`SKIP already imported: ${entry.imageFile}`);
      continue;
    }
    const upload = await db.storage
      .from("humor-images")
      .upload(r.imagePath, image.bytes, {
        contentType: image.mime,
        upsert: false,
      });
    if (upload.error) {
      const existing = await db.storage
        .from("humor-images")
        .download(r.imagePath);
      if (
        existing.error ||
        !existing.data ||
        createHash("sha256")
          .update(Buffer.from(await existing.data.arrayBuffer()))
          .digest("hex") !==
          createHash("sha256").update(image.bytes).digest("hex")
      )
        throw Error(
          `Upload conflict: ${entry.imageFile}. Existing media is preserved.`,
        );
    }
    await ensureLockedThumbnail(db, r.imageId, r.imagePath);
    const date = new Date(
      Date.now() - randomInt(60_000, 14 * 24 * 3600_000 - 60_000),
    ).toISOString();
    const post = await db.rpc("humor_publish_seed", {
      import_id: r.id,
      body: entry.caption,
      joke_style: entry.style,
      posted_at: date,
      width: image.width,
      height: image.height,
      object_path: r.imagePath,
    });
    if (post.error)
      throw Error(`Publication failed: ${entry.imageFile}. Re-run safely.`);
    console.log(`POSTED ${entry.imageFile}: ${post.data}`);
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed import failed.");
  process.exitCode = 1;
});
