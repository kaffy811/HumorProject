import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { isGoogleSession } from '@/lib/google-session';

export async function memberAuth() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { db, user: null };
  const { data, error } = await db.auth.getClaims();
  return { db, user: !error && isGoogleSession(user, data?.claims) ? user : null };
}
