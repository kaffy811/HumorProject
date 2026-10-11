"use client";
import { createContext, useContext, useState } from "react";
import { SWRConfig } from "swr";
const Viewer = createContext("");
export function useFeedViewer() {
  return useContext(Viewer);
}
export function FeedCacheProvider({
  viewerId,
  children,
}: {
  viewerId: string;
  children: React.ReactNode;
}) {
  const [cache] = useState(() => new Map());
  return (
    <Viewer.Provider value={viewerId}>
      <SWRConfig
        value={{
          provider: () => cache,
          revalidateOnFocus: false,
          revalidateOnReconnect: false,
          revalidateIfStale: false,
          errorRetryCount: 0,
        }}
      >
        {children}
      </SWRConfig>
    </Viewer.Provider>
  );
}
