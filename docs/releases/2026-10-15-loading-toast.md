# Header image loading and report confirmation

The member header previously preloaded twelve 1254×1254 PNG expressions totaling 20,898,078 bytes. It now preloads twelve 336×336 transparent WebP derivatives totaling 106,182 bytes, a 99.49% reduction. The 336px assets cover the 112px CSS rendering at 3× density. Original artwork remains available; the header's displayed, decoded and preloaded URLs share `mascotImage()` and use only the derivatives. Default smirk has high preload priority; other expressions have low priority. Removed the redundant client-side preload loop, retaining the layout preloads and decode-before-switch behavior.

Reproduce derivatives with `node --import tsx scripts/optimize-mascot.ts`. Images preserve their square composition and alpha channel; no character redesign or CSS geometry change.

Successful post reports now call the same global feedback provider as comment reports, sharing and save messages. The visible, dismissible toast retains its polite screen-reader status. Failed reports keep the existing dialog/error so users can retry; no success toast is emitted for a failed request.

Validation: production build (including TypeScript), lint and all existing tests passed. A local browser fixture mounts the actual AppShell, Mascot, PostCard, PostMenu and feedback provider; its report endpoints terminate locally without Supabase writes. Verified success, simulated 503 then successful retry, dialog closure, visible status, toast dismissal and 375/768/1280px layouts without horizontal overflow or broken images. On mobile the toast remains above the existing bottom navigation. Pokes switched huh → annoyed → smirk with the WebP assets.

The local server limited all expression downloads to a shared 50,000 bytes/sec with 400ms latency. In a fresh mobile-width session, the twelve transfers totaled 106,182 bytes and finished in 2,583ms from the first image request. This measures expression downloads in a simulation, not overall production page speed, a Lighthouse score or a real handset/network test.

No database migration, authentication or storage-policy change. No real report was submitted for verification.
