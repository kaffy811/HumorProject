import { requireMember, profileComplete } from '@/lib/profile';
import { ProfileForm } from '@/components/profile-form';
export const dynamic = 'force-dynamic';
export default async function ProfilePage() {
  const { db, profile } = await requireMember(false);
  const onboarding = !profileComplete(profile);
  const { data } = profile?.avatar_path ? await db.storage.from('humor-avatars').createSignedUrl(profile.avatar_path, 3600) : { data: null };
  return <section className="member-page profile-page"><span className="eyebrow">YOUR LITTLE CORNER OF THE CLUB</span><h1>{onboarding ? 'First, a proper introduction.' : 'Your profile.'}</h1><p className="page-intro">{onboarding ? 'Add your first and last name to finish joining. Then your camera roll gets the mic.' : 'Update your name or give your profile a new look.'}</p><ProfileForm profile={profile} avatarUrl={data?.signedUrl || null} onboarding={onboarding} />{!onboarding && <a className="text-link" href="/studio">Back to the caption studio ↗</a>}</section>;
}
