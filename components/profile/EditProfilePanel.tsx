"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MemberProfile } from "@/lib/profile-contracts";
import { useAuthorCache } from "@/hooks/useAuthorCache";
import { useContentCache } from "@/hooks/useContentCache";
import { ProfileFieldsForm } from "./ProfileFieldsForm";
export function EditProfilePanel({
  profile,
  onClose,
}: {
  profile: MemberProfile;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    patch = useAuthorCache(),
    refresh = useContentCache(),
    router = useRouter();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const focus = document.activeElement as HTMLElement;
    node.showModal();
    return () => {
      node.close();
      focus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="profile-edit-dialog comic-card"
      aria-labelledby="edit-profile-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <div className="profile-edit-heading">
        <h2 id="edit-profile-title">A slight rebrand.</h2>
        <button
          type="button"
          className="profile-close"
          aria-label="Close edit profile"
          onClick={onClose}
          disabled={busy}
        >
          ×
        </button>
      </div>
      <ProfileFieldsForm
        onBusyChange={setBusy}
        initial={{
          username: profile.username,
          avatarUrl: profile.avatarUrl,
          googlePhotoUrl: profile.googlePhotoUrl || null,
        }}
        onCancel={onClose}
        onSaved={async (p) => {
          await patch(p);
          await refresh();
          router.refresh();
          onClose();
        }}
      />
    </dialog>
  );
}
