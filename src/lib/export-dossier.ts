import { jsPDF } from "jspdf";
import type { Entity } from "@/lib/entities";
import { COMBAT_STATS, getCombatStats } from "@/lib/combat-stats";

export interface DossierGroup {
  name: string;
  kind: string;
  status?: string | null;
}

const INK = "#0b0b10";
const PAPER = "#f4f1ea";
const ACCENT = "#b91c1c";
const GOLD = "#b8860b";
const MUTED = "#6b7280";

function wrap(text: string, width: number, doc: jsPDF): string[] {
  return doc.splitTextToSize(text, width) as string[];
}

/** Generate and download an official SCU tactical dossier PDF for an entity. */
export async function exportDossierPdf(entity: Entity, groups: DossierGroup[] = []) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  const CW = W - M * 2;
  let y = 0;

  const ensure = (need: number) => {
    if (y + need > doc.internal.pageSize.getHeight() - 18) {
      doc.addPage();
      y = M;
    }
  };

  // ---- Header band ----
  doc.setFillColor(INK);
  doc.rect(0, 0, W, 34, "F");
  doc.setFillColor(ACCENT);
  doc.rect(0, 34, W, 1.4, "F");
  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("SENTINELS CINEMATIC UNIVERSE // ARCHIVE DIVISION", M, 10);
  doc.setTextColor("#ffffff");
  doc.setFontSize(22);
  doc.text(entity.name.toUpperCase(), M, 21);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#d4d4d8");
  const sub = [entity.kind.toUpperCase(), entity.category, entity.status, entity.role].filter(Boolean).join("  ·  ");
  doc.text(sub.slice(0, 110), M, 28);
  doc.text(`DOSSIER ${entity.id.slice(0, 8).toUpperCase()}  ·  ${new Date().toISOString().slice(0, 10)}`, W - M, 10, { align: "right" });
  doc.setTextColor(INK);
  y = 44;

  // ---- Portrait ----
  if (entity.image_url?.startsWith("data:image")) {
    try {
      doc.addImage(entity.image_url, "JPEG", M, y, 34, 42);
      doc.setDrawColor(ACCENT);
      doc.setLineWidth(0.6);
      doc.rect(M, y, 34, 42);
    } catch {
      /* image skipped */
    }
  }
  const bioX = entity.image_url?.startsWith("data:image") ? M + 40 : M;
  const bioW = CW - (entity.image_url?.startsWith("data:image") ? 40 : 0);

  // ---- Biography ----
  if (entity.description?.trim()) {
    ensure(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(ACCENT);
    doc.text("BIOGRAPHY", bioX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(INK);
    for (const line of wrap(entity.description.trim(), bioW, doc)) {
      ensure(4.6);
      doc.text(line, bioX, y);
      y += 4.6;
    }
    y += 4;
  }

  // ---- Combat stats ----
  const combat = getCombatStats(entity.stats);
  const canonKeys = new Set<string>(COMBAT_STATS.map((s) => s.key));
  const statsObj = (entity.stats && typeof entity.stats === "object" ? entity.stats : {}) as Record<string, unknown>;
  const customStats = Object.entries(statsObj).filter(([k]) => {
    const nk = k.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return !canonKeys.has(nk);
  });
  if (combat || customStats.length) {
    ensure(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(ACCENT);
    doc.text("COMBAT METRICS", M, y);
    y += 6;
    const barX = M + 42;
    const barW = CW - 60;
    const rows: [string, number][] = combat
      ? COMBAT_STATS.map((s) => [s.label.toUpperCase(), combat[s.key]] as [string, number])
      : [];
    for (const [k, v2] of customStats) {
      const n = Number(v2);
      if (!Number.isNaN(n)) rows.push([k.toUpperCase(), Math.min(100, Math.max(0, n))]);
    }
    for (const [label, val] of rows) {
      ensure(7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(INK);
      doc.text(label.slice(0, 30), M, y + 3.5);
      doc.setTextColor(MUTED);
      doc.text(String(val), M + CW - 8, y + 3.5, { align: "right" });
      doc.setFillColor("#e5e0d5");
      doc.rect(barX, y, barW, 3.4, "F");
      doc.setFillColor(val >= 75 ? ACCENT : val >= 40 ? GOLD : MUTED);
      doc.rect(barX, y, (barW * val) / 100, 3.4, "F");
      y += 7.5;
    }
    y += 3;
  }

  // ---- Affiliation badges ----
  if (groups.length) {
    ensure(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(ACCENT);
    doc.text("AFFILIATIONS", M, y);
    y += 6;
    let cx = M;
    for (const g of groups) {
      const label = `${g.name.toUpperCase()}${g.status ? ` · ${g.status.toUpperCase()}` : ""}`;
      const w = doc.getTextWidth(label) + 8;
      if (cx + w > W - M) {
        cx = M;
        y += 9;
        ensure(9);
      }
      doc.setFillColor(INK);
      doc.roundedRect(cx, y - 4.5, w, 7, 1.5, 1.5, "F");
      doc.setDrawColor(GOLD);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, y - 4.5, w, 7, 1.5, 1.5, "S");
      doc.setTextColor("#ffffff");
      doc.setFontSize(7.5);
      doc.text(label.slice(0, 34), cx + 4, y);
      cx += w + 3;
    }
    y += 12;
  }

  // ---- Footer ----
  doc.setFillColor(PAPER);
  doc.rect(0, doc.internal.pageSize.getHeight() - 14, W, 14, "F");
  doc.setDrawColor(ACCENT);
  doc.setLineWidth(0.5);
  doc.line(M, doc.internal.pageSize.getHeight() - 14, W - M, doc.internal.pageSize.getHeight() - 14);
  doc.setFontSize(7);
  doc.setTextColor(MUTED);
  doc.text("SCU ARCHIVE — OFFICIAL DOSSIER — UNAUTHORIZED DISTRIBUTION PROHIBITED", M, doc.internal.pageSize.getHeight() - 5);
  doc.text("PAGE 1 / 1", W - M, doc.internal.pageSize.getHeight() - 5, { align: "right" });

  doc.save(`${entity.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-dossier.pdf`);
}
