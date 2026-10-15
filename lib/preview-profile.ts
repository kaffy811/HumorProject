import "server-only";
import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/supabase/config";
import { dataSchema } from "@/lib/supabase/schema";
// Auth accounts are shared; application profiles are isolated in preview.
export async function ensurePreviewProfile(id: string) {
  if (dataSchema() !== "humor_preview") return;
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Preview server configuration is incomplete.");
  const db = createClient(config().url, secret, {
    db: { schema: "humor_preview" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const existing = await db
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (existing.error) throw new Error("Preview profiles are unavailable.");
  if (existing.data) return;
  const result = await db.from("profiles").insert({ id });
  if (result.error && result.error.code !== "23505")
    throw new Error("Could not create the preview profile.");
}
