import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SignOut } from '@/components/auth-form';
import './globals.css';
export const metadata: Metadata={title:'Sidequest — Campus moments. Better punchlines.',description:'A little campus chaos, a little New York energy. Turn photos into funny captions and vote for the ones that land.'};
export default async function Layout({children}:{children:React.ReactNode}) {
 const db=await createClient(); const {data:{user}}=await db.auth.getUser();
 return <html lang="en"><body><header className="site-header"><Link className="brand" href="/"><span className="brand-mark">s↗</span>sidequest<span className="brand-tag">THE CAMPUS COMEDY CLUB</span></Link><nav aria-label="Main navigation"><Link href="/#feed">The feed</Link><Link href="/#studio">Make a caption</Link>{user?<SignOut/>:<Link className="nav-login" href="/login">Join the club ↗</Link>}</nav></header><main>{children}</main><footer><Link className="brand" href="/">sidequest<span className="footer-dot">✳</span></Link><p>AI brings the punchlines. You bring the taste.</p><span>Made for campus moments & city side quests.<br/>An independent student project.</span></footer></body></html>;
}
