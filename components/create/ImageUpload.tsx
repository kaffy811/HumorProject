/* eslint-disable @next/next/no-img-element -- Blob previews, animated GIFs and private signed URLs are intentionally rendered directly. */
"use client";
import { useEffect, useRef, useState } from "react";
import { useCreate } from "@/stores/StoreProvider";
import { ComicButton } from "@/components/ui/ComicButton";
export function ImageUpload({
  selectFile,
  removeImage,
  retryUpload,
  disabled,
}: {
  selectFile: (file: File) => Promise<void>;
  removeImage: () => void;
  retryUpload: () => unknown;
  disabled: boolean;
}) {
  const image = useCreate((s) => s.image),
    phase = useCreate((s) => s.phase);
  const input = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false),
    [error, setError] = useState("");
  const choose = async (file?: File) => {
    if (!file || disabled) return;
    setError("");
    try {
      await selectFile(file);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Choose another image.",
      );
    }
  };
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const focused = event.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA"].includes(focused.tagName) ||
        focused.isContentEditable ||
        disabled
      )
        return;
      const file = Array.from(event.clipboardData?.files || []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (file) {
        event.preventDefault();
        void choose(file);
      }
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  });
  return (
    <>
      <input
        type="file"
        hidden
        ref={input}
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        hidden
        ref={camera}
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="environment"
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {image ? (
        <div className="image-preview">
          <img src={image.previewUrl} alt="Your selected photo" />
          <div className="image-tools">
            <button
              disabled={disabled}
              className="text-button"
              onClick={() => input.current?.click()}
            >
              Change
            </button>
            <button
              disabled={disabled}
              className="text-button"
              onClick={removeImage}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          disabled={disabled}
          type="button"
          className={`upload-zone ${dragging ? "is-dragging" : ""}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void choose(e.dataTransfer.files[0]);
          }}
        >
          <svg
            className="upload-icon"
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M16 22V4m-6 6 6-6 6 6M5 20v8h22v-8" />
          </svg>
          <strong>Drop a photo. Lower your expectations.</strong>
          <span>
            Or click to choose · Paste works too
            <br />
            JPG, PNG, WebP or GIF · Up to 10 MB
          </span>
        </button>
      )}
      <div className="file-actions">
        <button
          className="text-button"
          disabled={disabled}
          onClick={() => camera.current?.click()}
        >
          Take a photo
        </button>
        {phase === "upload-error" && (
          <ComicButton secondary onClick={() => retryUpload()}>
            Retry upload
          </ComicButton>
        )}
      </div>
      {image && (
        <p className="upload-status" role="status">
          {phase === "uploading"
            ? "Uploading. The baby is supervising."
            : image.uploadId
              ? "Uploaded. Already judging it."
              : "Upload needs another attempt."}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
