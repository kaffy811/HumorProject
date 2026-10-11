"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import type { Post } from "@/lib/post-contracts";
import { toggleHa, toggleSave, PostError } from "@/lib/posts";
import { usePostFeedback } from "@/components/feed/FeedCacheProvider";
export function PostActions({
  post,
  onUpdate,
}: {
  post: Post;
  onUpdate: (change: Partial<Post> | null) => Promise<void>;
}) {
  const [busyHa, setBusyHa] = useState(false),
    [busySave, setBusySave] = useState(false),
    lockHa = useRef(false),
    lockSave = useRef(false),
    haControls = useAnimationControls(),
    saveControls = useAnimationControls(),
    reduced = useReducedMotion(),
    { notify } = usePostFeedback();
  async function toggle(kind: "ha" | "save") {
    const lock = kind === "ha" ? lockHa : lockSave;
    if (lock.current) return;
    lock.current = true;
    const setBusy = kind === "ha" ? setBusyHa : setBusySave;
    setBusy(true);
    const previous =
      kind === "ha"
        ? { haCount: post.haCount, viewerHasHa: post.viewerHasHa }
        : { viewerHasSaved: post.viewerHasSaved };
    if (!reduced)
      void (kind === "ha" ? haControls : saveControls).start({
        scaleY: [1, 0.9, 1],
        transition: { duration: 0.28 },
      });
    try {
      await onUpdate(
        kind === "ha"
          ? {
              viewerHasHa: !post.viewerHasHa,
              haCount: Math.max(0, post.haCount + (post.viewerHasHa ? -1 : 1)),
            }
          : { viewerHasSaved: !post.viewerHasSaved },
      );
      await onUpdate(
        await (kind === "ha" ? toggleHa(post.id) : toggleSave(post.id)),
      );
    } catch (e) {
      await onUpdate(previous);
      notify(
        e instanceof PostError
          ? e.message
          : kind === "ha"
            ? "Your Ha didn’t stick. Try again."
            : "The bookmark didn’t stick. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div
      className="post-image-actions"
      data-post-controls
      onClick={(e) => e.stopPropagation()}
    >
      <div className="post-action-group">
        <motion.button
          className={`post-overlay-button ${post.viewerHasHa ? "is-active" : ""}`}
          aria-label="Ha"
          aria-pressed={post.viewerHasHa}
          disabled={busyHa}
          onClick={() => void toggle("ha")}
          animate={haControls}
        >
          Ha
        </motion.button>
        <span className="post-action-count" aria-label={`${post.haCount} Ha`}>
          {post.haCount}
        </span>
      </div>
      <div className="post-action-group">
        <Link
          className="post-overlay-button"
          aria-label={`Comments, ${post.commentCount}`}
          href={`/post/${post.id}#comments`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M4 4h16v12H9l-5 4V4Z" />
          </svg>
        </Link>
        <span className="post-action-count" aria-hidden="true">
          {post.commentCount}
        </span>
      </div>
      <div className="post-action-group">
        <motion.button
          className={`post-overlay-button ${post.viewerHasSaved ? "is-active" : ""}`}
          aria-label={post.viewerHasSaved ? "Unsave post" : "Save post"}
          aria-pressed={post.viewerHasSaved}
          disabled={busySave}
          onClick={() => void toggle("save")}
          animate={saveControls}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={post.viewerHasSaved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M6 3h12v18l-6-4-6 4V3Z" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
