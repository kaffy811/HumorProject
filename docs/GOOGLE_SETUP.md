# Google AI Studio + Google login setup

These are two separate Google credentials. Never put either API keys or OAuth secrets in Git or chat.

## Gemini image captions

Vercel project: humor-project8/humor-project, Production environment.

1. Google AI Studio → API keys → use/create a key for this project.
2. Vercel → Settings → Environment Variables → add **GEMINI_API_KEY** as **Secret**, Production.
3. Optional **GEMINI_MODEL** is a non-secret Config. Default: `gemini-3.8-flash`. Set the exact model available to your Google project. The current official image-understanding guide documents this model; older 2.5 models have restricted availability for new projects.
4. Redeploy after saving. Environment variables do not update an already-built deployment.
5. Supabase server credentials are already configured in Vercel. Do not expose the secret/service-role key as NEXT_PUBLIC_.
6. Real acceptance: sign in, complete Profile, upload a photo, see four generated captions, vote, refresh, check records.

Gemini runs on the server only. The browser never sees the key. One structured image request returns a description and four captions. Exact system/user prompts, generation settings, model, image file reference/SHA-256 and usage metadata are saved in humor_generations. Binary image bytes are held in private Storage only. Reservations cap attempts at one per minute and ten per rolling 24 hours per user, and 100 per rolling 24 hours across the app. Failed attempts count. These are request caps, not a dollar-spend guarantee. `AI_ENABLED=false` plus redeploy pauses new generations.

## Google sign-in

1. Google Cloud Console → select a project you own → Google Auth Platform.
2. Configure app branding/audience. For grading by people outside your organization, avoid an Internal-only audience. In Testing mode, add intended test users. Use basic openid/email/profile scopes.
3. Clients → create a **Web application** OAuth client.
4. Authorized JavaScript origin: `https://humor-project-lac.vercel.app`.
5. Authorized redirect URI **in Google Cloud**: `https://wqkpatxsbxwjsupojjcq.supabase.co/auth/v1/callback`.
6. Supabase Humor Project → Authentication → Sign In / Providers → Google → paste Client ID and Client Secret and enable Google. The owner enters credentials privately.
7. Supabase → Authentication → URL Configuration:
   - Site URL: `https://humor-project-lac.vercel.app`
   - Redirect URLs: `https://humor-project-lac.vercel.app/auth/callback`
   - Add the exact final deployment URL + `/auth/callback` when it is available.
   - For local testing, add `http://127.0.0.1:3006/auth/callback` if needed.
8. Reload /login. The Google button appears automatically when Supabase reports Google enabled; there is no separate NEXT_PUBLIC_GOOGLE_AUTH_ENABLED flag to manage.
9. App redirectTo is exactly `${origin}/auth/callback`, without additional query parameters. Supabase first receives Google's result at its own callback, then returns to the app callback. These two URLs serve different hops of the same OAuth flow.
10. Test sign-out → Google login → name prompt → Profile → Studio, including on the final submission deployment.

## Database migration

202610090001_profiles_gemini.sql was applied to wqkpatxsbxwjsupojjcq on 2026-10-09. Do not run it twice. New projects apply the original migration first, then the new one. The auth.users trigger creates nullable-name profiles; existing accounts were backfilled. All five public application tables have RLS. Avatar objects are private and owner-only.

## Deployment protection and submissions

The application has its own authentication. Vercel Standard Protection still requires Vercel login on commit deployment URLs until the owner approves disabling it. Verify with a request containing no cookies: the commit URL must return the app, not a Vercel SSO redirect. The final commit-specific application URL, not the vercel.com dashboard URL or rolling production alias, goes in Submissions.

Earlier submissions all point to hello-world. This repository must remain isolated from Clearstock/hello-world per its AGENTS.md. Only the course PM can confirm whether a separate repository is accepted as the continuation. Do not rewrite the previous application or assignment history to hide this difference.

## Required human evidence

IntelliJ cloning can be completed through Get from VCS using https://github.com/kaffy811/HumorProject. Opening a terminal-cloned folder in the IDE is not proof of cloning via IntelliJ. Viewing the required course video and attending/iterating on a real PM feedback session are human participation requirements; code cannot establish them.

Official references:
- https://ai.google.dev/gemini-api/docs/generate-content/image-understanding
- https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- https://ai.google.dev/gemini-api/docs/models
- https://supabase.com/docs/guides/auth/social-login/auth-google
