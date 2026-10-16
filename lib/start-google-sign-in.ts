"use client";
import { createClient } from "@/lib/supabase/client";
import { safeReturnPath } from "./auth-return";

export async function googleSignInUrl(returnTo = "/feed") {
  const target = safeReturnPath(returnTo);
  if (!target) throw new Error("Could not prepare sign-in. Try again.");
  // Starting from the landing page replaces any abandoned post return cookie.
  const saved = await fetch("/auth/return", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
    cache: "no-store",
  });
  if (!saved.ok) throw new Error("Could not prepare sign-in. Try again.");
  const { data, error } = await createClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${location.origin}/auth/callback`,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url)
    throw new Error("Google sign-in did not finish. Try again.");
  return data.url;
}
