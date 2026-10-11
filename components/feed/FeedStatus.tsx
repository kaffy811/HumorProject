import Link from "next/link";
export function FeedStatus({
  kind,
  message,
  onRetry,
}: {
  kind: "empty" | "end" | "error";
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="feed-status" role={kind === "error" ? "alert" : undefined}>
      <p>
        {kind === "empty"
          ? "Nothing here yet. Be the first to embarrass yourself."
          : kind === "end"
            ? "That's all of it. Go make something."
            : message}
      </p>
      {kind === "error" ? (
        <button className="comic-button" onClick={onRetry}>
          Retry
        </button>
      ) : (
        <Link className="comic-button" href="/create">
          Create
        </Link>
      )}
    </div>
  );
}
