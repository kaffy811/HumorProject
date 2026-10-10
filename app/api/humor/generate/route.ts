import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createClient as adminClient } from '@supabase/supabase-js';
import { config } from '@/lib/supabase/config';
import { imageType, sameOrigin } from '@/lib/humor-validation';
import { profileComplete } from '@/lib/profile';
import { geminiSettings, generateCaptions, SYSTEM_PROMPT, USER_PROMPT, GENERATION_CONFIG } from '@/lib/gemini';
export const maxDuration = 120;
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: 'Sign in to upload.' }, { status: 401 });
  const { data: profile, error: profileError } = await db.from('profiles').select('first_name,last_name,avatar_path').eq('id', user.id).maybeSingle();
  if (profileError) return Response.json({ error: 'Unable to load your profile. Please try again.' }, { status: 503 });
  if (!profileComplete(profile)) return Response.json({ error: 'Complete your name in Profile before generating.' }, { status: 403 });
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !process.env.GEMINI_API_KEY) return Response.json({ error: 'The caption studio is awaiting server configuration. Please try again later.' }, { status: 503 });
  if (process.env.AI_ENABLED === 'false') return Response.json({ error: 'New captions are temporarily paused. You can still vote on existing jokes.' }, { status: 503 });
  const { model } = geminiSettings();
  if (Number(request.headers.get('content-length')) > 3200000) return Response.json({ error: 'Use an image under 3 MB.' }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('image');
  if (!(file instanceof File) || !file.size || file.size > 3000000) return Response.json({ error: 'Choose a JPEG, PNG or WebP under 3 MB.' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = imageType(bytes);
  if (!mime || mime !== file.type) return Response.json({ error: 'Unsupported image format.' }, { status: 400 });
  const admin = adminClient(config().url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: id, error: reservation } = await db.rpc('reserve_humor_image');
  if (reservation || !id) return Response.json({ error: 'Please wait a minute between uploads; limit 10 per day. The studio may also have reached its daily capacity.' }, { status: 429 });
  const path = `${user.id}/${id}.${mime.split('/')[1]}`;
  let stage = 'upload';
  try {
    const { error: upload } = await db.storage.from('humor-images').upload(path, bytes, { contentType: mime, upsert: false });
    if (upload) throw upload;
    stage = 'prompt record';
    // Record exact text/config before a billable request; image bytes remain in Storage only.
    const { error: audit } = await admin.from('humor_generations').insert({
      image_id: id, user_id: user.id, provider: 'google', model,
      system_prompt: SYSTEM_PROMPT, user_prompt: USER_PROMPT, generation_config: GENERATION_CONFIG,
      image_path: path, image_mime: mime, image_sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    if (audit) throw audit;
    stage = 'Gemini';
    const result = await generateCaptions(bytes, mime);
    stage = 'publication';
    const { error: saved } = await admin.rpc('complete_humor_image', {
      image_id: id, owner: user.id, object_path: path, scene: result.description, lines: result.captions, usage: result.usage,
    });
    if (saved) throw saved;
    return Response.json({ ok: true, imageId: id });
  } catch {
    console.error('Caption generation failed', { stage, imageId: id });
    await admin.from('humor_generations').update({ status: 'failed', failure_stage: stage }).eq('image_id', id).eq('user_id', user.id);
    await admin.from('humor_images').update({ status: 'failed' }).eq('id', id).eq('user_id', user.id);
    await db.storage.from('humor-images').remove([path]);
    return Response.json({ error: 'We couldn’t finish your captions. Please try another image in a minute.' }, { status: 502 });
  }
}
