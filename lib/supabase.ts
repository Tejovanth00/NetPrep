import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseUrl =
  rawUrl?.startsWith("http://") || rawUrl?.startsWith("https://")
    ? rawUrl
    : "http://127.0.0.1:54321";
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(
  supabaseUrl,
  anonKey || serviceRoleKey || "placeholder-anon-key",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
