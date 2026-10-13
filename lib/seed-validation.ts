import { STYLES, type JokeStyle } from "./create-contracts";
export interface SeedPost {
  imageFile: string;
  caption: string;
  style: JokeStyle;
  placeholder?: boolean;
  kind?: "opening" | "community";
}
export function seedPosts(
  input: unknown,
  environment: "production" | "development",
): SeedPost[] {
  if (!Array.isArray(input)) throw Error("posts.json must be an array.");
  const seen = new Set<string>();
  return input.map((p: SeedPost, i: number) => {
    if (
      !p ||
      typeof p.imageFile !== "string" ||
      p.imageFile.length > 240 ||
      /[\u0000-\u001f\u007f\\:]/.test(p.imageFile) ||
      p.imageFile.includes("..") ||
      p.imageFile.includes("//") ||
      p.imageFile.startsWith("/") ||
      !p.imageFile.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/)
    )
      throw Error(`Entry ${i + 1}: use a relative image filename.`);
    if (seen.has(p.imageFile))
      throw Error(`Duplicate imageFile: ${p.imageFile}`);
    seen.add(p.imageFile);
    if (
      typeof p.caption !== "string" ||
      Array.from(p.caption.trim()).length < 1 ||
      Array.from(p.caption.trim()).length > 200 ||
      /[\u0000-\u001f]/.test(p.caption)
    )
      throw Error(`Entry ${i + 1}: caption must contain 1–200 characters.`);
    if (!STYLES.includes(p.style))
      throw Error(`Entry ${i + 1}: unknown style.`);
    if (p.placeholder !== undefined && typeof p.placeholder !== "boolean")
      throw Error(`Entry ${i + 1}: placeholder must be a boolean.`);
    if (p.kind !== undefined && !["opening", "community"].includes(p.kind))
      throw Error(`Entry ${i + 1}: unknown kind.`);
    if (
      environment === "production" &&
      (p.placeholder || /(placeholder|dummy|preview|sample)/i.test(p.imageFile))
    )
      throw Error(`Production refuses placeholder image: ${p.imageFile}`);
    return { ...p, caption: p.caption.trim() };
  });
}
export function seedTarget(environment: string, url: string) {
  const target = new URL(url);
  if (target.username || target.password || target.search || target.hash)
    throw Error("Use a plain Supabase URL.");
  if (environment === "production") {
    if (
      target.origin !== "https://wqkpatxsbxwjsupojjcq.supabase.co" ||
      target.pathname !== "/"
    )
      throw Error("Production must target the existing Humor Project.");
  } else if (environment === "development") {
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
      target.protocol !== "http:"
    )
      throw Error(
        "Development imports require local Supabase; the production database is refused.",
      );
  } else throw Error("Choose --env production or --env development.");
}
