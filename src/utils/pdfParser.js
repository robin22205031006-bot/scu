/** Extract PDF text in the browser; never load PDF.js in server execution. */
export async function parsePdf(file) {
  if (!file || (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf")) {
    throw new Error("Choose a PDF file.");
  }
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  try {
    const doc = await task.promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      try {
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
      } finally {
        page.cleanup();
      }
    }
    const text = pages.join("\n\n");
    if (text.trim().length < 20) throw new Error("No readable text found in this PDF. Upload a text-based PDF instead of a scan.");
    if (text.length > 400_000) throw new Error("This PDF contains too much text. Split it into smaller PDFs.");
    return text;
  } finally {
    await task.destroy();
  }
}