import { requireMember } from '@/lib/profile';
import { Studio } from '@/components/studio';
export const dynamic = 'force-dynamic';
export default async function StudioPage() {
  await requireMember();
  return <><div className="member-page member-intro"><span className="eyebrow">MEMBERS GET THE MIC</span><h1>Find the funny in your day.</h1><p className="page-intro">One real photo. Four fresh punchlines. You decide what lands.</p></div><Studio signedIn /><div className="member-page member-outro"><a className="text-link" href="/feed">See the latest captions ↗</a></div></>;
}
