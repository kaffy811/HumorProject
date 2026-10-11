import { publicPost, publicAdmin } from "@/lib/post-public";
import { mockEnabled } from "@/lib/studio-server";
import { readFile } from "node:fs/promises";
export async function GET(
  _r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params,
      p = await publicPost(id);
    if (!p) return new Response(null, { status: 404 });
    const bytes = mockEnabled()
      ? await readFile(`${process.cwd()}/public/baby/locked-preview.webp`)
      : await (async () => {
          if (!p.thumbnailPath) return null;
          const { data, error } = await publicAdmin()
            .storage.from("humor-previews")
            .download(p.thumbnailPath);
          if (error || !data) return null;
          return Buffer.from(await data.arrayBuffer());
        })();
    if (!bytes) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
