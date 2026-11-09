import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  characterLinksQuery,
  entityByIdQuery,
  groupLinksQuery,
  notesQuery,
  type Entity,
  type EntityMembership,
} from "@/lib/entities";

export const Route = createFileRoute("/_authenticated/reader")({
  validateSearch: (s: Record<string, unknown>): { e?: string } =>
    typeof s["e"] === "string" ? { e: s["e"] } : {},
  head: () => ({
    meta: [
      { title: "Reader Mode — Sentinels Cinematic Universe" },
      { name: "description", content: "Immersive reading view for SCU lore." },
    ],
  }),
  component: Reader,
});

interface TocItem {
  id: string;
  label: string;
}

function slug(s: string, i: number) {
  return `sec-${i}-${s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`;
}

function Reader() {
  const { e: entityId } = Route.useSearch();
  const [tocOpen, setTocOpen] = useState(true);

  const { data: entity, isLoading } = useQuery(entityByIdQuery(entityId ?? ""));
  const { data: notes } = useQuery({ ...notesQuery(entityId ?? ""), enabled: !!entityId });

  // Affiliation names (both directions) for the contents + body.
  const { data: charLinks } = useQuery({ ...characterLinksQuery(entity?.id ?? ""), enabled: entity?.kind === "character" });
  const { data: grpLinks } = useQuery({ ...groupLinksQuery(entity?.id ?? ""), enabled: !!entity && entity.kind !== "character" });
  const memberships = useMemo(
    () => [...(charLinks ?? []), ...(grpLinks ?? [])] as EntityMembership[],
    [charLinks, grpLinks],
  );
  const otherIds = useMemo(
    () => [...new Set(memberships.map((m) => (entity?.kind === "character" ? m.group_id : m.character_id)))],
    [memberships, entity?.kind],
  );
  const { data: linked } = useQuery({
    queryKey: ["reader-links", otherIds.sort().join(",")],
    enabled: otherIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("entities").select("id, name, kind, status").in("id", otherIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const archiveTo = entity?.kind === "character" ? "/characters" : "/orgs";

  const toc: TocItem[] = useMemo(() => {
    if (!entity) return [];
    const items: TocItem[] = [{ id: "sec-overview", label: "Overview" }];
    if (Object.keys((entity.stats as Record<string, unknown>) ?? {}).length > 0) items.push({ id: "sec-stats", label: "Records" });
    if ((linked ?? []).length > 0) items.push({ id: "sec-affiliations", label: "Affiliations" });
    (notes ?? []).forEach((n, i) => items.push({ id: slug(n.source ?? `Note ${i + 1}`, i), label: n.source ?? `Note ${i + 1}` }));
    return items;
  }, [entity, notes, linked]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (isLoading) return <main className="mx-auto max-w-3xl px-4 pb-24 pt-32 text-sm text-muted-foreground">Loading…</main>;
  if (!entity) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-32">
        <p className="text-sm text-muted-foreground">No entry selected.</p>
        <Button asChild variant="secondary" className="mt-4"><Link to="/characters">Browse characters</Link></Button>
      </main>
    );
  }

  const stats = Object.entries((entity.stats as Record<string, string>) ?? {});
  const noteSections = (notes ?? []).map((n, i) => ({ n, id: slug(n.source ?? `Note ${i + 1}`, i) }));
  const byId = new Map((linked ?? []).map((l) => [l.id, l]));
  const affiliationRows = memberships
    .map((m) => ({ m, other: byId.get(entity.kind === "character" ? m.group_id : m.character_id) }))
    .filter((r): r is { m: EntityMembership; other: NonNullable<typeof r.other> } => !!r.other)
    .sort((a, b) => a.other.name.localeCompare(b.other.name));

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-5">
      <Link to={archiveTo} className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to archive
      </Link>

      <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
        {/* Table of contents */}
        {tocOpen && toc.length > 1 && (
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="glass rounded-2xl p-4">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
                <List className="h-3 w-3" /> Contents
              </p>
              <nav className="mt-3 grid gap-1">
                {toc.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => scrollTo(t.id)}
                    className="truncate rounded-lg px-2 py-1 text-left text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        )}

        {/* Reading column */}
        <article className="min-w-0">
          <header className="mb-10 border-b border-border pb-8">
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent">{entity.kind} · {entity.status}</p>
            <h1 className="mt-3 font-display text-5xl font-medium glow-text sm:text-6xl">{entity.name}</h1>
            {(entity.alias || entity.role || entity.category) && (
              <p className="mt-3 text-sm text-muted-foreground">{[entity.alias, entity.role, entity.category].filter(Boolean).join(" · ")}</p>
            )}
          </header>

          <section id="sec-overview" className="mb-12 scroll-mt-28">
            <h2 className="mb-4 font-display text-2xl">Overview</h2>
            {entity.description ? (
              <p className="whitespace-pre-line text-lg leading-9 text-foreground/85">{entity.description}</p>
            ) : (
              <p className="text-muted-foreground">No description recorded.</p>
            )}
          </section>

          {stats.length > 0 && (
            <section id="sec-stats" className="mb-12 scroll-mt-28">
              <h2 className="mb-4 font-display text-2xl">Records</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                {stats.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{k}</dt>
                    <dd className="mt-1 text-base">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {affiliationRows.length > 0 && (
            <section id="sec-affiliations" className="mb-12 scroll-mt-28">
              <h2 className="mb-4 font-display text-2xl">Affiliations</h2>
              <div className="grid gap-2">
                {affiliationRows.map(({ m, other }) => (
                  <Link
                    key={m.id}
                    to={other.kind === "character" ? "/characters" : "/orgs"}
                    search={{ q: other.name, open: other.id }}
                    className="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-2.5 text-sm hover:bg-secondary/70"
                  >
                    <span>{other.name}</span>
                    <span className="text-xs capitalize text-muted-foreground">{other.kind} · {m.status}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {noteSections.map(({ n, id }) => (
            <section key={id} id={id} className="mb-10 scroll-mt-28 border-l-2 border-accent/50 pl-5">
              <h2 className="mb-2 font-display text-xl">{n.source ?? "Lore note"}</h2>
              <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                {[n.source, new Date(n.created_at).toLocaleDateString()].filter(Boolean).join(" · ")}
              </p>
              <p className="whitespace-pre-line text-lg leading-9 text-foreground/85">{n.text}</p>
            </section>
          ))}
        </article>
      </div>

      {/* Mobile TOC toggle */}
      <Button
        variant="secondary"
        size="sm"
        className="fixed bottom-6 left-4 z-30 gap-1.5 rounded-full lg:hidden"
        onClick={() => setTocOpen((v) => !v)}
      >
        <BookOpen className="h-3.5 w-3.5" /> {tocOpen ? "Hide" : "Contents"}
      </Button>
    </main>
  );
}
