/**
 * Split extracted PDF text into RAG chunks (~900 chars target, 10% overlap),
 * preferring paragraph/sentence boundaries so chunks stay semantically coherent.
 */
export function chunkText(text: string, target = 900, overlapRatio = 0.1): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!clean) return [];
  const overlap = Math.floor(target * overlapRatio);
  const chunks: string[] = [];
  let i = 0;

  while (i < clean.length) {
    let end = Math.min(i + target, clean.length);
    if (end < clean.length) {
      // Prefer breaking at a paragraph, then sentence, then whitespace.
      const window = clean.slice(i, end);
      const para = window.lastIndexOf("\n\n");
      const sent = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
      const space = window.lastIndexOf(" ");
      const cut = para > target * 0.5 ? para + 2 : sent > target * 0.6 ? sent + 1 : space > target * 0.5 ? space + 1 : -1;
      if (cut > 0) end = i + cut;
    }
    const chunk = clean.slice(i, end).trim();
    if (chunk.length >= 40) chunks.push(chunk);
    if (end >= clean.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return chunks;
}
