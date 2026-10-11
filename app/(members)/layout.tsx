import { requireMember } from "@/lib/profile";
import { AppShell } from "@/components/shell/AppShell";
import { MOODS } from "@/stores/mascot-store";
export const dynamic = "force-dynamic";
export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { db, profile, user } = await requireMember(false);
  const { data } = profile?.avatar_path
    ? await db.storage
        .from("humor-avatars")
        .createSignedUrl(profile.avatar_path, 3600)
    : { data: null };
  const author = {
    name:
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      "You",
    username: profile?.username || "new_member",
    avatarUrl: data?.signedUrl || null,
  };
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
      <AppShell author={author} viewerId={user.id}>
        {children}
      </AppShell>
    </>
  );
}
