import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

let _client = null;

export async function loadSupabase() {
  if (_client) return _client;

  // Import the SDK as an ES module and use its exports directly
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.46.1");

  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: { params: { eventsPerSecond: 5 } }
  });

  return _client;
}
