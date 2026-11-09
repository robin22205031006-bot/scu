import { createFileRoute } from "@tanstack/react-router";
import { RelationshipGraph } from "@/components/relationship-graph";

export const Route = createFileRoute("/_authenticated/graph")({
  head: () => ({
    meta: [
      { title: "Relationship Graph — Sentinels Cinematic Universe" },
      { name: "description", content: "Interactive network map of SCU characters, bloodlines, clans and organizations." },
      { property: "og:title", content: "Relationship Graph — SCU" },
      { property: "og:description", content: "The interconnected web of the Sentinels Cinematic Universe." },
    ],
  }),
  component: Graph,
});

function Graph() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-5">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Chronicle</p>
        <h1 className="mt-2 text-5xl font-medium glow-text">Relationship Graph</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The living web of the archive — every bond between characters and the factions, clans, bloodlines and organizations they serve.
        </p>
      </header>
      <RelationshipGraph />
    </main>
  );
}
