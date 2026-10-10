# Profiles + Google Gemini release · 2026-10-09 EDT

Implemented: nullable profiles with auth.users trigger/backfill, owner-only profile editing and private avatar upload, name onboarding, protected Profile/Studio/Feed pages, cookie-preserving OAuth callback, Google provider availability detection, Google Gemini image caption generation, exact per-generation prompt/config/model/image audit, atomic four-caption publication, sharing, Privacy and setup/PM feedback documentation.

Database 202610090001 applied successfully to wqkpatxsbxwjsupojjcq. No other repository/database/project modified.

Verified: production build and lint, input/model-response tests, local production HTTP auth/origin checks, original vote RLS rollback scenarios, new profile/nullable-trigger/avatar/prompt privacy/immutable-audit/atomic-publication/usage/RLS rollback scenarios. Test fixtures rolled back. No real AI request or Google login has run yet because owner credentials are not configured.

Pending at code release: owner enters Gemini key and Google OAuth Client ID/Secret; owner approval to disable Vercel deployment authentication; final deployment callback/anonymous HTTP check; real login/profile/photo/generation/vote persistence; course submission and same-repository continuity confirmation; real PM feedback/video evidence.

Release screenshot evidence and final deployment details are maintained in the workspace deliverables/humor-release-2026-10-09 folder.
