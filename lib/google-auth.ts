import 'server-only';
import { config } from '@/lib/supabase/config';
export async function googleAvailable() {
  try {
    const { url, key } = config();
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const settings = await response.json();
    return settings.external?.google === true;
  } catch { return false; }
}
