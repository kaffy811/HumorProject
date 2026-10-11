"use client";
import { StoreProvider } from "@/stores/StoreProvider";
import { GlobalHeader } from "./GlobalHeader";
import { MobileNavigation } from "./MobileNavigation";
import type { Author } from "@/lib/create-contracts";
export function AppShell({
  author,
  children,
}: {
  author: Author;
  children: React.ReactNode;
}) {
  return (
    <StoreProvider>
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
    </StoreProvider>
  );
}
