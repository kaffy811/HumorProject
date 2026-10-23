# Compact card action footer — 2026-10-23

All four card actions (Like, Dislike, Comments, Save) now sit in a single row below the photograph, inside the card border. Counts sit inline with their icons. Icons are slightly smaller while keyboard focus styles and 44px minimum hit targets remain. Image overlays are removed.

The same footer appears on Feed, recommendations, profile collections, podium cards and post detail. Detail no longer duplicates reactions above Comments; its footer Comment button still scrolls to the comment section and focuses the composer. Creation previews remain action-free. Reaction animation, persistence, mutual exclusion, saving, rollback Toasts and share export filtering reuse the existing implementation. No database change.

Validation: TypeScript, lint, existing regression suite and production build pass. Actual component fixtures at 375px and 1280px show four controls on the same row, footer directly after the image and no horizontal overflow.
