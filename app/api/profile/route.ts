import { memberAuth } from '@/lib/member-auth';
import { sameOrigin } from '@/lib/humor-validation';
import { profileFieldsFrom } from '@/lib/profile-validation';
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  const { db, user } = await memberAuth();
  if (!user) return Response.json({ error: 'Sign in to update your profile.' }, { status: 401 });
  let names;
  try { names = profileFieldsFrom(await request.json()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Invalid names.' }, { status: 400 }); }
  const { data, error } = await db.from('profiles').update(names).eq('id', user.id).select('id').maybeSingle();
  if (error?.code === '23505') return Response.json({ error: 'That username is taken. Try another.' }, { status: 409 });
  if (error || !data) return Response.json({ error: 'Your profile could not be saved. Please try again.' }, { status: 503 });
  return Response.json({ ok: true });
}
