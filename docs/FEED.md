# Member feed

The feed reuses the landing page's paper/tomato/ink theme, member shell, mascot store and the creator's PostCard. The shared header now blends the baby into its paper backdrop; content clears the header and mascot overflow by 48px.

## Data and pagination

`lib/posts.ts` is the browser facade. It exposes `listPosts({sort, cursor, limit: 12})`, `toggleHa(postId)`, `deletePost(postId)`, `reportPost(postId, reason)` and a count-only new-post check. Post objects include original image dimensions, public author display fields, totals and the viewer's Ha state. All API routes verify Google authentication and a complete profile. Mutations validate same-origin requests and derive identity from the session.

`supabase/migrations/202610110003_feed.sql` adds dimensions, style, soft deletion, private report/comment tables, user-bound pagination snapshots and service-only functions. Hot sorting runs in SQL using `haCount / (ageHours + 2)^1.5`. A 20-minute snapshot freezes post IDs/order while votes change, preventing duplicates/skips across pages. Expired cursors return 410 with a refresh action. Images and avatars use authenticated stable media routes that redirect to five-minute Storage URLs; paths and service credentials never enter the browser bundle.

Ha toggles use an advisory lock and per-request idempotency key. A repeat of the same request returns the saved result. Authors can soft-delete their own posts; removed posts disappear from reads and voting. Reports have one row per viewer/post and are private. Comment counts are wired for later implementation; this release does not add a comment editor or moderation dashboard.

## Client behavior

SWR Infinite caches both sorts inside the member layout, scoped to the viewer. Zustand stores loaded-page counts and scroll positions. Mutation results patch page and aggregate caches across both sorts. Manual new-post refresh updates both caches before paging resumes. A 60-second check changes only the `N new` button, never the reading order.

The masonry keeps a flat, chronological DOM order, assigning successive items to columns left-to-right. ResizeObserver measures heights; image aspect ratios reserve space. Breakpoints are 3 columns at 1024px, 2 at 640px and 1 below. The 600px sentinel loads another 12 posts; first-load and pagination skeleton counts are 6 and 3. Navigation back restores the cached feed and scroll position. End-of-feed enters the mascot's pout state.

PostCard owns author/time/style, six-line caption, proportionally cropped image and accessible controls. Preview mode hides all controls. Ha updates optimistically and rolls back on failure. Native dialogs confirm deletion or collect a report reason. Share offers a copied member-only detail link and a PNG export with the site's logo watermark. Export moves an offscreen clone to the SVG origin before rasterizing, including authenticated image redirects; export errors preserve the feed.

## Mock and checks

The existing `CAPTION_GENERATION_MODE=mock` switch also enables an isolated per-user feed fixture outside Vercel Production. It offers 30 posts, three pages, mock votes/deletion/reports and one synthetic new post on the first poll. No public votes or posts change. Use `CAPTION_GENERATION_MODE=mock VERCEL_ENV=preview npm run dev -- --port 3001` after adding `http://localhost:3001/auth/callback` to this project's redirect allowlist. Real Google login and Profile are still required. Vercel Production always uses real data.

`npm test` verifies sorting/cropping/time formatting and mock cursor isolation. `tests/feed-database.sql` runs real pagination, voting/retry, soft-deletion and private-function checks inside a rolled-back transaction. Browser acceptance covers keyboard voting, failure rollback, sort caching, multi-page loading, back navigation, reports, new-post refresh, responsive layout and rendered PNG content. Build/lint also check the shared creator preview. Next.js and its ESLint configuration are updated together to 16.3.8.
