// Canon ability sync from Characters.txt — merges ability keys + weapon/trait lore notes.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

// name -> { abilities: [...], traits: [...], note: "..." }
const MAP = {
  "Niharo": { abilities: ["omni_ergon"], note: "Omni-Ergon: absorbs, controls, converts and releases any energy form. Season 5 core ability." },
  "Xinea": { abilities: ["aether_dominion"], note: "Nyxia Prime core: Aether Dominion — command over the aether." },
  "Elizah": { abilities: ["hemokinesis", "blood_manipulation"], traits: ["Omen sight"], note: "Hemokinesis — complete blood control. Blood Art signature." },
  "Zayn": { abilities: ["astrapo_electrokinesis", "red_lightning"], note: "Astrapo-Electrokinesis — lightning/electricity/thunder control. Lightning specialist." },
  "Nilanjona": { abilities: ["hydrokinesis", "cryokinesis", "water_guardian"], note: "Hydrokinesis — water in all states. Water Guardian state unlocks Cryokinesis." },
  "Ethan": { abilities: ["aerokinesis", "wind_guardian"], note: "Ethan-Wind / Ethan-Gale Warden. Defeats the Wind Guardian in S5." },
  "Grace": { abilities: ["hydrokinesis"], note: "Water Arts primary ability." },
  "Ayaan": { abilities: ["super_speed"], note: "Speed + athletic + super flexible." },
  "David": { abilities: ["destructive_legendary"], note: "Red Flame Fist + super strength." },
  "Maliha": { abilities: ["tech_genius"], note: "Tech Genius + tech support. Guardian Spiral — daggers orbit defensively." },
  "Aariz": { abilities: ["bestiakinesis"], note: "Beast Clan — The Nature Guardian lineage." },
  "Saya": { abilities: ["nature_guardian"], note: "Disciple of the Nature Guardian (Nytheris). Verdant Sphere technique." },
  "Yoshiko": { abilities: ["draconic_flame", "draconic_flame"], note: "Elf Clan — Seraph of the Ash / Dragon Slayer." },
  "Agnus": { abilities: ["qahr_al_wujud", "architect_cube_guardian"], note: "Qahr al-Wujud + Intent-Responsive Weapon Manifestation (blades)." },
  "Silas": { abilities: ["demonic"], note: "Duskmoor — signature combat style." },
  "Derek": { abilities: ["water_guardian"], note: "The Whale — water affinity." },
  "Eldrich": { abilities: ["cryokinesis"], note: "Aldercrest bloodline — ice affinity." },
  "Khalid": { abilities: ["gladiokinesis"], note: "Gladiokinesis — dagger/wrist-blade manifestation (signature spatial tears)." },
};

const { data: ents, error } = await sb.from("entities").select("id,name,abilities,beast_traits");
if (error) throw error;
const byName = new Map(); for (const e of ents) { byName.set(e.name.toLowerCase(), e); for (const a of (e.alias ? [e.alias] : [])) byName.set(String(a).toLowerCase(), e); }
const ALIAS = { zayn: ["zayn hayes"], ethan: ["alt ethan","robin","ethan thorne"], ayaan: ["samuel","samuel sterling","ayaan siddique"], aariz: ["aariz maddox"], derek: ["derek miles"], eldrich: ["eldrich aldercrest"] };
let updated = 0, notes = 0;
for (const [name, m] of Object.entries(MAP)) {
  let e = byName.get(name.toLowerCase());
  if (!e) for (const alt of ALIAS[name.toLowerCase()] ?? []) { e = byName.get(alt); if (e) break; }
  if (!e) { console.log("MISS", name); continue; }
  const cur = new Set(e.abilities ?? []);
  const add = m.abilities.filter(Boolean).filter(a => !cur.has(a));
  if (add.length) {
    const { error: uerr } = await sb.from("entities").update({ abilities: [...(e.abilities ?? []), ...add], updated_at: new Date().toISOString() }).eq("id", e.id);
    if (uerr) { console.log("ERR", name, uerr.message); continue; }
    updated++;
  }
  if (m.traits?.length) {
    const curT = new Set(e.beast_traits ?? []);
    const addT = m.traits.filter(t => !curT.has(t));
    if (addT.length) await sb.from("entities").update({ beast_traits: [...(e.beast_traits ?? []), ...addT] }).eq("id", e.id);
  }
  if (m.note) {
    const { error: nerr } = await sb.from("lore_notes").insert({ entity_id: e.id, text: `[abilities] ${m.note}`, source: "Characters.pdf" });
    if (nerr) console.log("NOTE_ERR", name, nerr.message); else notes++;
  }
}
console.log(`updated=${updated} notes=${notes}`);
