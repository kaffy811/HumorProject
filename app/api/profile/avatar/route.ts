import { randomUUID } from 'node:crypto';
import { memberAuth } from '@/lib/member-auth';
import { imageType, sameOrigin } from '@/lib/humor-validation';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  const { db, user } = await memberAuth();
  if (!user) return Response.json({ error: 'Sign in to upload a profile photo.' }, { status: 401 });
  if (Number(request.headers.get('content-length')) > 2200000) return Response.json({ error: 'Use a photo under 2 MB.' }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('photo');
  if (!(file instanceof File) || !file.size || file.size > 2000000) return Response.json({ error: 'Choose a JPEG, PNG or WebP under 2 MB.' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = imageType(bytes);
  if (!mime || mime !== file.type) return Response.json({ error: 'Unsupported image format.' }, { status: 400 });
  const { data: profile, error: readError } = await db.from('profiles').select('avatar_path').eq('id', user.id).maybeSingle();
  if (readError || !profile) return Response.json({ error: 'Your profile could not be loaded.' }, { status: 503 });
  const path = `${user.id}/${randomUUID()}.${mime.split('/')[1]}`;
  const bucket = db.storage.from('humor-avatars');
  const { error: upload } = await bucket.upload(path, bytes, { contentType: mime, upsert: false });
  if (upload) return Response.json({ error: 'Your photo could not be uploaded. Please try again.' }, { status: 503 });
  const { data: updated, error } = await db.from('profiles').update({ avatar_path: path }).eq('id', user.id).select('id').maybeSingle();
  if (error || !updated) {
    await bucket.remove([path]);
    return Response.json({ error: 'Your photo could not be saved. Please try again.' }, { status: 503 });
  }
  if (profile.avatar_path) await bucket.remove([profile.avatar_path]);
  const { data: signed } = await bucket.createSignedUrl(path, 3600);
  return Response.json({ ok: true, avatarUrl: signed?.signedUrl || null });
}
