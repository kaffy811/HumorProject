"use client";
import { useEffect, useRef } from "react";
import { ComicButton } from "./ComicButton";
export function LeaveDraftDialog({
  open,
  cancel,
  leave,
}: {
  open: boolean;
  cancel: () => void;
  leave: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      previous.current = document.activeElement as HTMLElement;
      ref.current?.showModal();
    } else if (ref.current?.open) {
      ref.current.close();
      previous.current?.focus();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="draft-dialog"
      aria-labelledby="leave-title"
      aria-describedby="leave-description"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <h2 id="leave-title">Leaving so soon?</h2>
      <p id="leave-description">
        Your unpublished joke will stay here only if you do. A rare moment of
        commitment.
      </p>
      <div className="dialog-actions">
        <ComicButton autoFocus onClick={cancel}>
          Keep editing
        </ComicButton>
        <ComicButton secondary onClick={leave}>
          Leave draft
        </ComicButton>
      </div>
    </dialog>
  );
}
