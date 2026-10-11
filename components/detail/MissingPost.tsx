"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useMascot } from "@/stores/StoreProvider";
export function MissingPost() {
  const setMood = useMascot((s) => s.setMood);
  useEffect(() => {
    setMood("cry");
  }, [setMood]);
  return (
    <section className="post-missing member-page">
      <h1>This joke didn&apos;t make it.</h1>
      <Link className="comic-button" href="/feed">
        Back to the feed
      </Link>
    </section>
  );
}
