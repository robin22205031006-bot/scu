import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isSuperadminEmail } from "./roles";

function claimEmail(claims: unknown): string | null {
  const email = (claims as { email?: unknown } | null | undefined)?.email;
  return typeof email === "string" ? email : null;
}

async function callerEmail(context: { userId: string; claims: unknown }): Promise<string | null> {
  const fromClaims = claimEmail(context.claims);
  if (fromClaims) return fromClaims;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(context.userId);
  return data?.user?.email ?? null;
}

async function assertRoleManager(context: { userId: string; claims: unknown; supabase: SupabaseClient<Database> }) {
  const email = await callerEmail(context);
  if (isSuperadminEmail(email)) return;
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Only admins can manage roles.");
}

/** Grants the hardcoded Superadmin a real `admin` row so RLS-protected writes keep working. */
export const ensureSuperadminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({}).parse(d ?? {}))
  .handler(async ({ context }) => {
    const email = await callerEmail(context);
    if (!isSuperadminEmail(email)) return { granted: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: readError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (readError) throw new Error("Superadmin access could not be verified.");
    if (existing) return { granted: true };

    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error && error.code !== "23505") throw new Error("Superadmin access could not be activated.");
    return { granted: true };
  });

export const listUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({}).parse(d ?? {}))
  .handler(async ({ context }) => {
    await assertRoleManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("user_roles").select("user_id, role");
    if (error) throw new Error("Roles could not be loaded.");
    return data ?? [];
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email().optional(),
        userId: z.string().min(1).optional(),
        role: z.enum(["admin", "moderator", "user"]).nullable(),
      })
      .refine((v) => v.email || v.userId, { message: "Provide an email or user ID." })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRoleManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let targetUserId: string | null = null;
    let targetEmail: string | null = null;

    if (data.userId) {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      if (authError || !authUser.user) throw new Error("No member found with that user ID.");
      targetUserId = authUser.user.id;
      targetEmail = authUser.user.email ?? null;
    } else if (data.email) {
      const target = data.email.trim().toLowerCase();
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .ilike("email", target)
        .maybeSingle();
      if (profileError) throw new Error("The member could not be found.");
      if (profile) {
        targetUserId = profile.id;
        targetEmail = (profile.email as string | null) ?? target;
      } else {
        // profiles may lag behind auth — fall back to the auth user list.
        const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (listError) throw new Error("The member could not be found.");
        const match = list.users.find((u) => (u.email ?? "").toLowerCase() === target);
        if (!match) throw new Error("No member found with that email.");
        targetUserId = match.id;
        targetEmail = match.email ?? target;
      }
    }

    if (!targetUserId) throw new Error("No member found.");
    if (isSuperadminEmail(targetEmail)) throw new Error("The Superadmin account cannot be changed here.");

    const { error: deleteError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUserId);
    if (deleteError) throw new Error("The role could not be updated.");
    if (data.role && data.role !== "user") {
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: targetUserId, role: data.role });
      if (error) throw new Error("The role could not be saved.");
    }
    return { ok: true, email: targetEmail };
  });
