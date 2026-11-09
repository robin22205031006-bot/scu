/** Official SCU canon series/season hierarchy — single source of truth. */
export const CANON_SERIES = [
  { title: "Sentinels", seasons: [1, 2, 3, 4, 5] },
  { title: "Redline", seasons: [1, 2] },
  { title: "Bloodline", seasons: [1] },
  { title: "Divine Beast", seasons: [1] },
  { title: "Standalone Epics", seasons: [] },
] as const;

/** Flat list of selectable timeline scopes, e.g. "Sentinels S3". */
export const CANON_SCOPES = CANON_SERIES.flatMap((s) =>
  s.seasons.map((n) => `${s.title} S${n}`),
);

export type CanonSeriesTitle = (typeof CANON_SERIES)[number]["title"];
