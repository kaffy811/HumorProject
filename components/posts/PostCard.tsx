/* eslint-disable @next/next/no-img-element -- Blob previews, animated GIFs and private signed URLs are intentionally rendered directly. */
import { ComicCard } from "@/components/ui/ComicCard";
import type { Author } from "@/lib/create-contracts";
export function PostCard({
  imageUrl,
  caption,
  author,
}: {
  imageUrl: string;
  caption: string;
  author: Author;
}) {
  return (
    <ComicCard className="post-card">
      <img className="post-image" src={imageUrl} alt="Uploaded photo" />
      <p className="post-caption">
        {caption || "A punchline goes here. No pressure."}
      </p>
      <div className="post-author">
        {author.avatarUrl ? (
          <img src={author.avatarUrl} width={28} height={28} alt="" />
        ) : (
          <div className="post-author-placeholder" aria-hidden="true">
            {author.name.slice(0, 1)}
          </div>
        )}
        <div>
          <strong>{author.name}</strong>
          <span>@{author.username}</span>
        </div>
      </div>
    </ComicCard>
  );
}
