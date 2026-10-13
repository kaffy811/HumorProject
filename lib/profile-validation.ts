export function namesFrom(value: unknown) {
  const input = value as { firstName?: unknown; lastName?: unknown } | null;
  const clean = (name: unknown) => {
    if (typeof name !== "string")
      throw new Error("Please add your first and last name.");
    const result = name.trim();
    if (!result || result.length > 80 || /[\u0000-\u001f\u007f]/.test(result))
      throw new Error(
        "Names must contain 1–80 characters, without control characters.",
      );
    return result;
  };
  return {
    first_name: clean(input?.firstName),
    last_name: clean(input?.lastName),
  };
}

export function profileFieldsFrom(value: unknown) {
  const names = namesFrom(value);
  const input = value as { username?: unknown };
  if (typeof input.username !== "string") throw new Error("Choose a username.");
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username))
    throw new Error(
      "Use 3–24 letters, numbers or underscores for your username.",
    );
  return { ...names, username };
}
