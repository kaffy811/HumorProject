"use client";
import { useEffect, useRef, useState } from "react";
import { REPORT_REASONS, type Post } from "@/lib/post-contracts";
import { deletePost, reportPost } from "@/lib/posts";
import { PostDialog } from "./PostDialog";
export function PostMenu({
  post,
  own,
  onDelete,
}: {
  post: Post;
  own: boolean;
  onDelete: () => Promise<void>;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [dialog, setDialog] = useState<"delete" | "report" | null>(null),
    [reason, setReason] = useState<string>(REPORT_REASONS[0]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && ref.current)
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function open(kind: "delete" | "report") {
    if (ref.current) {
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
    }
    setError("");
    setDialog(kind);
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (dialog === "delete") {
        await deletePost(post.id);
        await onDelete();
      } else {
        await reportPost(post.id, reason);
        setMessage("Report sent. The baby has been informed.");
      }
      setDialog(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div data-post-controls>
      <details
        className="post-options"
        ref={ref}
        onKeyDown={(e) => {
          if (e.key === "Escape" && ref.current) {
            ref.current.open = false;
            ref.current.querySelector("summary")?.focus();
          }
        }}
      >
        <summary aria-label="Post options">…</summary>
        <div className="post-popover">
          <button onClick={() => open(own ? "delete" : "report")}>
            {own ? "Delete" : "Report"}
          </button>
        </div>
      </details>
      {message && (
        <span className="sr-only" role="status">
          {message}
        </span>
      )}
      {dialog && (
        <PostDialog
          title={dialog === "delete" ? "Delete this post?" : "Report this post"}
          busy={busy}
          onClose={() => setDialog(null)}
        >
          {dialog === "delete" ? (
            <p>It will leave the feed. Your questionable judgment stays.</p>
          ) : (
            <label className="post-report-label">
              Reason
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="post-dialog-actions">
            <button className="comic-button" disabled={busy} onClick={submit}>
              {busy
                ? "Saving…"
                : dialog === "delete"
                  ? "Delete post"
                  : "Send report"}
            </button>
            <button
              className="comic-button is-secondary"
              disabled={busy}
              onClick={() => setDialog(null)}
            >
              Cancel
            </button>
          </div>
        </PostDialog>
      )}
    </div>
  );
}
