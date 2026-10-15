# Member feed

The feed reuses the paper/tomato/ink theme, member shell, mascot store and shared PostCard. Content clears the header and mascot overflow.

`lib/posts.ts` supports numbered Feed pages (`page`, `snapshot`, `limit:9`) and cursor-based private/profile streams. Post fields include dimensions, `@username`, current Ha/comments and private viewer Ha/save states. All protected APIs derive identity from verified Google Auth. Mutations require same-origin requests; only authors can delete posts.

Hot orders by Ha descending, then publication time descending, then ID descending. New orders by publication time descending, then ID descending. Viewer/sort-bound snapshots freeze IDs so voting cannot introduce duplicate or missing rows across pages. Expired snapshots return 410 and Retry obtains a fresh session. Publication/deletion invalidates sessions. Rows use a grid with 3 columns at 1024px, 2 at 640px and 1 below; each page has 9 cards and URL-backed page controls. Detail navigation remembers the original URL and reading position.

SWR caches sessions/pages per viewer and sort. `useContentCache` explicitly refetches inactive cached entries after publication/deletion/profile edits, including all previously fetched pages. New publications immediately appear on New page 1. A 60-second count-only poll displays an `N new` button; it never automatically inserts new content.

PostCard uses six-line feed captions, bounded image ratios and overlaid Ha/comment/save controls. Preview hides controls. Ha/save mutate optimistically and roll back on failure; server request IDs make retries idempotent. The first-save hint is recorded server-side. Share offers Copy link and watermarked PNG download. Full detail captions and leaderboard podium captions are unclamped; recommendation captions are clamped to three lines.

Local `CAPTION_GENERATION_MODE=mock` fixtures never write real posts, votes or media. Real Google login and a complete username/name profile remain required; avatars are optional. Vercel Preview requires isolated schema/buckets even when testing; Production always uses real data. Seed placeholders are rejected in production.

Checks: `npm test`, lint, TypeScript and build, plus private backup restoration/database regression via `node scripts/database/rehearse-backup.mjs`. Browser acceptance checks numbered pages, detail return, Save hint and account entry, publish-without-refresh, responsive layouts and image exports.
