"use client";
import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import { useAuthorStore } from "@/stores/author-store";
import type { MemberProfile } from "@/lib/profile-contracts";
export function useAuthorCache() {
  const { cache, mutate } = useSWRConfig(),
    viewer = useFeedViewer(),
    put = useAuthorStore((s) => s.put);
  return useCallback(
    async (profile: MemberProfile) => {
      put(profile);
      await Promise.all(
        Array.from(cache.keys()).map(async (key) => {
          let parsed;
          try {
            parsed = JSON.parse(key.startsWith("$inf$") ? key.slice(5) : key);
          } catch {
            return;
          }
          if (!Array.isArray(parsed) || parsed[1] !== viewer) return;
          const patch = (value: unknown): unknown => {
            if (Array.isArray(value)) return value.map(patch);
            if (!value || typeof value !== "object") return value;
            const obj = value as Record<string, unknown>;
            if (obj.id === profile.id && typeof obj.name === "string")
              return {
                ...obj,
                name: profile.name,
                username: profile.username,
                avatarUrl: profile.avatarUrl,
                isOfficial: profile.isOfficial,
              };
            if (
              obj.authorId === profile.id &&
              typeof obj.authorName === "string" &&
              obj.authorName !== "deleted" &&
              obj.authorName !== "@deleted"
            )
              return { ...obj, authorName: profile.name };
            const result: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(obj)) result[k] = patch(v);
            return result;
          };
          await mutate(
            key,
            (value: unknown) =>
              parsed[0] === "profile" && parsed[2] === profile.id
                ? profile
                : patch(value),
            { revalidate: false },
          );
        }),
      );
    },
    [cache, mutate, viewer, put],
  );
}
