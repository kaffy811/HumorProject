# Leaderboard

/top now includes Jokes and People boards, weekly/monthly/all-time windows, podiums, rank rows, and a fixed personal-standing bar. /u/[id] is an authenticated placeholder using the existing shell.

Both boards filter by publication time. All counts are current effective Ha, shared with feed/detail caches; reaction updates never move a row until the ranking refresh. People totals, post counts, and best posts use only eligible active posts. Zero-Ha entries are excluded when computing ranks. Weekly/monthly boundaries use America/New_York, including DST.

Migration 202610110007_leaderboard.sql adds private ranking snapshots and a service-only RPC. Full ranks are retained, while the response limits each board to 50. Snapshots expire after five minutes or the next calendar boundary. A transaction advisory lock permits a single builder; concurrent warm readers use the previous committed snapshot. Cold/rolled-over windows wait for their first builder. Every response hydrates current counts and the authenticated viewer's flags independently. Caption deletion invalidates all snapshots; existing author-only deletion checks and cleanup remain in force.

SWR stores one bundle per viewer/window, reuses it for both boards, keeps previous data during window changes, and checks expiry while /top is visible. Shared post-cache updates patch leaderboard counts without changing ranks, including rollback/idempotent response handling. Delete removes the card immediately and revalidates ranking bundles.

Validation: lint, full unit suite, production build; rollback-only database assertions for both ties, top-50 limits, real #60 personal ranks, window filtering, live Ha without rank changes, expired-snapshot rebuild/reuse, deletion invalidation, and service-only permissions. Local authenticated Google mock QA verified desktop 2/1/3 and mobile 1/2/3, no mobile overflow, row Ha without navigation, feed count synchronization, URL controls, preserving prior data during switches, and standing bar visibility/position. Mock data never changes public votes or posts.
