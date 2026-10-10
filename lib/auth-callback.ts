import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { config } from '@/lib/supabase/config';
import { profileComplete } from '@/lib/profile';
import { isGoogleSession } from '@/lib/google-session';
export async function finishAuth(request: NextRequest, mode: 'code' | 'email') {
  const response = NextResponse.redirect(new URL('/feed', request.url));
  response.headers.set('Cache-Control', 'private, no-store');
  const { url, key } = config();
  const db = createServerClient(url, key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll: values => {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  } });
  const incoming = new URL(request.url);
  const code = incoming.searchParams.get('code');
  const result = mode === 'code' && code ? await db.auth.exchangeCodeForSession(code)
    : null;
  if (!result || result.error) {
    response.headers.set('Location', new URL('/login?error=callback', request.url).toString());
    return response;
  }
  const { data: { user } } = await db.auth.getUser();
  const { data: verified, error: claimsError } = await db.auth.getClaims();
  if (claimsError || !isGoogleSession(user, verified?.claims)) {
    await db.auth.signOut();
    response.headers.set('Location', new URL('/login?error=google', request.url).toString());
  }
  else {
    const { data: profile, error } = await db.from('profiles').select('first_name,last_name,username,avatar_path').eq('id', user!.id).maybeSingle();
    if (error || !profileComplete(profile)) response.headers.set('Location', new URL('/profile', request.url).toString());
  }
  return response;
}
