import { mockSaveProfile } from "@/lib/mock-profiles";
import { postsContext } from "@/lib/posts-server";
import { displayName } from "@/lib/profile-contracts";
import { validUuid } from "@/lib/create-contracts";
import { studioFailure } from "@/lib/studio-server";
import { memberAuth } from "@/lib/member-auth";
import { sameOrigin } from "@/lib/humor-validation";
import { profileFieldsFrom } from "@/lib/profile-validation";
export async function PATCH(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const { db, user } = await memberAuth();
  if (!user)
    return Response.json(
      { error: "Sign in to update your profile." },
      { status: 401 },
    );
  const input = await request.json().catch(() => null);
  if (input && Object.hasOwn(input, "displayName")) {
    try {
      const name = displayName(input.displayName);
      if (input.avatarUploadId && !validUuid(input.avatarUploadId))
        return Response.json({ error: "Invalid avatar." }, { status: 400 });
      const ctx = await postsContext();
      if (ctx.mock)
        return Response.json(
          mockSaveProfile(user.id, name, input.avatarUploadId),
        );
      const saved = await ctx.admin.rpc("humor_save_profile", {
        owner: user.id,
        new_name: name,
        upload_id: input.avatarUploadId || null,
      });
      if (saved.error) throw saved.error;
      const result = await ctx.admin.rpc("humor_profile_summary", {
        profile_id: user.id,
        viewer: user.id,
      });
      if (result.error) throw result.error;
      return Response.json(result.data, {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch (e) {
      return e instanceof Error && /characters|name/.test(e.message)
        ? Response.json({ error: e.message }, { status: 400 })
        : studioFailure(e);
    }
  }
  let names;
  try {
    names = profileFieldsFrom(input);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid names." },
      { status: 400 },
    );
  }
  const { data, error } = await db
    .from("profiles")
    .update(names)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error?.code === "23505")
    return Response.json(
      { error: "That username is taken. Try another." },
      { status: 409 },
    );
  if (error || !data)
    return Response.json(
      { error: "Your profile could not be saved. Please try again." },
      { status: 503 },
    );
  return Response.json({ ok: true });
}
