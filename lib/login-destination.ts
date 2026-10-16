import { profileComplete, type Profile } from "./profile-complete";
import { safeReturnPath } from "./auth-return";

export function loginDestination(profile: Profile | null, returnTo?: unknown) {
  if (!profileComplete(profile)) return "/profile";
  const target = safeReturnPath(returnTo);
  // Post links retain their destination; ordinary sign-in goes straight home.
  return target && /^\/post\/[^/]+$/.test(new URL(target, "https://humor.invalid").pathname)
    ? target
    : "/feed";
}
