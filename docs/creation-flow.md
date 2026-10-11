# Member shell and creation flow

The landing page and members share cream `#FFF4C2`, tomato `#EF513A`, ink `#20201E`, Arial Black display type, Arial body type, monospace labels and solid black shadows. Styles live in `app/members.css` and Tailwind tokens in `app/globals.css`.

Routes: `/feed`, `/create`, `/top`, `/post/[id]`, `/me` share `(members)/layout.tsx`. All except `/create` are deliberately placeholders in this iteration. Existing database content and voting components remain intact. `/profile` retains onboarding and editing; `/studio` redirects to `/create`; `/login` redirects to `/`. Next 16 uses `proxy.ts` for centralized middleware redirects. OAuth callbacks and public assets remain reachable. API handlers revalidate the Google session, profile, origin and resource ownership.

## Creation API

1. `POST /api/humor/uploads`: `{mimeType, bytes, filename}` → `{draftId, uploadId, path, token}`. Upload the original file directly to the private `humor-images` bucket using Supabase `uploadToSignedUrl`. Limit is 10,000,000 bytes. Browser MIME and actual server-decoded bytes must agree.
2. `POST /api/humor/uploads/[id]/complete`: validates the completed upload, decodes it with a 40MP pixel limit, produces a bounded 2048px normalized PNG, and records its SHA-256. GIF keeps its original animation for display; Gemini receives the first frame. Returns `{draftId, uploadId}`.
3. `generateCaptions` in `lib/generateCaptions.ts` calls `POST /api/humor/generate` with `{uploadId, style, context, requestId}`. Returns `{generationId, mode, candidates}` with exactly four candidate objects `{id,generationId,originalText,text,source}`. Context is limited to 120 Unicode code points. Exact prompts, settings, input SHA and model usage are recorded before publication. An image can have many audited generations. A single live generation may run per user; completed requests can be regenerated immediately. Daily quotas remain 10 per user and 100 globally.
4. `POST /api/humor/posts`: `{draftId,generationId,candidateId,content,idempotencyKey}` → `{postId,href}`. Content is 1–200 Unicode code points. The post ID is the saved caption ID, retaining compatibility with existing votes. Publication is an atomic, row-locked operation; repeated requests return the existing caption rather than inserting duplicates.

## Mock switch

Set server environment `CAPTION_GENERATION_MODE=mock` for local development or a preview deployment, restart and open `/create`. No Gemini API key is needed in mock mode; Supabase configuration and authenticated profile are still required for uploads. Four demo captions use the same contract and state transitions. Mock publication returns a demo detail URL without creating a public caption. Production Vercel deployments always use live Gemini even if the mock variable is accidentally set.

## State and navigation

Stores are created per member provider, not as server-global singletons. Binary images are stored only in Storage. Browser object URLs are temporary and revoked on replacement or unmount. Stale request completions are ignored. Regeneration keeps the selected edited candidate separately from the four fresh candidates. Failure preserves uploaded images and edits. Unpublished content triggers a modal for internal links and sign-out; Back uses a same-URL history sentinel, and refresh/close uses native beforeunload confirmation. After successful publication, guards are disabled and navigation occurs after 1.5 seconds.

## Mascot assets

Twelve bust PNGs are under `public/baby/bust/`. Generated with the built-in image_gen tool using the existing character as reference. Source paths and composition are recorded in `docs/bust-assets.json`; prompts in `docs/bust-prompts.json`. The giggle frame uses a pale yellow shirt following a rejected bare-torso output. No existing full-body landing assets were replaced. All frames are preloaded and decoded before display. Reduced motion disables squash, idle winks and CSS motion. `setMood(mood, 2500)` interrupts prior timers; duration `0` holds a busy mood until reset.

## Database migration and checks

`supabase/migrations/202610110001_creation_flow.sql` adds owner-only drafts, extends generation audit records, raises only the humor image bucket limit and provides service-role-only draft/generation/publication RPCs. Existing RLS remains in force. The obsolete automatic publication RPC is retired. Applied to project `wqkpatxsbxwjsupojjcq` through its SQL Editor.

`npm test` includes upload limits, Unicode length, stale response isolation, edit retention, failure recovery and mascot timer interruption. `tests/creation-database.sql` verifies publication/idempotence and RPC/draft privileges in a rolled-back transaction. Run `npm run lint`, `npx tsc --noEmit`, `npm run build` for release validation.
