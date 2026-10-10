'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
export function SignOut() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const router = useRouter();
  return <><button className="nav-login" disabled={busy} onClick={async () => {
    setBusy(true); const { error } = await createClient().auth.signOut();
    if (error) { setError('Could not sign out. Try again.'); setBusy(false); }
    else { router.replace('/'); router.refresh(); }
  }}>{busy ? 'Signing out…' : 'Sign out ↗'}</button>{error && <span role="alert">{error}</span>}</>;
}
