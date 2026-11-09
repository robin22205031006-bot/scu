import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, FileLock, Home, Search, Shield, Sparkles, Users } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-admin";

const PAGES = [
  { to: "/", label: "Home", icon: Home },
  { to: "/characters", label: "Characters", icon: Users },
  { to: "/orgs", label: "Orgs & Bloodlines", icon: Shield },
  { to: "/timeline", label: "Timeline", icon: Clock },
  { to: "/fandom", label: "Fandom", icon: Sparkles },
  { to: "/vault", label: "PDF Vault", icon: FileLock },
  { to: "/reader", label: "Reader Mode", icon: BookOpen },
] as const;

export function UniversalSearch() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { data: user } = useSession();
  const { data } = useQuery({
    queryKey: ["search-index", user?.id],
    staleTime: 60_000,
    enabled: open && !!user,
    queryFn: async () => {
      const [e, t, d, n] = await Promise.all([
        supabase.from("entities").select("id, name, alias, kind"),
        supabase.from("timeline_events").select("id, title, era"),
        supabase.from("vault_documents").select("id, title"),
        supabase.from("lore_notes").select("entity_id, text"),
      ]);
      for (const result of [e, t, d, n]) if (result.error) throw result.error;
      return { entities: e.data ?? [], events: t.data ?? [], docs: d.data ?? [], notes: n.data ?? [] };
    },
  });

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const entityName = new Map((data?.entities ?? []).map((e) => [e.id, e.name]));
  const goEntity = (e: { id: string; name: string; kind: string }) => {
    setOpen(false);
    nav({
      to: e.kind === "character" ? "/characters" : "/orgs",
      search: { q: e.name, open: e.id },
    });
  };

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Search the universe (Ctrl+K)" title="Search (Ctrl+K)" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground">
        <Search className="h-3.5 w-3.5" />
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={user ? "Search characters, orgs, events, lore, documents…" : "Sign in to search the archive"} />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {user && (
            <CommandGroup heading="Go to">
              {PAGES.map((p) => {
                const Icon = p.icon;
                return (
                  <CommandItem key={p.to} value={`page ${p.label}`} onSelect={() => { setOpen(false); nav({ to: p.to }); }}>
                    <Icon className="mr-2 h-3.5 w-3.5 text-accent" />{p.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {user && data && (
            <>
              <CommandGroup heading="Archive">
                {data.entities.map((e) => (
                  <CommandItem key={e.id} value={`${e.name} ${e.alias ?? ""} ${e.kind}`} onSelect={() => goEntity(e)}>
                    {e.name} <span className="ml-auto text-xs capitalize text-muted-foreground">{e.kind}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Lore notes">
                {data.notes.slice(0, 200).map((n, i) => {
                  const name = entityName.get(n.entity_id) ?? "Unknown";
                  const snippet = n.text.replace(/\s+/g, " ").slice(0, 90);
                  return (
                    <CommandItem
                      key={`${n.entity_id}-${i}`}
                      value={`${name} ${n.text}`}
                      onSelect={() => {
                        const ent = data.entities.find((x) => x.id === n.entity_id);
                        if (ent) goEntity(ent);
                      }}
                    >
                      <span className="truncate">{name} — {snippet}{n.text.length > 90 ? "…" : ""}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandGroup heading="Timeline">
                {data.events.map((e) => (
                  <CommandItem key={e.id} value={`${e.title} ${e.era ?? ""}`} onSelect={() => { setOpen(false); nav({ to: "/timeline" }); }}>
                    {e.title} <span className="ml-auto text-xs text-muted-foreground">{e.era}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="PDF Vault">
                {data.docs.map((d) => (
                  <CommandItem key={d.id} value={d.title} onSelect={() => { setOpen(false); nav({ to: "/vault" }); }}>{d.title}</CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
