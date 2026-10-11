/* eslint-disable @next/next/no-img-element -- Blob previews, animated GIFs and private signed URLs are intentionally rendered directly. */
"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Author } from "@/lib/create-contracts";
export function UserMenu({ author }: { author: Author }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="user-menu" ref={root}>
      <button
        ref={button}
        className="avatar-button"
        aria-label="Open account menu"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen(!open)}
      >
        {author.avatarUrl ? (
          <img src={author.avatarUrl} alt="" width={38} height={38} />
        ) : (
          <span>{author.name.slice(0, 1)}</span>
        )}
      </button>
      {open && (
        <div id="account-menu" className="account-dropdown">
          <span className="comic-label">{author.username}</span>
          <Link href="/me" onClick={() => setOpen(false)}>
            My posts
          </Link>
          <Link href="/profile" onClick={() => setOpen(false)}>
            Edit profile
          </Link>
          <button
            disabled={busy}
            onClick={() => {
              const proceed = async () => {
                setBusy(true);
                const { error } = await createClient().auth.signOut();
                if (error) {
                  setError("Could not sign out. Try again.");
                  setBusy(false);
                } else {
                  router.replace("/");
                  router.refresh();
                }
              };
              const event = new CustomEvent("humor:leave", {
                cancelable: true,
                detail: { proceed },
              });
              if (window.dispatchEvent(event)) void proceed();
            }}
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
