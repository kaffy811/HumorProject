import { featureFailure } from "@/lib/member-feature-server";
import { postsContext } from "@/lib/posts-server";
import { sameOrigin } from "@/lib/humor-validation";
import { stageProfileAvatar } from "@/lib/profile-server";
import { StudioError } from "@/lib/studio-server";
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new StudioError("Invalid origin.", 403);
    const ctx = await postsContext(),
      identity = ctx.user.identities?.find((i) => i.provider === "google"),
      raw =
        identity?.identity_data?.avatar_url || identity?.identity_data?.picture;
    if (typeof raw !== "string")
      throw new StudioError(
        "Google did not provide a photo. Choose one instead.",
      );
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      !/(^|\.)googleusercontent\.com$/.test(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    )
      throw new StudioError("That Google photo is unavailable.");
    const r = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok || Number(r.headers.get("content-length")) > 5_000_000)
      throw new StudioError("Google photo could not be loaded.");
    const reader = r.body?.getReader();
    if (!reader) throw new StudioError("Google photo could not be loaded.");
    const chunks = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 5_000_000) {
        await reader.cancel();
        throw new StudioError("Google photo is too large.");
      }
      chunks.push(part.value);
    }
    return Response.json(await stageProfileAvatar(ctx, Buffer.concat(chunks)));
  } catch (e) {
    return featureFailure(e);
  }
}
