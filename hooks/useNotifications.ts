"use client";
import { useEffect, useRef } from "react";
import useSWR from "swr";
import { getUnreadNotifications } from "@/lib/notifications";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import { useMascot } from "@/stores/StoreProvider";
export function notificationSummaryKey(viewer: string) {
  return JSON.stringify(["notifications-summary", viewer]);
}
export function useNotifications() {
  const viewer = useFeedViewer();
  return useSWR(
    viewer === "guest" ? null : notificationSummaryKey(viewer),
    getUnreadNotifications,
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
      focusThrottleInterval: 0,
      revalidateIfStale: true,
    },
  );
}
export function NotificationListener() {
  const { data } = useNotifications(),
    setMood = useMascot((s) => s.setMood),
    baseline = useRef<string | null | undefined>(undefined),
    celebrated = useRef(false);
  useEffect(() => {
    if (!data) return;
    if (baseline.current === undefined) {
      baseline.current = data.latestAt;
      return;
    }
    if (
      data.latestAt &&
      (!baseline.current || data.latestAt > baseline.current) &&
      !celebrated.current
    ) {
      celebrated.current = true;
      setMood("omg");
    }
    if (
      data.latestAt &&
      (!baseline.current || data.latestAt > baseline.current)
    )
      baseline.current = data.latestAt;
  }, [data, setMood]);
  return null;
}
