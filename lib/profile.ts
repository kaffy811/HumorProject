import { redirect } from 'next/navigation';
import { memberAuth } from '@/lib/member-auth';
export type Profile = { first_name: string | null; last_name: string | null; username: string | null; avatar_path: string | null };
export function profileComplete(profile: Profile | null) { return !!(profile?.first_name?.trim() && profile?.last_name?.trim() && profile?.username?.trim() && profile?.avatar_path); }
export async function requireMember(complete = true) {
  const { db, user } = await memberAuth();
  if (!user) redirect('/login');
  const { data: profile, error } = await db.from('profiles').select('first_name,last_name,username,avatar_path').eq('id', user.id).maybeSingle();
  if (error) throw new Error('Your profile could not be loaded. Please try again.');
  if (complete && !profileComplete(profile)) redirect('/profile');
  return { db, user, profile: profile as Profile | null };
}
