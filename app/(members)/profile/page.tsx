import { storageBucket } from "@/lib/supabase/schema";
import { requireMember, profileComplete } from '@/lib/profile';
import { ProfileForm } from '@/components/profile-form';
export const dynamic = 'force-dynamic';
export default async function ProfilePage() {
  const { db, profile, user } = await requireMember(false);
  const onboarding = !profileComplete(profile);
  const { data } = profile?.avatar_path ? await db.storage.from(storageBucket("humor-avatars")).createSignedUrl(profile.avatar_path, 3600) : { data: null };
  return <section className="member-page profile-page"><span className="eyebrow">YOUR LITTLE CORNER OF THE CLUB</span><h1>{onboarding ? 'First, a proper introduction.' : 'Your profile.'}</h1><p className="page-intro">{onboarding ? 'Choose a username, add your name and optionally add a photo. Then your camera roll gets the mic.' : 'Update your username, name or profile photo.'}</p><ProfileForm profile={profile} avatarUrl={data?.signedUrl || null} googlePhotoUrl={user.identities?.find(i=>i.provider==='google')?.identity_data?.picture || null} onboarding={onboarding} />{!onboarding && <a className="text-link" href="/studio">Back to the caption studio ↗</a>}</section>;
}
