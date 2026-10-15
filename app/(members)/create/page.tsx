import { storageBucket } from "@/lib/supabase/schema";
import { mockEnabled } from "@/lib/studio-server";
import { memberAuth } from "@/lib/member-auth";
import { CreateFlow } from "@/components/create/CreateFlow";
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { db, user } = await memberAuth();
  const { data: profile } = await db
    .from("profiles")
    .select(
      "first_name,last_name,username,avatar_path,onboarded_at",
    )
    .eq("id", user!.id)
    .maybeSingle();
  const { data } = profile?.avatar_path
    ? await db.storage
        .from(storageBucket("humor-avatars"))
        .createSignedUrl(profile.avatar_path, 3600)
    : { data: null };
  const query = await searchParams;
  return (
    <CreateFlow
      welcome={
        query.welcome === "1" && (!profile?.onboarded_at || mockEnabled())
      }
      author={{
        name:
          `@${profile?.username || "new_member"}`,
        username: profile?.username || "you",
        avatarUrl: data?.signedUrl || null,
      }}
    />
  );
}
