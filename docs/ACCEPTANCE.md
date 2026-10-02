# Acceptance record — October 2, 2026

## Isolation
Repository: kaffy811/HumorProject. Supabase: wqkpatxsbxwjsupojjcq. All new database changes applied only there. The public schema was empty before this migration. No changes to HelloWorld/Clearstock or hello-world-db in this restarted task.

## Verified
- ESLint, TypeScript and production build passed.
- File-signature validation accepts JPEG/PNG/WebP and rejects SVG/non-images.
- Caption response validation rejects missing, duplicate, blank and overlong captions.
- Local production HTTP: landing/login load; anonymous vote and upload return 401; foreign/missing Origin returns 403.
- Database rollback test (tests/rls.sql): anonymous vote/reservation denied; legitimate own-user vote inserted; duplicate rejected; forged user denied; vote UPDATE denied; client caption INSERT denied; other user cannot read votes or unfinished photo; published captions visible; another user can rate the same caption; every public table has RLS.
- Desktop homepage visually inspected with a labeled illustrative photo, genuine sign-in gates and daily prompt.

## Still requires verification after credentials
- A real account signup, email confirmation, sign-in and sign-out.
- Storage upload, signed download, failed-chain cleanup using a real authenticated session.
- Real OpenAI description then captions; persisted gallery; UI voting and persistence after refresh.
- New Vercel deployment, public incognito access and commit-specific callback.

## Required external configuration
- GitHub prompted the owner to re-enter their password before changing the Vercel App repository selection. Only HumorProject is approved to be added.
- SUPABASE_SECRET_KEY may be saved only to the new Vercel project, explicitly approved by the user.
- OPENAI_API_KEY must be supplied securely; it is not available in the repository or local environment.
- Supabase Auth Site URL and exact redirects must reference the new app; Google is optional and disabled until configured.

Do not call the credential-dependent checks passed until they actually run. The code never fabricates a successful AI generation or saved vote.
