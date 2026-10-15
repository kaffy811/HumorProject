"use client";
export function FeedPagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total < 2) return null;
  const pages = Array.from({ length: total }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === total || Math.abs(n - page) <= 2,
  );
  return (
    <nav className="feed-pagination" aria-label="Feed pages">
      <button
        className="comic-button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        ← Prev
      </button>
      {pages.map((n, i) => (
        <span key={n}>
          {i > 0 && n - pages[i - 1] > 1 && <span aria-hidden="true">…</span>}
          <button
            className={`page-number ${n === page ? "is-selected" : ""}`}
            aria-current={n === page ? "page" : undefined}
            aria-label={`Page ${n}`}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        </span>
      ))}
      <button
        className="comic-button"
        disabled={page >= total}
        onClick={() => onPage(page + 1)}
      >
        Next →
      </button>
    </nav>
  );
}
