import { requireMember } from '@/lib/profile';
import { Feed, type Photo, type Rating } from '@/components/feed';
export const dynamic = 'force-dynamic';
export default async function FeedPage() {
  const { db, user } = await requireMember();
  const { data: rows, error } = await db.from('humor_images').select('id,user_id,storage_path,description,created_at,humor_captions(id,content)').eq('status', 'ready').order('created_at', { ascending: false }).limit(24);
  const { data: votes, error: voteError } = await db.from('humor_votes').select('caption_id,value').eq('user_id', user.id);
  const photos: Photo[] = await Promise.all((rows || []).map(async row => {
    const { data } = await db.storage.from('humor-images').createSignedUrl(row.storage_path, 3600);
    return { ...row, url: data?.signedUrl || null };
  }));
  return <section className="member-page"><div className="section-heading"><div><span className="eyebrow">THE PEOPLE’S PUNCHLINES</span><h1>What deserves an encore?</h1></div><a className="button" href="/studio">Add your photo ↗</a></div>{error || voteError ? <div className="error-state" role="alert"><h2>The feed is taking a breather.</h2><p>Please refresh in a moment.</p></div> : <Feed photos={photos} votes={(votes || []) as Rating[]} userId={user.id} />}</section>;
}
