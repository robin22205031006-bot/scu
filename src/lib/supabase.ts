import { createClient } from '@supabase/supabase-js';

// Same public Lovable backend fallback as integrations/supabase/client so a
// missing env var at build time can never crash the app on load.
const supabaseUrl =
  import.meta.env["VITE_SUPABASE_URL"] ||
  "https://placeholder.supabase.co";
const supabaseAnonKey =
  import.meta.env["VITE_SUPABASE_ANON_KEY"] ||
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  "sb_publishable_placeholder_dummy_key_for_offline_mode";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);