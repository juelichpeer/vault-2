import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// Load supabase-js from CDN (skypack) dynamically if not already present
export async function loadSupabase(){
  if (!window.supabase) {
    await import("https://esm.sh/@supabase/supabase-js@2.46.1");
  }
  const { createClient } = window.supabase;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: { params: { eventsPerSecond: 5 }}
  });
  return client;
}
