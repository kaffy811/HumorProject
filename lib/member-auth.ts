import { ensurePreviewProfile } from "@/lib/preview-profile";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isGoogleSession } from "@/lib/google-session";

export async function memberAuth() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { db, user: null };
  const { data, error } = await db.auth.getClaims();
  const verified = !error && isGoogleSession(user, data?.claims);
  if (verified) await ensurePreviewProfile(user.id);
  return { db, user: verified ? user : null };
}
