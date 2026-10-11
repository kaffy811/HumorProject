import { memberAuth } from "@/lib/member-auth";
import { AppShell } from "@/components/shell/AppShell";
import { MOODS } from "@/stores/mascot-store";
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
      .select("first_name,last_name,username,avatar_path")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw new Error("Your profile could not be loaded. Try again.");
    const { data } = profile?.avatar_path
      ? await db.storage
          .from("humor-avatars")
          .createSignedUrl(profile.avatar_path, 3600)
      : { data: null };
    author = {
      name:
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        "You",
      username: profile?.username || "new_member",
      avatarUrl: data?.signedUrl || null,
    };
  }
  return (
    <>
      {MOODS.map((mood) => (
        <link
          key={mood}
          rel="preload"
          as="image"
          href={`/baby/bust/${mood}.png`}
        />
      ))}
      <AppShell author={author} viewerId={user?.id || "guest"}>
        {children}
      </AppShell>
    </>
  );
}
