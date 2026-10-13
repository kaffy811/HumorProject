"use client";
import Image from "next/image";
import { cropAvatarFile } from "@/lib/avatar-client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { safeReturnPath } from "@/lib/auth-return";
import type { Profile } from "@/lib/profile";
export function ProfileForm({
  profile,
  avatarUrl,
  onboarding,
}: {
  profile: Profile | null;
  avatarUrl: string | null;
  onboarding: boolean;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [photoUrl, setPhotoUrl] = useState(avatarUrl);
  const [hasPhoto, setHasPhoto] = useState(!!profile?.avatar_path);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    if (!hasPhoto) {
      setError("Add a profile photo before joining the club.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, username }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Your profile could not be saved.");
      setMessage("Profile saved.");
      if (onboarding) {
        const next = await fetch("/auth/return", { method: "DELETE" });
        const destination = next.ok ? await next.json() : { target: "/feed" };
        router.push(safeReturnPath(destination.target) || "/feed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file || busy) return;
    setError("");
    setMessage("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      !file.size ||
      file.size > 5000000
    ) {
      setError("Choose a JPEG, PNG or WebP under 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("photo", await cropAvatarFile(file));
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Your photo could not be uploaded.");
      setHasPhoto(true);
      setPhotoUrl(result.avatarUrl);
      setMessage("Profile photo updated.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="profile-card">
      <div className="profile-photo-row">
        {photoUrl ? (
          <Image
            unoptimized
            className="profile-photo"
            src={photoUrl}
            alt="Your profile photo"
            width={96}
            height={96}
          />
        ) : (
          <div
            className="profile-photo-placeholder"
            aria-label="No profile photo"
          >
            ✳
          </div>
        )}
        <div>
          <label className="avatar-upload">
            {busy ? "Saving…" : "Choose a profile photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <p className="fine-print">
            Required to join · JPEG, PNG or WebP · up to 5 MB
            <br />
            Your profile photo stays private.
          </p>
        </div>
      </div>
      <form onSubmit={save} className="profile-form">
        <label>
          Username
          <input
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            minLength={3}
            maxLength={24}
            pattern="[a-z0-9_]{3,24}"
            required
            disabled={busy}
            placeholder="your_unreasonable_alias"
          />
          <span className="fine-print">
            Your unique handle · 3–24 letters, numbers or underscores.
          </span>
        </label>
        <label>
          First name
          <input
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
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
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={80}
            required
            disabled={busy}
          />
        </label>
        <button className="button" disabled={busy}>
          {busy
            ? "Saving…"
            : onboarding
              ? "Save and enter the club ↗"
              : "Save changes"}
        </button>
      </form>
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      <p className="form-message" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
