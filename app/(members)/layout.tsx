import Link from 'next/link';
import { requireMember } from '@/lib/profile';
import { SignOut } from '@/components/auth-form';
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  await requireMember(false);
  return <><header className="site-header"><Link className="brand" href="/feed"><span className="brand-mark">h.</span>The Humor Project</Link><nav aria-label="Main navigation"><Link href="/feed">The feed</Link><Link href="/studio">Make a caption</Link><Link href="/profile">Profile</Link><SignOut /></nav></header><main>{children}</main><footer><Link className="brand" href="/feed">The Humor Project</Link><p>You bring the photos. We question your judgment.</p><Link href="/privacy">Privacy</Link></footer></>;
}
