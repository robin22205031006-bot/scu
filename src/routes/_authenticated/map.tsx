import { createFileRoute } from "@tanstack/react-router";
import { TacticalMap } from "@/components/tactical-map";
import { useSectionStyle } from "@/hooks/use-typography";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "Tactical Map — Sentinels Cinematic Universe" },
      { name: "description", content: "Interactive tactical map of SCU locations, factions, battles, and stationed Sentinels." },
      { property: "og:title", content: "Tactical Map — SCU" },
      { property: "og:description", content: "Field reports and strategic positions across the SCU theater." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const sectionStyle = useSectionStyle("timeline");
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-5" style={sectionStyle}>
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Strategic overview</p>
        <h1 className="mt-2 text-5xl font-medium glow-text">Tactical Map</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Known locations, controlling factions, historic battles, and Sentinel deployments across the SCU theater.
        </p>
      </header>
      <TacticalMap />
    </main>
  );
}
