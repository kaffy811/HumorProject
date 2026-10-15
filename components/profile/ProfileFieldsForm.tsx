/* eslint-disable @next/next/no-img-element -- Local crop and trusted Google avatar preview. */
"use client";
import { useEffect, useRef, useState } from "react";
import { AvatarCropper } from "./AvatarCropper";
import { MAX_AVATAR_BYTES } from "@/lib/profile-contracts";
import {
  saveProfile,
  stageAvatar,
  usernameAvailable,
  type ProfileValues,
} from "@/lib/profiles";
import type { MemberProfile } from "@/lib/profile-contracts";
export interface ProfileFields {
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  googlePhotoUrl: string | null;
}
export function ProfileFieldsForm({
  initial,
  onSaved,
  onCancel,
  submitLabel = "Save changes",
  onBusyChange,
}: {
  initial: ProfileFields;
  onSaved: (profile: MemberProfile) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [name, setName] = useState(initial.username),
    [first, setFirst] = useState(initial.firstName),
    [last, setLast] = useState(initial.lastName),
    [action, setAction] = useState<ProfileValues["avatarAction"]>(
      !initial.avatarUrl && initial.googlePhotoUrl ? "google" : "keep",
    ),
    [file, setFile] = useState<File | null>(null),
    [crop, setCrop] = useState({ x: 0, y: 0, size: 0 }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [availability, setAvailability] = useState<
      "checking" | "available" | "taken" | "invalid" | "unknown"
    >("unknown");
  const input = useRef<HTMLInputElement>(null);
  const handle = name.trim().toLowerCase();
  useEffect(() => {
    if (!/^[a-z0-9_]{3,24}$/.test(handle)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void usernameAvailable(handle, controller.signal)
        .then((r) => setAvailability(r.available ? "available" : "taken"))
        .catch(() => {
          if (!controller.signal.aborted) setAvailability("unknown");
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [handle]);
  const photo =
    action === "remove"
      ? null
      : action === "google"
        ? initial.googlePhotoUrl
        : initial.avatarUrl;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || availability === "taken") return;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      const avatar = file ? await stageAvatar(file, crop) : null;
      const value = await saveProfile({
        username: handle,
        firstName: first,
        lastName: last,
        avatarAction: avatar ? "upload" : action,
        avatarUploadId: avatar?.uploadId,
      });
      await onSaved(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  function choose(f?: File) {
    if (!f) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
      !f.size ||
      f.size > MAX_AVATAR_BYTES
    ) {
      setError("Choose a JPG, PNG or WebP under 5 MB.");
      return;
    }
    setFile(f);
    setError("");
  }
  return (
    <form className="profile-fields-form" onSubmit={submit} aria-busy={busy}>
      <div className="profile-avatar-field">
        <input
          ref={input}
          type="file"
          hidden
          tabIndex={-1}
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          className="profile-photo-picker"
          type="button"
          aria-label="Choose profile photo"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {photo ? (
            <img src={photo} alt="Your profile photo" width={96} height={96} />
          ) : (
            <span aria-hidden="true">
              {(handle || "u").charAt(0).toUpperCase()}
            </span>
          )}
        </button>
        <button
          className="comic-button is-secondary"
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          Choose a photo
        </button>
        <div className="profile-photo-tools">
          <button
            className="text-link"
            type="button"
            disabled={busy || !initial.googlePhotoUrl}
            onClick={() => {
              setAction("google");
              setFile(null);
            }}
          >
            Use Google photo
          </button>
          <button
            className="text-link"
            type="button"
            disabled={busy}
            onClick={() => {
              setAction("remove");
              setFile(null);
            }}
          >
            Remove
          </button>
        </div>
        <p className="fine-print">Optional · JPG, PNG or WebP · up to 5 MB</p>
        {file && (
          <AvatarCropper
            key={`${file.name}:${file.lastModified}`}
            file={file}
            onCrop={setCrop}
          />
        )}
      </div>
      <label>
        Username
        <div className="username-input">
          <span aria-hidden="true">@</span>
          <input
            name="username"
            autoComplete="username"
            value={name}
            onChange={(e) => {
              const value = e.target.value.toLowerCase();
              setName(value);
              setAvailability(
                /^[a-z0-9_]{3,24}$/.test(value.trim()) ? "checking" : "invalid",
              );
            }}
            minLength={3}
            maxLength={24}
            pattern="[a-z0-9_]{3,24}"
            required
            disabled={busy}
            aria-describedby="username-status"
          />
        </div>
        <span id="username-status" className="fine-print" role="status">
          {availability === "checking"
            ? "Checking the guest list…"
            : availability === "taken"
              ? "That username is taken. Try another."
              : availability === "available"
                ? "Available. A rare quality."
                : "3–24 letters, numbers or underscores."}
        </span>
      </label>
      <label>
        First name
        <input
          name="firstName"
          autoComplete="given-name"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          maxLength={80}
          required
          disabled={busy}
        />
      </label>
      <label>
        Last name
        <input
          name="lastName"
          autoComplete="family-name"
          value={last}
          onChange={(e) => setLast(e.target.value)}
          maxLength={80}
          required
          disabled={busy}
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="profile-edit-footer">
        {onCancel && (
          <button
            type="button"
            className="comic-button is-secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          className="comic-button is-primary"
          disabled={busy || availability === "taken" || (!!file && !crop.size)}
        >
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
