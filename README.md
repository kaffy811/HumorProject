# Sidequest / HumorProject

An independent campus humor website for the Week 4 Caption Rating assignment. Repository: kaffy811/HumorProject. Supabase: wqkpatxsbxwjsupojjcq (Humor Project). Uses Next.js 16, React, Supabase Auth/Postgres/Storage, and a two-call OpenAI prompt chain.

## Run
1. `npm ci`
2. Copy `.env.example` to `.env.local` and configure this project's Supabase public key, server secret and OpenAI key.
3. Apply `supabase/migrations/202610020001_humor.sql` once in this project's SQL Editor.
4. `npm run dev`

`npm run lint`, `npm test`, and `npm run build` verify the app. Build explicitly uses Webpack for portability in local restricted environments. Deploy repository root as a new Vercel project named humor-project. Never deploy it to hello-world.

## Features
- Email/password account creation and sign-in, confirmed email callback, sign-out. Optional Google OAuth.
- Private member-only photo feed, own photos and unrated filters.
- Rotating daily photo prompt, using America/New_York dates.
- Preview and drag/drop JPEG/PNG/WebP uploads, up to 3 MB.
- Image → visible-scene description → four funny captions. Atomic persistence before publication.
- One immutable up/down vote per authenticated user per caption. Each vote is an INSERT, protected by database uniqueness and RLS.
- Quiet illustrated homepage example, clearly marked as an illustration. It is not a fake database result or fake vote count.

## Secrets and auth
Only NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and the optional NEXT_PUBLIC_GOOGLE_AUTH_ENABLED flag are client-visible. SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) and OPENAI_API_KEY belong only on the server.

In Supabase Auth URL Configuration set the new website's Site URL and add exact callback URLs for production, localhost and each commit URL you test. The app uses `/auth/callback`. For server-side email confirmation templates, `/auth/confirm?token_hash={{ .TokenHash }}&type=email` is supported.

Google is optional and hidden by default. Enable Google in this Supabase project, configure the Google OAuth client's callback to `https://wqkpatxsbxwjsupojjcq.supabase.co/auth/v1/callback`, then set NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true. The account owner must provide OAuth credentials. Email sign-in works independently.

Supabase's default email service has delivery/rate restrictions. Configure custom SMTP for reliable external/grader signups; do not disable email confirmation as a workaround. Signup confirmation links should be opened on the originating browser for the default PKCE flow, or configure the token-hash template above.

## Security model
All three public tables have RLS. No anonymous access to member photos, captions or votes. Users can see their own drafts and votes; published photos/captions are available to authenticated members. Clients cannot write image metadata, generate captions, edit votes or impersonate another user. Only the server secret can atomically publish a reservation and four captions. Storage allows only reserved paths under the uploading user's UUID. Objects remain private, accessed using one-hour signed URLs. Reload refreshes expired image links.

Reservation serializes per-user requests using a database lock, with one attempt/minute and ten/day. Failed attempts count toward the limit. Provider timeouts and malformed output fail closed, mark the reservation failed and attempt orphan cleanup. Hard process termination can leave an unpublished private reservation/object; a scheduled cleanup job is a future operational improvement.

## Project boundary
This app does not use Clearstock code routes, its database, or its Vercel project. No changes to HelloWorld are required. The empty Java IDE scaffold is unrelated to the Vercel web runtime and is preserved outside this checkout.
