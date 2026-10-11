export function LeaderboardSkeleton() {
  return (
    <div
      className="leaderboard-loading"
      role="status"
      aria-label="Loading leaderboard"
    >
      <div className="leaderboard-podium">
        {[1, 2, 3].map((rank) => (
          <div key={rank} className="comic-card leaderboard-skeleton">
            <div className="skeleton-line short" />
            <div className="skeleton-photo" />
          </div>
        ))}
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="leaderboard-row-skeleton">
          <div className="skeleton-line" />
        </div>
      ))}
    </div>
  );
}
