"use client";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import { characterCount } from "@/lib/create-contracts";
import type { Comment } from "@/lib/comment-contracts";
export function CommentComposer({
  input,
  reply,
  onCancel,
  onRestoreReply,
  busy,
  onSend,
}: {
  input: RefObject<HTMLTextAreaElement | null>;
  reply: Comment | null;
  onCancel: () => void;
  onRestoreReply: (reply: Comment) => void;
  busy: boolean;
  onSend: (
    body: string,
    reply?: { id: string; authorName: string },
  ) => Promise<void>;
}) {
  const localInput = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(input, () => localInput.current as HTMLTextAreaElement);
  const [body, setBody] = useState(""),
    [error, setError] = useState(""),
    current = useRef(""),
    inFlight = useRef(false),
    count = characterCount(body);
  useEffect(() => {
    const el = localInput.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
  }, [body]);
  async function send() {
    if (inFlight.current || busy || !body.trim() || count > 280) return;
    inFlight.current = true;
    const original = body,
      target = reply
        ? { id: reply.id, authorName: reply.author.name }
        : undefined;
    setBody("");
    current.current = "";
    setError("");
    onCancel();
    try {
      await onSend(original, target);
    } catch (e) {
      if (reply) onRestoreReply(reply);
      setError(e instanceof Error ? e.message : "Could not send. Try again.");
      const restored = current.current
        ? `${original}\n${current.current}`
        : original;
      current.current = restored;
      setBody(restored);
    } finally {
      inFlight.current = false;
    }
  }
  return (
    <div className="comment-composer">
      {reply && (
        <div className="comment-replying">
          Replying to {reply.author.name}
          <button aria-label="Cancel reply" onClick={onCancel}>
            ×
          </button>
        </div>
      )}
      <label className="sr-only" htmlFor="comment-body">
        Your comment
      </label>
      <div className="composer-row">
        <textarea
          id="comment-body"
          ref={localInput}
          rows={1}
          placeholder="Say something funnier."
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            current.current = e.target.value;
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              window.matchMedia("(pointer:fine)").matches
            ) {
              e.preventDefault();
              void send();
            }
          }}
          aria-describedby="comment-input-help"
          aria-invalid={count > 280}
        />
        <button
          className="comic-button"
          disabled={busy || !body.trim() || count > 280}
          onClick={() => void send()}
          aria-label="Send comment"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      <div id="comment-input-help" className="composer-help">
        <span>Keep it under 280. The baby has plans.</span>
        {count >= 240 && (
          <span className={count > 280 ? "comment-error" : ""}>
            {280 - count} left
          </span>
        )}
      </div>
      {error && (
        <p className="comment-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
