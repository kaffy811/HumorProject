"use client";
import { safeReturnPath } from "./auth-return";

export async function googleSignInUrl(returnTo = "/feed") {
  const target = safeReturnPath(returnTo);
  if (!target) throw new Error("Could not prepare sign-in. Try again.");
  // Navigate before creating PKCE state. Production deployment URLs must reach
  // the same host Supabase returns to, or their host-only verifier is lost.
  return `/auth/start?next=${encodeURIComponent(target)}`;
}
