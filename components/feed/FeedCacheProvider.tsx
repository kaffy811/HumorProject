"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { SWRConfig } from "swr";
const Viewer = createContext("");
const Feedback = createContext<{
  message: string;
  notify: (message: string) => void;
  dismiss: () => void;
}>({ message: "", notify: () => {}, dismiss: () => {} });
export function usePostFeedback() {
  return useContext(Feedback);
}
export function PostFeedback() {
  const { message, dismiss } = usePostFeedback();
  return message ? (
    <div className="post-feedback" data-post-controls>
      <span role="status">{message}</span>
      <button onClick={dismiss} aria-label="Dismiss message">
        ×
      </button>
    </div>
  ) : null;
}
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
  const [message, setMessage] = useState("");
  const notify = useCallback((value: string) => setMessage(value), []);
  const dismiss = useCallback(() => setMessage(""), []);
  return (
    <Viewer.Provider value={viewerId}>
      <Feedback.Provider value={{ message, notify, dismiss }}>
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
      </Feedback.Provider>
    </Viewer.Provider>
  );
}
