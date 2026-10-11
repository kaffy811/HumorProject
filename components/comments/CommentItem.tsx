/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useAnimationControls } from "framer-motion";
import type { Comment } from "@/lib/comment-contracts";
import { relativeTime, REPORT_REASONS } from "@/lib/post-contracts";
import { toggleCommentHa, reportComment } from "@/lib/comments";
import { PostDialog } from "@/components/posts/PostDialog";
import { usePostFeedback } from "@/components/feed/FeedCacheProvider";
export function CommentItem({
  comment,
  viewerId,
  op,
  highlighted,
  onReply,
  onDelete,
  onPatch,
}: {
  comment: Comment;
  viewerId: string;
  op: string;
  highlighted: boolean;
  onReply: () => void;
  onDelete: () => Promise<void>;
  onPatch: (change: Partial<Comment>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<"delete" | "report" | null>(null),
    [reason, setReason] = useState<string>(REPORT_REASONS[0]),
    [error, setError] = useState(""),
    [avatarFailed, setAvatarFailed] = useState(false);
  const lock = useRef(false),
    options = useRef<HTMLDetailsElement>(null),
    reduced = useReducedMotion(),
    controls = useAnimationControls(),
    { notify } = usePostFeedback(),
    pending = comment.id.startsWith("pending-");
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (options.current && !options.current.contains(event.target as Node))
        options.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  async function ha() {
    if (lock.current || pending) return;
    lock.current = true;
    setBusy(true);
    if (!reduced)
      void controls.start({
        scaleY: [1, 0.9, 1],
        transition: { duration: 0.25 },
      });
    const previous = {
      haCount: comment.haCount,
      viewerHasHa: comment.viewerHasHa,
    };
    try {
      await onPatch({
        haCount: Math.max(0, comment.haCount + (comment.viewerHasHa ? -1 : 1)),
        viewerHasHa: !comment.viewerHasHa,
      });
      await onPatch(await toggleCommentHa(comment.id));
    } catch (e) {
      await onPatch(previous);
      notify(
        e instanceof Error ? e.message : "Your Ha didn’t stick. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (dialog === "delete") await onDelete();
      else {
        await reportComment(comment.id, reason);
        notify("Report sent. The baby has been informed.");
      }
      setDialog(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <li
      className={`comment-item ${highlighted ? "is-highlighted" : ""}`}
      aria-busy={pending}
    >
      <div className="comment-avatar">
        {comment.author.avatarUrl && !avatarFailed ? (
          <img
            src={comment.author.avatarUrl}
            alt=""
            width={32}
            height={32}
            loading="lazy"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <span aria-hidden="true">{comment.author.name.slice(0, 1)}</span>
        )}
      </div>
      <div className="comment-content">
        <div className="comment-meta">
          <strong>{comment.author.name}</strong>
          {comment.author.id === op && (
            <span className="comic-label comment-op">OP</span>
          )}
          <time dateTime={comment.createdAt}>
            {relativeTime(comment.createdAt)}
          </time>
          {pending && <span>Sending…</span>}
        </div>
        <p className="comment-body">
          {comment.replyTo && (
            <span className="comment-mention">
              @{comment.replyTo.authorName}{" "}
            </span>
          )}
          {comment.body}
        </p>
        <div className="comment-actions">
          <motion.button
            animate={controls}
            transition={{ duration: 0.25 }}
            onClick={() => void ha()}
            aria-pressed={comment.viewerHasHa}
            className={comment.viewerHasHa ? "is-active" : ""}
            disabled={busy || pending}
          >
            Ha · {comment.haCount}
          </motion.button>
          <button onClick={onReply} disabled={pending}>
            Reply
          </button>
          <details
            ref={options}
            className="comment-options"
            onKeyDown={(e) => {
              if (e.key === "Escape" && options.current) {
                options.current.open = false;
                options.current.querySelector("summary")?.focus();
              }
            }}
          >
            <summary
              aria-label={`Options for ${comment.author.name}'s comment`}
            >
              …
            </summary>
            <div className="post-popover">
              <button
                disabled={pending}
                onClick={() => {
                  if (options.current) {
                    options.current.open = false;
                    options.current.querySelector("summary")?.focus();
                  }
                  setError("");
                  setDialog(
                    comment.author.id === viewerId ? "delete" : "report",
                  );
                }}
              >
                {comment.author.id === viewerId ? "Delete" : "Report"}
              </button>
            </div>
          </details>
        </div>
      </div>
      {dialog && (
        <PostDialog
          title={
            dialog === "delete" ? "Delete this comment?" : "Report this comment"
          }
          busy={busy}
          onClose={() => setDialog(null)}
        >
          {dialog === "delete" ? (
            <p>The comment goes. Its replies stay.</p>
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
            <button
              className="comic-button"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy
                ? "Saving…"
                : dialog === "delete"
                  ? "Delete comment"
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
    </li>
  );
}
