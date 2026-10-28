# The Humor Project

An independent campus humor app: upload a photo, get four Google Gemini captions, and vote on the ones that land. Next.js 16 / TypeScript / Tailwind / Framer Motion / Supabase Auth, Postgres and private Storage.

Repository: kaffy811/HumorProject. Database: wqkpatxsbxwjsupojjcq. Vercel: humor-project8/humor-project. Never deploy to or modify Clearstock/hello-world.

## Run

1. `npm ci`
2. Copy `.env.example` to `.env.local`; configure this project's Supabase public URL/key, server secret and Gemini key.
3. Apply migrations in order on a fresh database. The existing Humor Project database already has the checked-in migrations; do not re-run them.
4. `npm run dev`

Checks: `npm test`, `npm run lint`, `npm run build`. Start a production server with `npm run start -- --hostname 127.0.0.1 --port 3006`, then run `node tests/public-http.mjs`. SQL rollback tests live in tests/rls.sql, tests/profiles-generations-rls.sql and tests/google-onboarding-rls.sql.

## Features

- Google-only sign-in from an interactive Little Mao comic landing page. Exact app callback: /auth/callback. Old email/password sessions are rejected.
- Automatic nullable-name profile creation on new accounts; backfill for existing accounts. First login prompts for a unique username, both names and an uploaded avatar.
- Protected /profile, /studio and /feed pages. A private profile photo can be uploaded and replaced.
- A five-step creator accepts JPEG/PNG/WebP/GIF up to 10 MB, starts private uploads immediately, generates four editable candidates, preserves an edited selection during regeneration and publishes atomically.
- One structured image request generates four captions. The model and prompt come from the Humor Admin prompt-chain mix (Gemini or OpenAI), falling back to the built-in Gemini prompt; see [admin model routing](docs/releases/2026-10-29-admin-model-routing.md). Prompts/configuration/model/image reference are saved before the provider call; atomic publication associates the real captions with their image and audit record.
- One INSERT vote per Google-authenticated member with a complete profile per caption, with uniqueness, ownership and RLS. Duplicate requests return the saved vote.
- The member feed offers server-ranked Hot/New sorting, cached infinite scrolling, Ha toggles, private reports, author deletion, manual new-post insertion and watermarked PNG sharing. Creator previews use the same PostCard. See [feed implementation and acceptance](docs/FEED.md).

## Security and operations

All public tables have RLS, with restrictive Google-session gates. Users cannot read others' profiles, avatars, vote histories or prompt records; only published photo/caption content is shared among members. Clients cannot write captions, change identity, rewrite generation logs or publish generations. Service credentials and GEMINI_API_KEY remain server-only. Images stay in private Storage; the database stores paths/text, not binary image data. A cancelled or failed provider call never becomes a fake successful generation.

Reservations enforce one attempt/minute and ten/rolling 24 hours per user, 100/rolling 24 hours globally. AI_ENABLED=false pauses generation after redeploy. These caps do not replace provider-level budgets. Hard process termination can leave unpublished processing records; no automatic cleanup schedule is configured yet.

## External configuration and acceptance

See [Google setup](docs/GOOGLE_SETUP.md), [product choices and real PM feedback checklist](docs/PRODUCT_AND_FEEDBACK.md) and [latest login release](docs/releases/2026-10-10-google-baby.md). Configuring a real Gemini key and Google OAuth client requires the account owner. Do not call real AI generation or Google OAuth passed until those flows actually run.
