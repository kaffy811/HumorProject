import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { config } from '@/lib/supabase/config';
import { profileComplete } from '@/lib/profile';
export async function finishAuth(request: NextRequest, mode: 'code' | 'email') {
  const response = NextResponse.redirect(new URL('/studio', request.url));
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
  const token = incoming.searchParams.get('token_hash');
  const result = mode === 'code' && code ? await db.auth.exchangeCodeForSession(code)
    : mode === 'email' && token && incoming.searchParams.get('type') === 'email' ? await db.auth.verifyOtp({ token_hash: token, type: 'email' }) : null;
  if (!result || result.error) {
    response.headers.set('Location', new URL('/login?error=callback', request.url).toString());
    return response;
  }
  const { data: { user } } = await db.auth.getUser();
  if (!user) response.headers.set('Location', new URL('/login?error=callback', request.url).toString());
  else {
    const { data: profile, error } = await db.from('profiles').select('first_name,last_name,avatar_path').eq('id', user.id).maybeSingle();
    if (error || !profileComplete(profile)) response.headers.set('Location', new URL('/profile', request.url).toString());
  }
  return response;
}
