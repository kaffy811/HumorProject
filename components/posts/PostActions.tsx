"use client";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import type { Post } from "@/lib/post-contracts";
import { toggleHa } from "@/lib/posts";
import { downloadPost } from "./PostExport";
export function PostActions({
  post,
  onUpdate,
  card,
}: {
  post: Post;
  onUpdate: (change: Partial<Post> | null) => Promise<void>;
  card: React.RefObject<HTMLDivElement | null>;
}) {
  const [busy, setBusy] = useState(false),
    [exporting, setExporting] = useState(false),
    [message, setMessage] = useState(""),
    menu = useRef<HTMLDetailsElement>(null),
    controls = useAnimationControls(),
    reduced = useReducedMotion();
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && menu.current)
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  async function ha() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const previous = { haCount: post.haCount, viewerHasHa: post.viewerHasHa };
    if (!reduced)
      void controls.start({
        scaleY: [1, 0.9, 1],
        transition: { duration: 0.28 },
      });
    await onUpdate({
      viewerHasHa: !post.viewerHasHa,
      haCount: post.haCount + (post.viewerHasHa ? -1 : 1),
    });
    try {
      await onUpdate(await toggleHa(post.id));
    } catch (e) {
      await onUpdate(previous);
      setMessage(
        e instanceof Error ? e.message : "Could not save your Ha. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/post/${post.id}`);
      setMessage("Link copied. Go ruin a group chat.");
      if (menu.current) menu.current.open = false;
    } catch {
      setMessage("Could not copy the link. Try again.");
    }
  }
  async function download() {
    if (exporting || !card.current) return;
    setExporting(true);
    setMessage("");
    try {
      await downloadPost(card.current, post.id);
      if (menu.current) menu.current.open = false;
      setMessage("Downloaded. Evidence secured.");
    } catch {
      setMessage("The image could not be downloaded. Try again.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div data-post-controls>
      <div className="post-actions">
        <motion.button
          className={`post-ha ${post.viewerHasHa ? "is-liked" : ""}`}
          aria-pressed={post.viewerHasHa}
          disabled={busy}
          onClick={ha}
          animate={controls}
        >
          <span>Ha</span>
          <span>{post.haCount}</span>
        </motion.button>
        <Link
          className="post-comment"
          aria-label={`Comments, ${post.commentCount}`}
          href={`/post/${post.id}#comments`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M4 4h16v12H9l-5 4V4Z" />
          </svg>
          <span>{post.commentCount}</span>
        </Link>
        <details
          ref={menu}
          className="post-share"
          onKeyDown={(e) => {
            if (e.key === "Escape" && menu.current) {
              menu.current.open = false;
              menu.current.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label="Share post">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 16V3m-5 5 5-5 5 5M5 12v9h14v-9" />
            </svg>
            <span>Share</span>
          </summary>
          <div className="post-popover">
            <button onClick={copy}>Copy link</button>
            <button disabled={exporting} onClick={download}>
              {exporting ? "Rendering…" : "Download image"}
            </button>
          </div>
        </details>
      </div>
      {message && (
        <p className="post-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
