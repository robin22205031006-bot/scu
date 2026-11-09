import { createFileRoute, Link } from "@tanstack/react-router";
import { SeriesPage } from "./_authenticated/series";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Sentinels Cinematic Universe — The Archive" },
      { name: "description", content: "Characters, orders, bloodlines and the timeline of the Sentinels Cinematic Universe." },
      { property: "og:title", content: "Sentinels Cinematic Universe — The Archive" },
      { property: "og:description", content: "Characters, orders, bloodlines and the timeline of the SCU." },
    ],
  }),
  component: Index,
});

const sections = [
  { to: "/characters", n: "01", t: "Characters", d: "Dossiers of every sentinel, ally and adversary." },
  { to: "/abilities", n: "02", t: "Abilities", d: "The master registry of powers, tiers and who wields them." },
  { to: "/series", n: "03", t: "Series", d: "Story arcs, episodes and where every character appears." },
  { to: "/archive", n: "04", t: "Archive", d: "Orgs, clans, graph and the full canon timeline." },
  { to: "/orgs", n: "05", t: "Orgs & Bloodlines", d: "Orders, clans, factions and lineages." },
  { to: "/timeline", n: "06", t: "Timeline", d: "The history of the universe, in order." },
] as const;

function Index() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 pb-20 pt-32">
      <p className="text-[11px] uppercase tracking-[0.3em] text-accent">The Archive</p>
      <h1 className="mt-4 text-6xl font-medium leading-[0.95] sm:text-8xl">
        Sentinels<br /><em className="text-muted-foreground">Cinematic Universe</em>
      </h1>
      <div className="mt-16 grid border-t sm:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.to} to={s.to} className="group border-b py-6 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0">
            <span className="text-xs text-muted-foreground">{s.n}</span>
            <h2 className="mt-2 text-3xl transition-colors group-hover:text-accent">{s.t}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
          </Link>
        ))}
      </div>
      <div className="mt-16">
        <SeriesPage />
      </div>

      <footer className="mt-20 border-t border-border pt-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-[11px] uppercase tracking-[0.25em] text-accent">Credits</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li><span className="text-foreground">Developer</span> — Robin (SCU Archives engineering)</li>
              <li><span className="text-foreground">Admin</span> — zananrobin@gmail.com</li>
              <li><span className="text-foreground">Editors</span> — Lore ingestion &amp; canon review team</li>
              <li><span className="text-foreground">Contributors</span> — The SCU fandom archivists</li>
            </ul>
          </div>
          <div className="flex flex-col justify-end">
            <p className="font-display text-lg italic text-muted-foreground">
              “In the silence between heartbeats, the Sentinel remembers.”
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground/60">
              SCU Easter Egg — Season 5: The Last Archive awakens when all five seals align.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
