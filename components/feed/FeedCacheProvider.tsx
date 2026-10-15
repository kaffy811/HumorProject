"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { useAuthorStore } from "@/stores/author-store";
import Link from "next/link";
import { SWRConfig } from "swr";
const Viewer = createContext("");
const ViewerAuthor = createContext<{ name: string; avatarUrl: string | null }>({
  name: "You",
  avatarUrl: null,
});
export function useViewerAuthor() {
  const base = useContext(ViewerAuthor),
    viewer = useContext(Viewer),
    updated = useAuthorStore((s) => s.authors[viewer]);
  return updated || base;
}
const Feedback = createContext<{
  message: string; href?: string;
  notify: (message: string, href?:string) => void;
  dismiss: () => void;
}>({ message: "", notify: () => {}, dismiss: () => {} });
export function usePostFeedback() {
  return useContext(Feedback);
}
export function PostFeedback() {
  const { message, href, dismiss } = usePostFeedback();
  return message ? (
    <div className="post-feedback" data-post-controls>
      <span role="status">{message}</span>{href&&<Link href={href} onClick={dismiss}>View</Link>}
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
  author,
  children,
}: {
  viewerId: string;
  author?: { name: string; avatarUrl: string | null } | null;
  children: React.ReactNode;
}) {
  const [cache] = useState(() => new Map());
  const [message, setMessage] = useState("");
  const [href,setHref]=useState<string|undefined>();
  const notify = useCallback((value:string,link?:string)=>{setMessage(value);setHref(link);},[]);
  const dismiss = useCallback(() => setMessage(""), []);
  return (
    <Viewer.Provider value={viewerId}>
      <ViewerAuthor.Provider value={author || { name: "You", avatarUrl: null }}>
        <Feedback.Provider value={{ message, href, notify, dismiss }}>
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
      </ViewerAuthor.Provider>
    </Viewer.Provider>
  );
}
