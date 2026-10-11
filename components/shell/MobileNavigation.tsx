"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./GlobalHeader";
export function MobileNavigation() {
  const path = usePathname();
  return (
    <nav className="mobile-navigation" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => (
        <Link
          href={item.href}
          key={item.href}
          className={`${item.href === "/create" ? "mobile-create" : ""} ${path === item.href ? "is-active" : ""}`}
          aria-current={path === item.href ? "page" : undefined}
        >
          {item.href === "/create" && (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M12 4v16M4 12h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          )}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
