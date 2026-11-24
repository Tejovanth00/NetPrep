import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url || !serviceRoleKey) {
  console.warn("Supabase service-role configuration is incomplete");
}

export const supabaseAdmin = createClient(
  url || "http://127.0.0.1:54321",
  serviceRoleKey || "placeholder-service-role-key",
  { auth: { persistSession: false, autoRefreshToken: false } },
);
