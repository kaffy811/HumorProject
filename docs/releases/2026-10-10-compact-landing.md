# Compact login landing

Move the “Poke the baby” hint above the character on desktop and mobile, with a downward-pointing arrow. Remove “Members only” and its separator; retain “Verified by Google”. Authentication, onboarding and RLS are unchanged.

Reduce the content width, headline, character, button and spacing. On short desktop viewports, use a smaller headline/character and omit the decorative copy note. The 1366×768 browser check fits the complete landing, ticker and footer within 768 pixels. At 390×844, the login action stays in the first viewport and the page has no horizontal overflow. The hint sits above the speech bubble and character on both layouts.

Validation: production build, TypeScript and lint; actual browser layout checks at desktop/mobile dimensions; deployed anonymous-page and protected-route checks. No new tests were added for this presentation-only change.

Evidence and final deployment details are saved outside the repository in `deliverables/humor-compact-2026-10-10`.
