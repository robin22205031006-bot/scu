import { lazy, Suspense, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Castle, Clock, Network, Shield } from "lucide-react";
import { SectionBoundary } from "@/components/section-boundary";
import { PanelSkeleton } from "@/components/route-skeleton";
import { CrimsonBloodlineTheme } from "@/components/ability-canvas";

const Orgs = lazy(() => import("./orgs").then((m) => ({ default: m.Orgs })));
const Clans = lazy(() => import("./clans").then((m) => ({ default: m.Clans })));
const Timeline = lazy(() => import("./timeline").then((m) => ({ default: m.Timeline })));
const RelationshipGraph = lazy(() => import("@/components/relationship-graph").then((m) => ({ default: m.RelationshipGraph })));

export const Route = createFileRoute("/_authenticated/archive")({
  head: () => ({
    meta: [
      { title: "Archive — Sentinels Cinematic Universe" },
      { name: "description", content: "The SCU lore vault: organizations, clans, bloodlines, knowledge graph and timeline." },
    ],
  }),
  component: Archive,
});

type Module = "orgs" | "clans" | "graph" | "timeline";

const MODULES: { id: Module; icon: typeof Shield; t: string; d: string }[] = [
  { id: "orgs", icon: Shield, t: "Organization Charts", d: "DEW, H.A.W.K.S., Covenant and every faction structure." },
  { id: "clans", icon: Castle, t: "Clans & Bloodlines", d: "Kurohana, Kazumi, Demon Clan, Al-Mansur and other lineages." },
  { id: "graph", icon: Network, t: "Knowledge Graph", d: "The living web linking characters, clans, factions and powers." },
  { id: "timeline", icon: Clock, t: "Canon Timeline", d: "Season 1 through Season 5 chronological history." },
];

function Archive() {
  const [module, setModule] = useState<Module>("orgs");
  const active = MODULES.find((m) => m.id === module)!;

  return (
    <main className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-5">
      <CrimsonBloodlineTheme className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-25" />
      <header className="mb-6 pt-28">
        <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Lore Vault</p>
        <h1 className="mt-2 text-5xl font-medium glow-text">Archive</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The deep vault of the universe — structures, bloodlines, connections and history.
        </p>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => (
          <button
            key={m.id}
            onClick={() => setModule(m.id)}
            className={`glass rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 ${module === m.id ? "glow-ring border-accent/50" : "hover:glow-ring"}`}
          >
            <m.icon className={`h-6 w-6 ${module === m.id ? "text-accent" : "text-muted-foreground"}`} />
            <h2 className="mt-3 text-lg font-medium">{m.t}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{m.d}</p>
          </button>
        ))}
      </div>

      <section aria-label={active.t}>
        <SectionBoundary key={module} label={active.t}>
          <Suspense fallback={<PanelSkeleton className="h-[50vh]" />}>
            {module === "orgs" && <Orgs />}
            {module === "clans" && <Clans />}
            {module === "graph" && (
              <div className="glass rounded-2xl p-4">
                <RelationshipGraph />
              </div>
            )}
            {module === "timeline" && <Timeline />}
          </Suspense>
        </SectionBoundary>
      </section>
    </main>
  );
}
