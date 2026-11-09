/** Strip internal merge/ingestion tags (e.g. "[Merged Info]:", "[Auto-Merged ...]") from lore text before display. */
export function stripMerged(t: string | null | undefined): string {
  return (t ?? "")
    .replace(/\[\s*(Merged Info|Auto-Merged|Auto-Stub|conflict|merge|scope|resolved)[^\]]*\]\s*:?/gi, "")
    .replace(/Merged Info\s*:/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
