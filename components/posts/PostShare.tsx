"use client";
import { useEffect, useRef, useState } from "react";
import { usePostFeedback } from "@/components/feed/FeedCacheProvider";
import { downloadPost } from "./PostExport";
export function PostShare({
  id,
  card,
}: {
  id: string;
  card: React.RefObject<HTMLDivElement | null>;
}) {
  const menu = useRef<HTMLDetailsElement>(null),
    [exporting, setExporting] = useState(false),
    { notify } = usePostFeedback();
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node))
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/post/${id}`);
      notify("Link copied. Go ruin a group chat.");
    } catch {
      notify("Could not copy the link. Try again.");
    }
    if (menu.current) menu.current.open = false;
  }
  async function download() {
    if (exporting || !card.current) return;
    setExporting(true);
    try {
      await downloadPost(card.current, id);
      notify("Downloaded. Evidence secured.");
    } catch {
      notify("The image could not be downloaded. Try again.");
    } finally {
      setExporting(false);
      if (menu.current) menu.current.open = false;
    }
  }
  return (
    <details
      ref={menu}
      className="post-share"
      data-post-controls
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
      </summary>
      <div className="post-popover">
        <button onClick={copy}>Copy link</button>
        <button disabled={exporting} onClick={download}>
          {exporting ? "Rendering…" : "Download image"}
        </button>
      </div>
    </details>
  );
}
