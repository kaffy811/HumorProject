import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
export default function Loading() {
  return (
    <section className="post-detail-page">
      <div className="detail-grid">
        <div>
          <FeedSkeleton count={1} />
        </div>
        <div
          className="comments-loading"
          aria-label="Loading comments"
          aria-busy="true"
        >
          {[0, 1, 2].map((i) => (
            <div className="comment-skeleton" key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
