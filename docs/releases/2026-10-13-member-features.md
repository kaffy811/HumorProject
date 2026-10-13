# Profiles, notifications, onboarding and official seeds

The podium now displays full captions with naturally sized, bottom-aligned cards. Rank badges sit outside the top-left corner without obscuring authors, including at a 390px mobile viewport.

Member profiles share a header and paginated post stream. Saved posts remain private to the current authenticated Google user. Display names are independent of first/last names and usernames. Profile editing updates cached post/comment authors, reply mentions and the global avatar. Uploaded photos are square-cropped in the browser, then normalized to 256×256 WebP on the server; restoring the authenticated Google identity's photo uses the same server pipeline.

Notifications are written by database triggers, never trusted to the browser. Self-actions are excluded; unread Ha events merge by recipient and post. Un-Ha removes its unread event; reading freezes a batch so later Ha events create a new batch. Reply recipients take priority when they also own the post. Soft/hard deletions clear related events. A daily pg_cron job physically removes notifications older than 90 days. Member RLS exposes only the recipient's recent notifications; profile flags, pending avatar uploads and all privileged RPCs remain server-only.

Existing complete profiles received onboarded_at. New complete profiles enter /create?welcome=1, except that a pending post return is honored first. Skip and successful publication finish onboarding. First publication and its one-time detail notice are recorded atomically/idempotently. A non-login official Little Mao identity renders HOST; it has no email, password or OAuth identity.

## Seed content

Production `seed/posts.json` intentionally contains an empty array. The user will supply opening captions and photos in `seed/images/`. Use the mascot only for 3–5 entries marked `kind: "opening"`. Other entries require other images. No production seed post, fabricated Ha, comment or user was imported.

```
npm run seed -- --env development --dry-run
npm run seed -- --env production --dry-run
```

Actual development imports require local Supabase, never the production project. Production rejects explicitly flagged, recognizable filenames and known placeholder assets, including renamed copies of the development assets. File paths are confined to the manifest's images directory. Media is normalized and a stored blurred thumbnail is generated before publication. Import reservations deduplicate imageFile; existing uploaded bytes must match on a retry and are never overwritten. Source is recorded as seed, without inventing an AI generation or prompt. Publication dates span the preceding 14 days.

## Validation

- Lint, TypeScript, all eight unit suites and production build passed.
- Both dry-run manifests passed without database/storage writes; production refusal of development placeholders passed.
- `tests/member-database.sql` passed in the live project's SQL editor, within a rollback-only transaction: notification merge/read/un-Ha/reply/deletion lifecycle, profile statistics/current author projection, recipient isolation and protected flags.
- `tests/onboarding-seed-database.sql` passed with all fixtures rolled back: first publication/idempotence/onboarding/one-time notice, deduplicated seed reservation, production placeholder refusal, non-login official identity, two-page notifications and 90-day cleanup.
- Local mock UI verified name edits and cached/header updates, the menu edit link while already on /me, Google photo restore to 256×256, private Saved empty state, merged notification display/read badge clearing, welcome dismissal and Skip to feed.
- Podium measurements at 1280px confirmed equal bottom positions with unequal heights and no caption clamp. At 390px, all three rank badges had zero intersection with author areas.
- Server image tests covered square cropping, 256×256 WebP and out-of-bounds rejection without Storage writes. The browser extension's file-URL permission prevented automated local file selection; Google photo restore was tested through the UI.

Migrations 202610130001–202610130005 were applied to the existing Supabase project. Local mock editing and notifications do not mutate production records.
