import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const AUTH_TIMEOUT_MS = 5_000;

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T | "__timeout__"> {
  return Promise.race([p, new Promise<"__timeout__">((r) => setTimeout(() => r("__timeout__"), ms))]);
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // In offline mode (no real Supabase), skip auth checks so the app renders
    // instead of crashing. RLS still guards every query when a real backend exists.
    const hasSupabase = !!(
      import.meta.env["VITE_SUPABASE_URL"] ||
      (typeof process !== "undefined" && process.env?.["SUPABASE_URL"])
    );
    if (!hasSupabase) return;

    // Never hang navigation on a slow Supabase round-trip: on timeout we let the
    // page render anyway — RLS still guards every query, and the session cache
    // resolves the real user a moment later.
    const auth = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS);
    if (auth === "__timeout__") return;
    const user = auth.data.user;
    if (!user) throw redirect({ to: "/auth", search: { next: location.pathname } });
    const ban = await withTimeout(supabase.rpc("is_banned", { _uid: user.id }), AUTH_TIMEOUT_MS);
    if (ban !== "__timeout__" && ban.data) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { banned: "1" } });
    }
  },
  component: () => (
    <div className="morph-in">
      <Outlet />
    </div>
  ),
});
