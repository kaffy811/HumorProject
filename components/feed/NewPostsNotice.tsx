export function NewPostsNotice({
  count,
  busy,
  onClick,
}: {
  count: number;
  busy: boolean;
  onClick: () => void;
}) {
  return count > 0 ? (
    <button
      className="comic-button new-posts-notice"
      disabled={busy}
      onClick={onClick}
    >
      {busy ? "Refreshing…" : `${count} new`}
    </button>
  ) : null;
}
