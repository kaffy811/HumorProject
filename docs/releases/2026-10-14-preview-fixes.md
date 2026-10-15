# Profile, feed, rankings and creation corrections

Delivery branch: `fix/profile-feed-creation-preview`. Production must remain at its existing commit until the owner accepts the preview.

## Changes

- Shared initial/edit profile form: optional avatar, Google photo/remove, square crop, editable unique username and first/last names. Public author fields use `@username`; real names appear only in profile headers. Desktop dialog is centered and mobile uses a bottom sheet.
- Account menu adds Saved. The server persists the one-time first-save hint. Welcome Skip writes onboarding completion before routing to Feed.
- Feed uses row grids, 9 posts/page and URL sort/page parameters. Hot uses current Ha descending, publication time descending, ID descending. New uses publication time descending, ID descending. A viewer-bound ID snapshot prevents vote changes from shifting subsequent pages; manual refresh, publication and deletion replace snapshots. Detail return restores page/scroll position. New-post polling remains manual to avoid disrupting reading.
- Publication, deletion and profile edits refresh inactive as well as active SWR entries: both Feed sorts and cached pages, personal streams/statistics, recommendations, details and rankings. New publications are inserted immediately into New page 1. Route cache is refreshed as well.
- Rankings use rolling 168/720-hour windows, include zero-Ha posts/users and version their server snapshot cache. Jokes tie by earliest publication then ID; People tie by fewer posts then user ID. Current counts are shared without immediate rank changes. Podium text is complete, cards align at the bottom, numbers sit outside, and smaller podiums are centered.
- Creator has AI/manual modes. AI selects a style per option; validation requires exactly four distinct, nonempty captions of at most 200 Unicode characters with allowed styles and retries malformed output once. Handmade posts skip generation, use HANDMADE and pass the same server moderation check as edited AI posts. Moderation approvals bind user, draft and caption hash; database publication requires a fresh approval. Upload completion opens and focuses step 2. Failure preserves the draft.
- Recommendations use three equal-width cards of at least 300px on desktop and horizontal scrolling on smaller screens. Three-line captions have no padding inside the clamped box. Empty comments keep the composer directly after the empty message. Toasts are bottom-centered and mobile clears navigation.

## Preview isolation and backup

`HUMOR_DATA_SCHEMA=humor_preview` is required on Vercel Preview; missing configuration fails closed. Production rejects any other schema. Tables/functions/RLS and three private media buckets are isolated. Existing Google Auth accounts are reused, with separate application profiles in preview. Existing images are copied lazily into preview buckets by server code, reading production objects without modifying them. New preview media is never written to production buckets.

A private application backup was exported before migration and restored into in-memory PostgreSQL. It includes 23 tables, data, functions, constraints, indexes, triggers, RLS and grants. Auth accounts and Storage are external dependencies, not exported credentials or complete Supabase disaster-recovery backups. Private backup SQL and checksums are ignored by Git. No remote migration is permitted until the isolation operation receives approval.

Canonical migrations:
- `202610140001_profile_feed_rank.sql`
- `202610140002_auto_styles_handmade.sql`

Only schema/bucket-rewritten copies may run for Preview. Canonical `public` migrations are deferred until production acceptance.

## Validation

Automated coverage includes AI validation/retry, optional avatars, handmade state transitions, author-only deletion, feed snapshot isolation, rolling ranks/zero-Ha, private saves, comments/replies, notification grouping, server avatar crop and seed placeholder rejection. `tests/content-cache.mjs` reproduces publication while Feed is unmounted, then checks returning to cached Feed without reload, all pages/related caches and deletion. `scripts/database/rehearse-backup.mjs` restores the backup, applies both migrations and runs rollback-only database regression tests.

Read-only fixtures using the existing components and compiled CSS passed 48 viewport/page combinations (including one/two-person podiums) at 1280px, 768px and 375px: no root horizontal scroll/text overflow; recommendation widths/clipping and podium bottom alignment also passed. These fixtures do not test authentication or live APIs. Live Preview acceptance is pending configuration and Google login. Never treat a successful build as proof of a configured database or a real Gemini request.

Vercel built preview commit `7170e68` successfully; production remains on `ed8a91c`. Required branch-specific secrets and approval for the remote isolation migration are pending. Google authentication in local browser testing reached Columbia CAS and requires the owner to finish that login; static fixture checks do not bypass authentication.
