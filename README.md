# Sidequest / HumorProject

An independent campus humor app: upload a photo, get four Google Gemini captions, and vote on the ones that land. Next.js 16 / React / Supabase Auth, Postgres and private Storage.

Repository: kaffy811/HumorProject. Database: wqkpatxsbxwjsupojjcq. Vercel: humor-project8/humor-project. Never deploy to or modify Clearstock/hello-world.

## Run

1. `npm ci`
2. Copy `.env.example` to `.env.local`; configure this project's Supabase public URL/key, server secret and Gemini key.
3. Apply migrations in order on a fresh database. The existing Humor Project database already has both migrations; do not re-run them.
4. `npm run dev`

Checks: `npm test`, `npm run lint`, `npm run build`. Start a production server with `npm run start -- --hostname 127.0.0.1 --port 3006`, then run `node tests/public-http.mjs`. SQL rollback tests live in tests/rls.sql and tests/profiles-generations-rls.sql.

## Features

- Email signup/sign-in plus Google OAuth when the owner enables it in Supabase. Exact app callback: /auth/callback.
- Automatic nullable-name profile creation on new accounts; backfill for existing accounts. First login prompts for both names.
- Protected /profile, /studio and /feed pages. A private profile photo can be uploaded and replaced.
- JPEG/PNG/WebP upload preview, up to 3 MB; private member-only generated photo feed.
- One structured Gemini image request generates the scene description and four captions. Prompts/configuration/model/image reference are saved before the provider call; atomic publication associates the real captions with their image and audit record.
- One INSERT vote per authenticated user per caption, with uniqueness, ownership and RLS. Duplicate requests return the saved vote.
- Newest, unrated and own-photo filters, daily weekday prompt, caption sharing and a Privacy page.

## Security and operations

All five public tables have RLS. Users cannot read others' profiles, avatars, vote histories or prompt records; only published photo/caption content is shared among members. Clients cannot write captions, change identity, rewrite generation logs or publish generations. Service credentials and GEMINI_API_KEY remain server-only. Images stay in private Storage; the database stores paths/text, not binary image data. A cancelled or failed provider call never becomes a fake successful generation.

Reservations enforce one attempt/minute and ten/rolling 24 hours per user, 100/rolling 24 hours globally. AI_ENABLED=false pauses generation after redeploy. These caps do not replace provider-level budgets. Hard process termination can leave unpublished processing records; no automatic cleanup schedule is configured yet.

## External configuration and acceptance

See [Google setup](docs/GOOGLE_SETUP.md), [product choices and real PM feedback checklist](docs/PRODUCT_AND_FEEDBACK.md) and [release record](docs/releases/2026-10-09-profiles-gemini.md). Configuring a real Gemini key and Google OAuth client requires the account owner. Do not call real AI generation or Google OAuth passed until those flows actually run.
