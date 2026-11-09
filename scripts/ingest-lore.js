import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function processLorePDFs(folderPath) {
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.pdf'));
  
  for (const file of files) {
    console.log(`Processing: ${file}...`);
    const dataBuffer = fs.readFileSync(path.join(folderPath, file));
    const parsed = await pdf(dataBuffer);
    
    const prompt = `
      Extract structured SCU lore from this text.
      Return strictly valid JSON matching this schema:
      {
        "characters": [{"name": "", "bio": "", "personality": "", "faction": "", "combat_style": "", "signature_weapons": []}],
        "organizations": [{"name": "", "description": "", "allies": [], "lore": ""}],
        "timeline_events": [{"year": "", "event_name": "", "description": "", "associated_factions": []}]
      }

      Text content:
      ${parsed.text.slice(0, 15000)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const loreData = JSON.parse(response.text);

    if (loreData.characters?.length) {
      await supabase.from('characters').upsert(loreData.characters, { onConflict: 'name' });
    }
    if (loreData.organizations?.length) {
      await supabase.from('organizations').upsert(loreData.organizations, { onConflict: 'name' });
    }
    if (loreData.timeline_events?.length) {
      await supabase.from('timeline_events').insert(loreData.timeline_events);
    }

    console.log(`Successfully ingested ${file}`);
  }
}

processLorePDFs(process.argv[2] || './lore-docs');