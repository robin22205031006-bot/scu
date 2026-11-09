import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureSuperadminAccess } from "@/lib/roles.functions";
import { isSuperadminEmail } from "@/lib/roles";

const SESSION_TIMEOUT_MS = 5_000;

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T | "__timeout__"> {
  return Promise.race([p, new Promise<"__timeout__">((r) => setTimeout(() => r("__timeout__"), ms))]);
}

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      // Never let a slow Supabase round-trip pin the app in a loading state:
      // on timeout we resolve with no session and let RLS/public UI render.
      const res = await withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS);
      if (res === "__timeout__") return null;
      return res.data.session?.user ?? null;
    },
    staleTime: 60_000,
  });
}

export function useRoles() {
  const { data: user } = useSession();
  const q = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return [];
      const meta = (user.app_metadata ?? {}) as { role?: string; email?: string };
      const email = user.email ?? meta.email ?? null;
      const superadmin = isSuperadminEmail(email);
      const metaAdmin = meta.role === "admin" || meta.role === "superadmin";
      if (superadmin) {
        // Bootstrap a real `admin` row so RLS-protected writes keep working.
        try {
          await withTimeout(ensureSuperadminAccess({ data: {} }), SESSION_TIMEOUT_MS);
        } catch {
          // The role row may already exist or the server may be unreachable; roles below still apply.
        }
      }
      // Elevated status must survive a user_roles failure (RLS, offline, missing row).
      let roles: string[] = [];
      try {
        const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        if (error) throw error;
        roles = (data ?? []).map((r) => r.role as string);
      } catch {
        roles = [];
      }
      if (superadmin || metaAdmin) {
        return Array.from(new Set([...roles, "admin", ...(superadmin ? ["superadmin"] : [])]));
      }
      return roles;
    },
  });
  return user ? (q.data ?? []) : [];
}

export function useIsSuperadmin() {
  const { data: user } = useSession();
  const meta = (user?.app_metadata ?? {}) as { email?: string };
  return isSuperadminEmail(user?.email ?? meta.email ?? null);
}

export function useIsAdmin() {
  return useRoles().includes("admin");
}

export function useIsStaff() {
  const r = useRoles();
  return r.includes("admin") || r.includes("moderator");
}
