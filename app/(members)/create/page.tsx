import { memberAuth } from "@/lib/member-auth";
import { CreateFlow } from "@/components/create/CreateFlow";
export default async function CreatePage() {
  const { db, user } = await memberAuth();
  const { data: profile } = await db
    .from("profiles")
    .select("first_name,last_name,username,avatar_path")
    .eq("id", user!.id)
    .maybeSingle();
  const { data } = profile?.avatar_path
    ? await db.storage
        .from("humor-avatars")
        .createSignedUrl(profile.avatar_path, 3600)
    : { data: null };
  return (
    <CreateFlow
      author={{
        name:
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
          "You",
        username: profile?.username || "you",
        avatarUrl: data?.signedUrl || null,
      }}
    />
  );
}
