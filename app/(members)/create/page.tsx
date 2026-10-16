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
    .select("username,avatar_path,onboarded_at,updated_at")
    .eq("id", user!.id)
    .maybeSingle();
  const query = await searchParams;
  return (
    <CreateFlow
      welcome={
        query.welcome === "1" && (!profile?.onboarded_at || mockEnabled())
      }
      author={{
        name: `@${profile?.username || "new_member"}`,
        username: profile?.username || "you",
        avatarUrl: profile?.avatar_path
          ? `/api/profiles/${user!.id}/avatar?v=${profile.updated_at}`
          : null,
      }}
    />
  );
}
