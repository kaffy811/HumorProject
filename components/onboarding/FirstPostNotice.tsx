"use client";
import { useState } from "react";
import useSWR from "swr";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import { claimFirstPostNotice } from "@/lib/onboarding";
export function FirstPostNotice({
  postId,
  pending,
}: {
  postId: string;
  pending: boolean;
}) {
  const viewer = useFeedViewer(),
    [dismissed, setDismissed] = useState(false),
    { data } = useSWR(
      pending ? JSON.stringify(["first-post-notice", viewer, postId]) : null,
      () => claimFirstPostNotice(postId),
      {
        revalidateIfStale: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
      },
    );
  return data?.show && !dismissed ? (
    <aside className="welcome-banner first-post-notice">
      <p>Your first post. It&apos;s out there now. No take-backs.</p>
      <button
        aria-label="Dismiss first post notice"
        className="icon-button"
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </aside>
  ) : null;
}
