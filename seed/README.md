# Official content

Production starts with an empty `posts.json`. Add your approved captions and images to `seed/images/`.

Each row has `imageFile`, `caption`, and `style`. Styles: Deadpan, Roast, Pun, Dad joke, Absurd, Wholesome. Captions: 1–200 characters.

Only the 3–5 Little Mao introductions may use existing mascot PNGs: copy them into `seed/images/` and mark those rows `"kind": "opening"`. Other rows use your own photos, with `"kind": "community"` (or omit kind). Filenames are unique import keys. Changing a caption does not re-import that filename; deleting a post does not resurrect it on a rerun.

Local placeholders live separately in `seed/development/` and are marked `"placeholder": true`. Production refuses placeholder flags, indicative filenames, known placeholder file hashes, and mascot images outside opening posts. Do not disguise placeholder images as real photos.

Run:

```
npm run seed -- --env development --dry-run
npm run seed -- --env production --dry-run
```

Dry-run validates every image through the shared normalization pipeline and prints the proposed content. It creates no account, uploads no files, and writes no database rows. Production currently prints zero entries until you provide content.

Actual importing later uses the same command without `--dry-run`, with server-only Supabase credentials in the shell environment. Production only accepts the existing wqkpatxsbxwjsupojjcq project URL; development imports only accept local Supabase. A failed import can be retried. Ha and comments are never seeded; all initial counts are zero. Dates are distributed randomly within the preceding 14 days. Seeded captions are explicitly marked `source=seed` and do not invent Gemini generations or prompts.
