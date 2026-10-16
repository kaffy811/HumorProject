export function profileFieldsFrom(value: unknown) {
  const input = value as { username?: unknown } | null;
  if (typeof input?.username !== "string") throw new Error("Choose a username.");
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username))
    throw new Error("Use 3–24 letters, numbers or underscores for your username.");
  return { username };
}
