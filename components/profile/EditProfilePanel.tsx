/* eslint-disable @next/next/no-img-element -- Local and private avatar previews. */
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  displayName,
  MAX_AVATAR_BYTES,
  type MemberProfile,
} from "@/lib/profile-contracts";
import {
  saveProfile,
  stageAvatar,
  googleAvatar,
  abandonAvatar,
} from "@/lib/profiles";
import { useAuthorCache } from "@/hooks/useAuthorCache";
import { AvatarCropper } from "./AvatarCropper";
export function EditProfilePanel({
  profile,
  onClose,
}: {
  profile: MemberProfile;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [name, setName] = useState(profile.name),
    [file, setFile] = useState<File | null>(null),
    [crop, setCrop] = useState({ x: 0, y: 0, size: 0 }),
    [google, setGoogle] = useState<{
      uploadId: string;
      avatarUrl: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    patch = useAuthorCache(),
    router = useRouter();
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const focused = document.activeElement as HTMLElement;
    node.showModal();
    return () => {
      node.close();
      focused?.focus();
    };
  }, []);
  function close() {
    if (google) void abandonAvatar(google.uploadId).catch(() => {});
    onClose();
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const cleaned = displayName(name);
      const avatar = file ? await stageAvatar(file, crop) : google;
      const updated = await saveProfile(cleaned, avatar?.uploadId);
      await patch(updated);
      router.refresh();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your profile did not save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="profile-edit-dialog comic-card"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else close();
      }}
      aria-labelledby="edit-profile-title"
    >
      <form onSubmit={save}>
        <div className="profile-edit-heading">
          <h2 id="edit-profile-title">A slight rebrand.</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close edit profile"
            disabled={busy}
            onClick={close}
          >
            ×
          </button>
        </div>
        <label>
          Display name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            required
            disabled={busy}
          />
        </label>
        <p className="fine-print">
          2–30 characters. A manageable amount of personality.
        </p>
        <label className="comic-button">
          Choose a photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (
                !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
                !f.size ||
                f.size > MAX_AVATAR_BYTES
              ) {
                setError("Choose a JPG, PNG or WebP under 5 MB.");
                return;
              }
              if (google) void abandonAvatar(google.uploadId).catch(() => {});
              setFile(f);
              setGoogle(null);
              setError("");
            }}
          />
        </label>
        <p className="fine-print">JPG, PNG or WebP · up to 5 MB</p>
        {file ? (
          <AvatarCropper
            key={`${file.name}:${file.lastModified}`}
            file={file}
            onCrop={setCrop}
          />
        ) : (
          <img
            className="profile-big-avatar"
            src={
              google?.avatarUrl || profile.avatarUrl || "/baby/bust/smirk.png"
            }
            alt="Your photo preview"
            width={112}
            height={112}
          />
        )}
        <button
          type="button"
          className="comic-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const next = await googleAvatar();
              if (google) void abandonAvatar(google.uploadId).catch(() => {});
              setGoogle(next);
              setFile(null);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Google photo unavailable.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Use Google photo
        </button>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="profile-edit-footer">
          <button
            type="button"
            className="comic-button"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button
            className="comic-button is-primary"
            disabled={busy || (!!file && !crop.size)}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
