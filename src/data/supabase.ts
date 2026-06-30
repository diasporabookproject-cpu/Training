// Supabase client. URL + publishable key are PUBLIC by design (the publishable
// key is meant to ship in the browser); per-user isolation is enforced by
// Row-Level Security policies on the server, not by hiding this key.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pqeilsuqglmrvijndrwa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Gvhm9PdeleoilZGoeFiAtg_mGATsr1v";

export const isSyncConfigured =
  SUPABASE_URL.startsWith("https://") && SUPABASE_PUBLISHABLE_KEY.length > 0;

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // PWA is a single-page app with no OAuth redirect callback handling.
      detectSessionInUrl: false,
    },
  }
);
