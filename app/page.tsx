import { redirect } from 'next/navigation';
import { memberAuth } from '@/lib/member-auth';
import { profileComplete } from '@/lib/profile';
import { googleAvailable } from '@/lib/google-auth';
import { BabyLanding } from '@/components/baby-landing';
export const dynamic = 'force-dynamic';
export default async function Landing({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { db, user } = await memberAuth();
  if (user) {
    const { data: profile, error } = await db.from('profiles').select('first_name,last_name,username,avatar_path').eq('id', user.id).maybeSingle();
    if (error) throw new Error('Your profile could not be loaded. Please try again.');
    redirect(profileComplete(profile) ? '/feed' : '/profile');
  }
  const { error } = await searchParams;
  return <BabyLanding googleEnabled={await googleAvailable()} callbackError={!!error} />;
}
