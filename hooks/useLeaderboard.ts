"use client";
import { useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { getLeaderboard } from "@/lib/leaderboard";
import type {
  LeaderboardData,
  RankingWindow,
} from "@/lib/leaderboard-contracts";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
export function useLeaderboard(window: RankingWindow) {
  const viewer = useFeedViewer(),
    { cache } = useSWRConfig();
  const key = JSON.stringify(["leaderboard", viewer, window,"rolling-v2"]);
  const cached = cache.get(key)?.data as LeaderboardData | undefined;
  const result = useSWR<LeaderboardData>(
    key,
    () => getLeaderboard({ window }),
    {
      keepPreviousData: true,
      revalidateOnMount: !cached,
      revalidateIfStale: false,
      dedupingInterval: 1000,
    },
  );
  const { data, mutate } = result;
  useEffect(() => {
    if (!data || data.window !== window) return;
    const timer = setTimeout(
      () => void mutate(),
      Math.max(1000, Date.parse(data.expiresAt) - Date.now() + 50),
    );
    return () => clearTimeout(timer);
  }, [data, mutate, window]);
  return result;
}
