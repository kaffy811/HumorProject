import { googleAvailable } from '@/lib/google-auth';
import { BabyLanding } from '@/components/baby-landing';
export const dynamic = 'force-dynamic';
export default async function Landing({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <BabyLanding googleEnabled={await googleAvailable()} callbackError={!!error} />;
}
