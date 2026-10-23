"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import type { Post } from "@/lib/post-contracts";
import { toggleSave, PostError } from "@/lib/posts";
import { usePostFeedback } from "@/components/feed/FeedCacheProvider";
import { PostReactions } from "./PostReactions";
export function PostActions({
  post,
  onUpdate,
  onComment,
  onOpen,
  placement = "image",
}: {
  post: Post;
  placement?: "image" | "comments";
  onComment?: () => void;
  onOpen?: () => void;
  onUpdate: (change: Partial<Post> | null) => Promise<void>;
}) {
  const [busySave, setBusySave] = useState(false),
    lockSave = useRef(false),
    saveControls = useAnimationControls(),
    reduced = useReducedMotion(),
    { notify } = usePostFeedback();
  async function save() {
    if (lockSave.current) return;
    lockSave.current = true;
    setBusySave(true);
    const previous = { viewerHasSaved: post.viewerHasSaved };
    if (!reduced) void saveControls.start({ scaleY: [1, 0.9, 1], transition: { duration: 0.28 } });
    try {
      await onUpdate({ viewerHasSaved: !post.viewerHasSaved });
      const result = await toggleSave(post.id);
      await onUpdate(result);
      if (result.showSavedHint) notify("Saved. Find it under your avatar → Saved.", "/me?tab=saved");
    } catch (error) {
      await onUpdate(previous);
      notify(error instanceof PostError ? error.message : "The bookmark didn’t stick. Try again.");
    } finally {
      lockSave.current = false;
      setBusySave(false);
    }
  }
  return (
    <div
      className={placement === "comments" ? "post-detail-actions" : "post-image-actions"}
      data-post-controls
      onClick={(e) => e.stopPropagation()}
    >
      <PostReactions post={post} onUpdate={onUpdate} placement={placement} />
      {placement !== "comments" && <div className="post-action-group">
        <Link
          className="post-overlay-button"
          aria-label={`Comments, ${post.commentCount}`}
          href={`/post/${post.id}#comments`}
          onClick={(e) => {
            if (onComment) {
              e.preventDefault();
              onComment();
            } else onOpen?.();
          }}
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
      </div>}
      <div className="post-action-group">
        <motion.button
          className={`post-overlay-button ${post.viewerHasSaved ? "is-active" : ""}`}
          aria-label={post.viewerHasSaved ? "Unsave post" : "Save post"}
          aria-pressed={post.viewerHasSaved}
          disabled={busySave}
          onClick={() => void save()}
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
          {placement === "comments" && <span>{post.viewerHasSaved ? "Saved" : "Save"}</span>}
        </motion.button>
      </div>
    </div>
  );
}
