import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Public (publishable) backend values, baked in so the published build never
// starts without them. These are not secrets.
const SUPABASE_URL = "https://c--2c3743b4-a0ff-4079-b412-eba03e4ddcc7-prod.lovable.cloud";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FSGOMkkM8_gDbaY7lfAyEg_d7tLjyhW";
const SUPABASE_PROJECT_ID = "raplydgyiqrxoyxzdpbr";

const url = process.env.VITE_SUPABASE_URL || SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;
const pid = process.env.VITE_SUPABASE_PROJECT_ID || SUPABASE_PROJECT_ID;

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(key),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(pid),
    },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
