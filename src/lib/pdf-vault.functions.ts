import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSuperadminEmail } from "./roles";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string, email?: string | null) {
  if (isSuperadminEmail(email)) return;
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Only the admin can do this.");
}

function claimEmail(claims: unknown): string | null {
  const email = (claims as { email?: unknown } | null | undefined)?.email;
  return typeof email === "string" ? email : null;
}

/**
 * Embed a batch of vault text chunks (admin-only). The browser chunks the PDF,
 * then calls this per batch; vectors are stored client-side via PostgREST.
 */
export const embedVaultTexts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        texts: z.array(z.string().min(1).max(4000)).min(1).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, claimEmail(context.claims));
    const { embedGemini } = await import("./gemini.server");
    return { embeddings: await embedGemini(process.env['GOOGLE_API_KEY'], data.texts) };
  });
