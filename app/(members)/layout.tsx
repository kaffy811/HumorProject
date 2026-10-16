import { memberAuth } from "@/lib/member-auth";
import { AppShell } from "@/components/shell/AppShell";
import { MOODS } from "@/stores/mascot-store";
import { mascotImage } from "@/lib/mascot-assets";
export const dynamic = "force-dynamic";
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { db, user } = await memberAuth();
  let author = null;
  if (user) {
    const { data: profile, error } = await db
      .from("profiles")
      .select("first_name,last_name,username,avatar_path,updated_at")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw new Error("Your profile could not be loaded. Try again.");
    author = {
      name: `@${profile?.username || "new_member"}`,
      username: profile?.username || "new_member",
      avatarUrl: profile?.avatar_path
        ? `/api/profiles/${user.id}/avatar?v=${profile.updated_at}`
        : null,
    };
  }
  return (
    <>
      {MOODS.map((mood) => (
        <link
          key={mood}
          rel="preload"
          as="image"
          href={mascotImage(mood)}
          type="image/webp"
          fetchPriority={mood === "smirk" ? "high" : "low"}
        />
      ))}
      <AppShell author={author} viewerId={user?.id || "guest"}>
        {children}
      </AppShell>
    </>
  );
}
