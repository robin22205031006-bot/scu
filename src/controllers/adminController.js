import { parsePdf } from "../utils/pdfParser.js";

/** Coordinate the upload; authenticated server functions own extraction and writes. */
export async function ingestAdminPdf(file, { analyze, apply, refresh, onStage, readPdf = parsePdf }) {
  onStage("reading");
  const text = await readPdf(file);
  onStage("analyzing");
  const extraction = await analyze({ data: { text } });
  onStage("saving");
  // Refresh even when a checked write reports partial failure.
  try {
    return await apply({ data: { ...extraction, filename: file.name, source_text: text } });
  } finally {
    await refresh();
  }
}