import { dataSchema } from "@/lib/supabase/schema";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { config } from "./config";
export async function createClient() {
  const store = await cookies();
  const { url, key } = config();
  return createServerClient(url, key, { db: { schema: dataSchema() },
    cookies: {
    getAll: () => store.getAll(),
    setAll(values) {
      try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
      catch { /* Server Components cannot write cookies; proxy refreshes them. */ }
    },
  }});
}
