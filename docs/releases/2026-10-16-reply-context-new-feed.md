# Make reply relationships explicit and default Feed to New

Replies now show the actual parent comment's text in a compact quote, with a link back to that parent and a visible level label. The composer quotes the selected reply target too, so comments by the same author remain distinguishable. Sibling replies align at the same inset; stronger guide lines and spacing after nested branches make the return to a sibling clearer. Comment relationships remain based on parent IDs, never display order or author names. Missing/deleted parents do not show another comment's text. The existing three-level creation limit is unchanged.

Feed tabs are ordered New, Hot. `/feed` defaults to New; explicit `?sort=hot` remains Hot through refresh and pagination. The posts endpoint also defaults to New when sort is omitted; existing sort-specific cache keys and detail return positions remain.

Validation: lint, TypeScript, complete tests and production build passed. The comment regression reproduces one root, its reply, a third-level reply, then a fourth comment answering the root again: the second and fourth comments stay siblings under both Top/New. Actual-component fixtures at 1280/768/375px verify equal sibling insets, a deeper third comment, the fourth quote linking to the root, no horizontal overflow, and New selected before Hot. No database migration or live comment writes.
