import type { Extraction } from "../lib/lore-merge";

export type IngestStage = "idle" | "reading" | "analyzing" | "saving";
export interface IngestSummary { created: number; updated: number; events: number }
export interface AdminIngestDependencies {
  analyze: (input: { data: { text: string } }) => Promise<Extraction>;
  apply: (input: { data: Extraction & { filename: string; source_text: string } }) => Promise<IngestSummary>;
  refresh: () => Promise<unknown>;
  onStage: (stage: IngestStage) => void;
  readPdf?: (file: File) => Promise<string>;
}
export function ingestAdminPdf(file: File, dependencies: AdminIngestDependencies): Promise<IngestSummary>;