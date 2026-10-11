"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mascot } from "./Mascot";
import { UserMenu } from "./UserMenu";
import type { Author } from "@/lib/create-contracts";
export const NAV_ITEMS = [
  { href: "/feed", label: "Feed" },
  { href: "/create", label: "Create" },
  { href: "/top", label: "Top" },
];
export function GlobalHeader({ author }: { author: Author }) {
  const path = usePathname();
  return (
    <header className="comic-header">
      <div className="comic-header-inner">
        <Link
          href="/feed"
          className="comic-brand"
          aria-label="The Humor Project, Feed"
        >
          <span className="comic-brand-symbol" aria-hidden="true">
            h.
          </span>
          <span>
            The Humor
            <br className="brand-break" /> Project
          </span>
        </Link>
        <Mascot />
        <div className="header-actions">
          <nav className="desktop-navigation" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={path === item.href ? "is-active" : ""}
                aria-current={path === item.href ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <UserMenu author={author} />
        </div>
      </div>
    </header>
  );
}
