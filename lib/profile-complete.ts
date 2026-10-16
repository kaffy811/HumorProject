export type Profile = {
  username: string | null;
  avatar_path: string | null;
  updated_at?: string;
  onboarded_at?: string | null;
};
export function profileComplete(profile: Profile | null) {
  return !!profile?.username && /^[a-z0-9_]{3,24}$/.test(profile.username);
}
