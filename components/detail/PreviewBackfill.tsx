"use client";
import { useState } from "react";
export function PreviewBackfill() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");
    let total = 0;
    try {
      let remaining = 1;
      while (remaining) {
        const r = await fetch("/api/maintenance/previews", { method: "POST" }),
          data = await r.json();
        if (!r.ok) throw new Error(data.error || "Backfill failed.");
        total += data.processed;
        remaining = data.remaining;
        setMessage(`${total} thumbnails stored. ${remaining} remaining.`);
        if (!data.processed && remaining)
          throw new Error(
            "No progress. Retry after checking the source images.",
          );
      }
      setMessage(`Complete. ${total} thumbnails stored. 0 remaining.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="member-page">
      <h1>Preview backfill.</h1>
      <p>
        Project maintenance. Existing thumbnails are skipped. Original images
        stay private.
      </p>
      <button
        className="comic-button"
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? "Processing…" : "Run preview backfill"}
      </button>
      <p role="status">{message}</p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
