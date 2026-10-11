export function FeedSkeleton({ count }: { count: number }) {
  return (
    <div
      className="feed-skeleton-grid"
      role="status"
      aria-label="Loading posts"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="feed-skeleton comic-card" aria-hidden="true">
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
          <div className="skeleton-photo" />
          <div className="skeleton-line" />
        </div>
      ))}
    </div>
  );
}
