// Targeted push: only the canon extracted from the 5 SCU PDFs.
// Uses the publishable key (RLS permits these writes on this backend).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = "SCU canon PDFs";
const url = "https://c--003cbc84-1f37-48c5-886f-4a215a227e32-prod.lovable.cloud";
const key = "sb_publishable_bMvuynRqotDNoiSZT00XZw_dZ1JSvuB";
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const get = async (p) => (await fetch(`${url}/rest/v1/${p}`, { headers: h })).json();
const post = async (p, body, prefer = "return=representation") => {
  const r = await fetch(`${url}/rest/v1/${p}`, { method: "POST", headers: { ...h, Prefer: prefer }, body: JSON.stringify(body) });
  const t = await r.text();
  return { status: r.status, body: t ? JSON.parse(t) : null };
};

const entities = JSON.parse(fs.readFileSync(path.join(DIR, "public", "lore-export", "entities.json"), "utf8"));
const updates = JSON.parse(fs.readFileSync(path.join(DIR, "public", "lore-export", "updates.json"), "utf8"));
const NEW_NAMES = ["Alistair Quinn", "Sean Stone", "H.A.W.K.S.", "E.C.A.P.", "D.E.W.", "The Covenant", "The Hidden Ones", "The Forgotten Ones", "The Obsidians", "Corvani's Redline Team"];
const mine = updates.filter((u) => typeof u.source === "string" && u.source.startsWith("SCU canon PDFs"));

const archive = await get("entities?select=id,name,alias,kind,status,category,description,abilities,beast_traits,stats,sketches,image_url,parent_id&limit=1000");
const byName = new Map(archive.map((e) => [e.name.toLowerCase(), e]));
const byAlias = new Map(archive.filter((e) => e.alias).map((e) => [e.alias.toLowerCase(), e]));

// 1. Insert new entities
for (const e of entities.filter((x) => NEW_NAMES.includes(x.name))) {
  if (byName.has(e.name.toLowerCase())) { console.log("skip (exists):", e.name); continue; }
  const row = {
    kind: e.kind, name: e.name, alias: e.alias ?? null, role: e.role ?? null,
    status: e.status, description: e.description ?? "", category: e.category ?? null,
    stats: {}, sketches: [], abilities: [], beast_traits: [], image_url: null, parent_id: null,
  };
  const r = await post("entities", row);
  console.log(r.status === 201 ? "inserted" : `FAIL ${r.status}`, e.name, r.status === 201 ? "" : JSON.stringify(r.body).slice(0, 160));
  if (r.status === 201) byName.set(e.name.toLowerCase(), r.body[0]);
}

// 2. Lore notes for existing entities (resolve name → id, incl. alias fallback)
let notes = 0, missing = [];
for (const u of mine) {
  let target = byName.get(u.existing_name.toLowerCase()) ?? byAlias.get(u.existing_name.toLowerCase());
  if (!target) { missing.push(u.existing_name); continue; }
  const text = `[${u.source}] ${u.new_facts}`;
  // avoid duplicate notes
  const existing = await get(`lore_notes?entity_id=eq.${target.id}&select=text&limit=200`);
  if ((existing ?? []).some((n) => n.text === text)) continue;
  const r = await post("lore_notes", { entity_id: target.id, text, source: u.source }, "return=minimal");
  if (r.status === 201) notes++; else console.log("note FAIL", u.existing_name, r.status, JSON.stringify(r.body).slice(0, 120));
}
console.log(`\nDone: ${notes} lore notes added. Unresolved names: ${missing.length ? missing.join(", ") : "none"}`);
