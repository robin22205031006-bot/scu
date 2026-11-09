import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useIsStaff } from "@/hooks/use-admin";
import { isSuperadminEmail } from "@/lib/roles";
import { listUserRoles, setUserRole } from "@/lib/roles.functions";
import { syncLoreExport } from "@/lib/ingest.functions";
import { AdminEpisodes } from "@/components/admin-episodes";
import { AdminSeries } from "@/components/admin-series";
import { AdminTypography } from "@/components/admin-typography";
import { AdminNavVisibility } from "@/components/admin-nav-visibility";
import { AdminAppearance } from "@/components/admin-appearance";
import { AdminAudio } from "@/components/admin-audio";
import { AdminContradictions } from "@/components/admin-contradictions";
import { AdminCharacterAbilities } from "@/components/admin-character-abilities";
import { AdminAccordion } from "@/components/admin-accordion";
import { AdminUiToggles } from "@/components/admin-ui-toggles";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Admin — Sentinels Cinematic Universe" },
      { name: "description", content: "Moderate the SCU community and archive." },
      { property: "og:title", content: "Admin — SCU" },
      { property: "og:description", content: "Moderate the SCU community and archive." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const staff = useIsStaff();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [word, setWord] = useState("");
  const [assignTarget, setAssignTarget] = useState("");
  const [newRole, setNewRole] = useState("moderator");
  const [syncing, setSyncing] = useState(false);
  const listRoles = useServerFn(listUserRoles);
  const assignRole = useServerFn(setUserRole);
  const runSync = useServerFn(syncLoreExport);

  const { data } = useQuery({
    queryKey: ["admin"],
    enabled: staff,
    queryFn: async () => {
      const [p, b, w, l] = await Promise.all([
        supabase.from("profiles").select("id, email, display_name").order("created_at"),
        supabase.from("banned_users").select("user_id, reason"),
        supabase.from("banned_words").select("id, word").order("word"),
        supabase.from("activity_log").select("id, user_id, action, created_at").order("created_at", { ascending: false }).limit(50),
      ]);
      return { profiles: p.data ?? [], bans: b.data ?? [], words: w.data ?? [], log: l.data ?? [] };
    },
  });

  const { data: roleRows } = useQuery({
    queryKey: ["admin-roles"],
    enabled: staff && isAdmin,
    queryFn: () => listRoles({ data: {} }),
  });

  const { data: conflicts } = useQuery({
    queryKey: ["admin-conflicts"],
    enabled: staff,
    queryFn: async () => {
      const [notes, ents] = await Promise.all([
        supabase.from("lore_notes").select("id, entity_id, text, source, created_at").ilike("text", "[conflict]%").order("created_at", { ascending: false }).limit(200),
        supabase.from("entities").select("id, name"),
      ]);
      const nameOf = new Map((ents.data ?? []).map((e) => [e.id, e.name]));
      return (notes.data ?? []).map((n) => ({ ...n, entity_name: nameOf.get(n.entity_id) ?? "—" }));
    },
  });

  if (!staff) return <main className="mx-auto max-w-3xl px-5 pt-32 text-muted-foreground">Staff only.</main>;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
    qc.invalidateQueries({ queryKey: ["roles"] });
  };

  const syncExport = async () => {
    setSyncing(true);
    try {
      const [entities, updates, events] = await Promise.all(
        ["entities.json", "updates.json", "timeline_events.json"].map(async (f) => {
          const res = await fetch(`/lore-export/${f}`);
          if (!res.ok) throw new Error(`${f} not found — run lore-consolidate.mjs first.`);
          return res.json();
        }),
      );
      const result = await runSync({ data: { entities, updates, events } });
      toast.success(`Lore sync complete: ${result.created} created, ${result.notes} notes, ${result.updated} updated, ${result.events} events.`);
      const warns = (result.warnings ?? []) as string[];
      if (warns.length) {
        warns.slice(0, 5).forEach((w) => toast.warning(w, { duration: 8000 }));
        if (warns.length > 5) toast.warning(`…and ${warns.length - 5} more sync notices`, { duration: 8000 });
      }
      qc.invalidateQueries({ queryKey: ["entities"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["admin-conflicts"] });
    } catch (err) {
      console.error("SYNC ERROR DETAILS:", err);
      toast.error(err instanceof Error ? err.message : "The lore sync failed.");
    } finally {
      setSyncing(false);
    }
  };
  const banned = new Set((data?.bans ?? []).map((b) => b.user_id));
  const emailOf = (id: string | null) => data?.profiles.find((p) => p.id === id)?.email ?? "—";

  const rolesOf = (userId: string) => (roleRows ?? []).filter((r) => r.user_id === userId).map((r) => r.role as string);
  const effectiveRole = (userId: string) => {
    const roles = rolesOf(userId);
    if (roles.includes("admin")) return "admin";
    if (roles.includes("moderator")) return "moderator";
    return "user";
  };

  const changeRole = async (target: { email?: string; userId?: string }, role: string, label?: string) => {
    try {
      const res = await assignRole({
        data: { ...target, role: role === "user" ? null : (role as "admin" | "moderator") },
      });
      toast.success(`Role updated${res?.email ? ` for ${res.email}` : label ? ` for ${label}` : ""}`);
      refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The role could not be updated.");
      return false;
    }
  };

  const assignByEmailOrId = () => {
    const value = assignTarget.trim();
    if (!value) return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    void changeRole(isUuid ? { userId: value } : { email: value }, newRole, value).then((ok) => {
      if (ok) setAssignTarget("");
    });
  };

  const toggleBan = async (id: string) => {
    const { data: me } = await supabase.auth.getUser();
    const { error } = banned.has(id)
      ? await supabase.from("banned_users").delete().eq("user_id", id)
      : await supabase.from("banned_users").insert({ user_id: id, banned_by: me.user?.id ?? null });
    if (error) toast.error(error.message); else refresh();
  };
  const addWord = async () => {
    if (!word.trim()) return;
    const { error } = await supabase.from("banned_words").insert({ word: word.trim().toLowerCase() });
    if (error) toast.error(error.message); else { setWord(""); refresh(); }
  };
  const delWord = async (id: string) => {
    const { error } = await supabase.from("banned_words").delete().eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };

  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 pb-24 pt-28 sm:px-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Control room</p>
          <h1 className="mt-2 text-5xl font-medium glow-text">Admin</h1>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button asChild size="sm" variant="secondary"><Link to="/ingest">Ingest a PDF</Link></Button>
            <Button size="sm" variant="secondary" disabled={syncing} onClick={() => void syncExport()}>
              {syncing ? "Syncing…" : "Sync lore export"}
            </Button>
          </div>
        )}
      </header>

      <AdminAccordion title="Members Management">
        {isAdmin && (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Member email or user ID"
              value={assignTarget}
              onChange={(e) => setAssignTarget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && assignByEmailOrId()}
            />
            <select
              aria-label="Role to assign"
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
            <Button onClick={assignByEmailOrId}>Assign role</Button>
          </div>
        )}
        <ul className="grid gap-2">
          {(data?.profiles ?? []).map((p) => {
            const superadmin = isSuperadminEmail(p.email);
            return (
              <li key={p.id} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {p.display_name || p.email}
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">{p.id}</span>
                  {superadmin && <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">Superadmin</span>}
                </span>
                {isAdmin && p.email && (
                  superadmin ? (
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs">Admin</span>
                  ) : (
                    <select
                      aria-label={`Role for ${p.email}`}
                      className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground"
                      value={effectiveRole(p.id)}
                      onChange={(e) => void changeRole({ email: p.email as string }, e.target.value)}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  )
                )}
                <Button size="sm" variant={banned.has(p.id) ? "secondary" : "destructive"} onClick={() => toggleBan(p.id)}>
                  {banned.has(p.id) ? "Unblock" : "Block"}
                </Button>
              </li>
            );
          })}
        </ul>
      </AdminAccordion>

      {isAdmin && <AdminAccordion title="Series & Seasons"><AdminSeries /></AdminAccordion>}
      {isAdmin && <AdminAccordion title="Typography & Theme"><AdminTypography /><AdminAppearance /></AdminAccordion>}
      {isAdmin && <AdminAccordion title="Ability Assignments"><AdminCharacterAbilities /></AdminAccordion>}
      {isAdmin && <AdminAccordion title="Audio Controls"><AdminAudio /></AdminAccordion>}
      {isAdmin && <AdminAccordion title="Reader UI Toggles"><AdminUiToggles /></AdminAccordion>}
      {isAdmin && <AdminAccordion title="Navigation Visibility"><AdminNavVisibility /></AdminAccordion>}
      <AdminAccordion title="Episode Drafts & Banned Words">
        {isAdmin && <AdminEpisodes />}
        <div className="mb-3">
          <h3 className="mb-2 text-lg">Banned words</h3>
        <div className="mb-3 flex gap-2">
          <Input placeholder="Add a word" value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addWord()} />
          <Button onClick={addWord}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(data?.words ?? []).map((w) => (
            <span key={w.id} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
              {w.word}
              <button aria-label={`Remove ${w.word}`} onClick={() => delWord(w.id)}><Trash2 className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        </div>
      </AdminAccordion>

      {(conflicts ?? []).length > 0 && <AdminAccordion title={`Lore Conflicts / Contradictions (${conflicts?.length ?? 0})`} defaultOpen><AdminContradictions conflicts={conflicts ?? []} /></AdminAccordion>}

      <section className="glass rounded-2xl p-5">
        <h2 className="mb-3 text-2xl">Recent activity</h2>
        <ul className="grid gap-1 text-sm">
          {(data?.log ?? []).map((l) => (
            <li key={l.id} className="flex gap-3">
              <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
              <span className="truncate">{emailOf(l.user_id)} — {l.action}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
