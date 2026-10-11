"use client";
import { FeedCacheProvider } from "@/components/feed/FeedCacheProvider";
import { StoreProvider } from "@/stores/StoreProvider";
import { GlobalHeader } from "./GlobalHeader";
import { MobileNavigation } from "./MobileNavigation";
import type { Author } from "@/lib/create-contracts";
export function AppShell({
  author,
  viewerId,
  children,
}: {
  author: Author;
  viewerId: string;
  children: React.ReactNode;
}) {
  return (
    <StoreProvider key={viewerId}>
      <FeedCacheProvider viewerId={viewerId}>
        <div className="member-shell">
          <a className="skip-link" href="#member-content">
            Skip to content
          </a>
          <GlobalHeader author={author} />
          <main id="member-content" className="member-content">
            {children}
          </main>
          <MobileNavigation />
        </div>
      </FeedCacheProvider>
    </StoreProvider>
  );
}
