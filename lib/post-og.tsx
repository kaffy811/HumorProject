import { downloadStoredFile } from "@/lib/media/preview-storage";
import { storageBucket } from "@/lib/supabase/schema";
/* eslint-disable @next/next/no-img-element */
import "server-only";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { publicAdmin, publicPost, excerpt } from "./post-public";
import { mockEnabled } from "./studio-server";
export async function postOg(id: string) {
  const p = await publicPost(id);
  if (!p) return null;
  const mock = mockEnabled(),
    db = mock ? null : publicAdmin();
  if (db && p.ogPath) {
    const { data } = await downloadStoredFile(db, "humor-previews", p.ogPath);
    if (data) return new Uint8Array(await data.arrayBuffer());
  }
  const source = mock
    ? await readFile(`${process.cwd()}/public${p.imagePath}`)
    : await (async () => {
        const { data, error } = await downloadStoredFile(
          db!,
          "humor-images",
          p.imagePath,
        );
        if (error || !data) throw new Error("Missing image");
        return Buffer.from(await data.arrayBuffer());
      })();
  const small = await sharp(source, {
    animated: false,
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize(510, 510, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toBuffer();
  const image = new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#fff4c2",
        color: "#20201e",
        padding: 48,
        gap: 44,
        fontFamily: "sans-serif",
      }}
    >
      <img
        alt=""
        src={`data:image/jpeg;base64,${small.toString("base64")}`}
        width={510}
        height={510}
        style={{ border: "2px solid #20201e", objectFit: "cover" }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: 3,
            color: "#ef513a",
          }}
        >
          THE HUMOR PROJECT
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 46,
            fontWeight: 700,
            lineHeight: 1.15,
            wordBreak: "break-word",
          }}
        >
          {excerpt(p.caption, 60, true)}
        </div>
        <div style={{ display: "flex", fontSize: 22 }}>by {p.authorName}</div>
        <div
          style={{
            display: "flex",
            fontSize: 44,
            fontWeight: 700,
            color: "#ef513a",
          }}
        >
          h.
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
  const bytes = new Uint8Array(await image.arrayBuffer());
  if (db) {
    // Storage is the cache. Every HTTP request still checks deletion before serving it.
    const { data: active } = await db
      .from("humor_captions")
      .select("id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!active) return null;
    const path = `${id}/og.png`,
      { error } = await db.storage
        .from(storageBucket("humor-previews"))
        .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw error;
    const { error: update } = await db
      .from("humor_captions")
      .update({ og_path: path })
      .eq("id", id)
      .is("deleted_at", null);
    if (update) throw update;
  }
  return bytes;
}
