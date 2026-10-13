import { cropAvatarFile } from "./avatar-client";
import type { MemberProfile } from "./profile-contracts";
import type { PostPage } from "./post-contracts";
import { PostError } from "./posts";
export async function profileRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new PostError(
      data.error || "Your profile stepped out. Try again.",
      r.status,
    );
  return data;
}
export function getProfile(id: string) {
  return profileRequest<MemberProfile>(`/api/profiles/${id}`);
}
export function listProfilePosts(id: string, cursor?: string | null) {
  const q = new URLSearchParams();
  if (cursor) q.set("cursor", cursor);
  return profileRequest<PostPage>(`/api/profiles/${id}/posts?${q}`);
}
export function saveProfile(name: string, avatarUploadId?: string) {
  return profileRequest<MemberProfile>("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: name, avatarUploadId }),
  });
}
export async function stageAvatar(
  file: File,
  crop: { x: number; y: number; size: number },
) {
  const form = new FormData();
  form.set("photo", await cropAvatarFile(file, crop));
  form.set("crop", JSON.stringify({ x: 0, y: 0, size: 512 }));
  return profileRequest<{ uploadId: string; avatarUrl: string }>(
    "/api/profile/avatar/preview",
    { method: "POST", body: form },
  );
}
export function googleAvatar() {
  return profileRequest<{ uploadId: string; avatarUrl: string }>(
    "/api/profile/avatar/google",
    { method: "POST" },
  );
}

export function abandonAvatar(uploadId: string) {
  return profileRequest<{ ok: boolean }>(
    `/api/profile/avatar/preview?id=${uploadId}`,
    { method: "DELETE" },
  );
}
