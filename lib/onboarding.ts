import { profileRequest } from "./profiles";
export function skipOnboarding() {
  return profileRequest<{ ok: boolean }>("/api/onboarding", { method: "POST" });
}
export function claimFirstPostNotice(postId: string) {
  return profileRequest<{ show: boolean }>("/api/onboarding/first-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId }),
  });
}
