// Append per-series character growth canon (from Scu map.pdf analysis) to updates.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "public", "lore-export", "updates.json");
const SRC = "SCU canon PDFs — Scu map (growth analysis)";
const updates = JSON.parse(fs.readFileSync(OUT, "utf8"));

const G = [
  ["Nyxia", "S1: confused aether leak → the Cube is handed to her unasked — the world chose her. S3: confronts Asetra, the origin of what she carries, without breaking. S5: chooses revenge consciously — maximum agency, the full distance from accidental leaks to deliberate wrath; her Aether Dominion destroys Alt David.", "Nyxia chooses revenge consciously. Doesn't lose control — DECIDES.", "Alive"],
  ["Ethan", "S1: stripped down — chained, 'killed', imprisoned by Stitch for the crime of being right; the crucible everything later builds on. S3: defeats Elizah by REJECTING his own blood power — his highest moral moment, restraint over the easy bloodline path. S5 THE PEAK: wields wind AND blood together, finally accepts Elizah — a child's refusal becomes an adult's synthesis; his death completes the arc.", "He spent S3 rejecting blood power on principle. He spent S5 INTEGRATING it with wisdom.", "Dead"],
  ["Elizah", "S1: seed planted — Ethan's 'death' is the first condition of her existence. S2: the gravitational center — from awakened to undeniable, 'necessary cruelty the world forced into existence'; S2 is her defining season.", "She moves from awakened to undeniable. Necessary cruelty the world forced into existence.", "Alive"],
  ["Zayn", "S1: framed as THE lead — discovers being the face doesn't make you the center. S2: learns of his too-late brotherhood with David — loss-shaped growth.", "He finds out what he had right as it's taken.", "Alive"],
  ["Samuel", "S1: one definitive moment — punched Stitch and walked; the nose scar Stitch carries for the rest of the series IS Samuel's arc compressed into one action. Growth here is refusal.", "That nose scar Stitch carries for the rest of the series IS Samuel's S1 arc compressed into one action.", "Alive"],
  ["Grace", "S2: awakens Athena's Judgement — born into power and cost in the same season, pays mentally immediately. S3: retires, mentally exhausted, honoring her own limits. S5: returns not as a healer but as Judgment — hardened, not broken.", "She returns not as a healer but as Judgment.", "Alive"],
  ["Yoshiko", "S2: enters as 'just a manager' — isn't; quiet depth surfaces without announcement. Redline S1: fully operational spy in the field. Redline S2: Corvani dies while Samuel is absent; she chooses to leave and join The Obsidians — conviction over collapse.", "She doesn't collapse, she decides.", "Alive"],
  ["Arashi", "S2: recontextualizes Nullborn for the entire universe — his presence grows the audience's understanding of the world. Dies at the start of S5 by Alt David and the Kurohana clan, watching Kazumi's face, never knowing she'll one day understand him — vindicated too late.", "Vindicated too late. That's his tragedy and it's airtight.", "Dead"],
  ["Silas", "S2: appears like a myth walking into reality — even the entrance is an event.", "Appears like a myth walking into reality.", "Alive"],
  ["Corvani", "S2: returns tired, principled, furious — re-establishes as the human spine; his finest hour. S4: returns from the pocket dimension with forbidden knowledge — not the same man who entered. Redline S2: dies while Samuel is absent.", "Whatever came back from that pocket dimension is not the same man who entered.", "Dead"],
  ["Arzuna", "S3: villain-to-anti-hero — the cleanest arc flip in the SCU, earned through what she refuses to do. S5: kills Maliha — love corrupted by grief; the anti-hero completes through the hardest single act.", "No clean hands, but a completed choice.", "Alive"],
  ["Derek Miles", "S3: chip removal, first crack — 'I choose'; starts becoming a person rather than a weapon. Redline S2: becomes acting commanding officer while Samuel is absent — choosing for others.", "The personal growth of S3 becomes professional responsibility here.", "Alive"],
  ["Aariz", "S3: chases strength, gets humbled — growth through collision with his own ceiling.", "The lesson arrives hard.", "Alive"],
  ["Nilanjona", "S4: accepts guardianship and steps away — a complete arc in one action; she doesn't fight the role, she walks into it and walks off. Full circle.", "The acceptance IS the peak.", "Alive"],
  ["Niharo", "S4: steps forward as the new existential threat — the world level-shifting to accommodate him.", "His emergence IS his growth in the narrative sense.", "Alive"],
  ["Eldrich Aldercrest", "S4: still guarding the throne while everything reorganizes — his constancy IS his character; the man who doesn't move while the world rewrites itself.", "His constancy IS his character.", "Alive"],
  ["Kazumi", "Bloodlines: discovers she's Yoshiko's twin sister — spent her life hating the wrong people under a false identity; the truth destroys what she thought she was, then demands she rebuild. Redline S2: finishes rebuilding the Kara clan with Mashiho, then joins The Obsidians — completion and beginning in one breath.", "She closes one chapter and starts another without a breath between them.", "Alive"],
  ["Mashiho", "Bloodlines: fights and kills his own father Pride during the clan slaughter — judgment on the family meant to protect him. Then rebuilds the Kara clan with Kazumi and joins The Obsidians.", "Growth through the most specific kind of devastation.", "Alive"],
  ["Ayaan", "Redline S1: frontliner — the chair guy is fighting now; the most visually dramatic shift of his arc. Redline S2: COMMANDING LEAD — from support chair to directing the entire operation; the longest single distance traveled in the SCU.", "The chair. The commanding officer seat. That distance is the longest single character traveled in this universe.", "Alive"],
  ["Saya", "Redline S1: operative arc building — the spark with Arvin hinted. Redline S2: joins The Obsidians knowing the full cost — Arvin and Samuel on the other side — growth through choosing cause over comfort.", "Growth through choosing cause over comfort when both cost something real.", "Alive"],
  ["Arvin", "Redline S1: debut — the spark with Saya; everything after traces back to what starts here.", "Everything that comes after traces back to what starts here.", "Alive"],
];

let n = 0;
for (const [name, facts, quote, status] of G) {
  if (updates.some((u) => u.existing_name === name && u.quote === quote)) continue;
  updates.push({ existing_name: name, new_facts: facts, status, quote, source: SRC });
  n++;
}
fs.writeFileSync(OUT, JSON.stringify(updates, null, 2));
console.log(`added ${n} growth entries; total ${updates.length}`);
