export type Profile = {
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_path: string | null;
  updated_at?: string;
  onboarded_at?: string | null;
};
export function profileComplete(profile: Profile | null) {
  return !!(
    profile?.first_name?.trim() &&
    profile?.last_name?.trim() &&
    profile?.username?.trim()
  );
}
