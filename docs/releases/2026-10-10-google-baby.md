# Google entrance and Little Mao

The Humor Project now opens on a pale-yellow comic landing page with a single Google sign-in action. The CTA reads “Continue with Google”; the adjacent method label reads “Verified by Google”. Anonymous visitors and old email/password sessions cannot open the feed, studio or profile, or call the vote/generation/profile APIs.

Google OAuth returns to the exact application `/auth/callback` URL. New users must finish Profile (unique lowercase username, first and last names, uploaded avatar) before entering the feed or generating/voting. Nullable database names and the existing auth.users signup trigger are retained. Avatar image bytes stay in private Storage. A database trigger rejects fake avatar paths. Existing real accounts/content/votes are retained; accounts need Google authentication and any missing onboarding fields.

## Interactions

- Default smirk breathes gently; a wink occurs every random 4–6 seconds.
- Spring-delayed mouse tilt stays within ±8 degrees.
- Near CTA: welcoming pose and “Go on. You know you want to.” Hover or keyboard focus: giggle and button shake.
- Near the top edge / exiting upwards: cry and “Wow. Okay. Leaving a baby.” Losing button focus must not erase this state.
- Poke: huh → gasp → pout with squash/rebound. Five pokes in a rolling two-second window: smug, “Are you done?”
- Twenty seconds without interaction: sleepy and “I've had diapers more exciting than this.”
- Google action: angel → fullscreen heart transition → OAuth. Failed or unavailable OAuth stays on the landing page with a retry/status message.
- Eight extra bubble lines and five ticker jokes are in `lib/baby-machine.ts`. Ticker has a pause control.
- Mobile: tap reactions and opt-in device-orientation tilt, with permission-denial/unavailable-sensor fallback.
- `prefers-reduced-motion`: no breathing, tilt, squash, shake or ticker scrolling; login uses a brief fade. Text/poses remain interactive.

## Artwork

Generated with the built-in imagegen tool from the four user reference screenshots after explicit permission to create the missing originals. `public/baby/` contains all twelve expected PNG names. Eleven are independently generated character poses. The image service rejected the dedicated angel render: `angel.png` reuses the approved welcoming pose with a code-rendered golden halo. Pose prompts and provenance are saved in `docs/baby-assets.json`. PNGs contain no captions. White backgrounds blend using multiply; the outer stage must also blend because transformed layers create compositing contexts. No three.js is used.

## Security and deployment

Apply `supabase/migrations/202610100001_google_onboarding.sql` to **wqkpatxsbxwjsupojjcq only**, before deploying this code. Restrictive RLS intersects existing ownership and publication policies; all five tables and the two Humor storage buckets require an Auth-issued Google/OAuth session. Username uniqueness and real-avatar checks also run in the database. Existing generation capacity limits are retained. Only Google should be enabled as a social provider; email/password sessions are rejected by the app and RLS even if the email provider remains enabled for account continuity.

Credentials are an outstanding owner action: Supabase Google Provider was observed **disabled, with blank Client ID/Secret**, on 2026-10-10. The Gemini key is for generation, not Google sign-in. The owner must configure their own Web OAuth client in Google Cloud and privately enter credentials into Supabase. This release must not be described as having passed real Google signup/onboarding until that action and a browser login test are complete. See `docs/GOOGLE_SETUP.md`.

## Validation

Unit tests cover Google identity/AMR checks, newer-password rejection, username validation, incomplete-profile gating, every state transition, event priorities, rapid-poke windows and tilt bounds. Existing Gemini/image-validation tests retained. Production build and lint pass. All three SQL security scripts pass against the named database with rolled-back fixtures. Public HTTP tests verify no email/password form, protected-route redirects, anonymous API denial and cross-origin denial. Actual desktop/mobile browser observations and deployment evidence are stored outside the repository in `deliverables/humor-login-2026-10-10`.

References: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [JWT AMR fields](https://supabase.com/docs/guides/auth/jwt-fields), [Motion reduced motion](https://motion.dev/docs/react-use-reduced-motion).
