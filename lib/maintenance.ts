import "server-only";
// Existing project owner's verified Supabase user ID. No credentials are stored here.
export function isMaintainer(userId: string) {
  return (
    userId ===
    (process.env.HUMOR_MAINTAINER_ID || "d52312df-b941-40ab-9b71-0daa51348cfb")
  );
}
