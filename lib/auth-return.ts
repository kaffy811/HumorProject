export const RETURN_COOKIE = "humor_return_to";
export function safeReturnPath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 1024 ||
    !value.startsWith("/") ||
    value.includes("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return null;
  let decoded = value;
  try {
    for (let i = 0; i < 4; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
      if (decoded.includes("//") || /[\\\u0000-\u0020\u007f]/.test(decoded))
        return null;
    }
  } catch {
    return null;
  }
  try {
    const u = new URL(value, "https://humor.invalid");
    if (
      u.origin !== "https://humor.invalid" ||
      u.pathname.startsWith("/auth/") ||
      u.pathname.startsWith("/api/")
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
