import { postOg } from "@/lib/post-og";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(
  _r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const bytes = await postOg((await params).id);
    return bytes
      ? new Response(bytes as BodyInit, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        })
      : new Response(null, { status: 404 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
