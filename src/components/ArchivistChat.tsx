import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { scuCache } from '../services/scuCache';

// Lazy-init: constructing GoogleGenAI at module scope throws during import if
// VITE_GEMINI_API_KEY is absent at build time, which white-screens any route
// that pulls this module in.
let ai: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey: import.meta.env["VITE_GEMINI_API_KEY"] });
  return ai;
}

export function ArchivistChat() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: 'system', content: 'Archivist online. Query the Sentinels Cinematic Universe database.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const chars = await scuCache.getCharacters();
      const orgs = await scuCache.getOrganizations();
      const timeline = await scuCache.getTimeline();

      const context = `
        SCU Data Context:
        Characters: ${JSON.stringify(chars)}
        Organizations: ${JSON.stringify(orgs)}
        Timeline: ${JSON.stringify(timeline)}
      `;

      const response = await getAi().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `${context}\n\nUser Query: ${userMessage}`,
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.text || 'No data found in archives.' }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error communicating with Archivist core.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-red-500 mb-4 tracking-wide">SCU Archivist AI</h2>
      
      <div className="flex-1 overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4 mb-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`p-3 rounded-lg max-w-[80%] ${msg.role === 'user' ? 'bg-red-900/40 ml-auto text-right' : 'bg-gray-800 mr-auto'}`}>
            <p className="text-sm text-gray-200">{msg.content}</p>
          </div>
        ))}
        {loading && <div className="text-xs text-gray-500 animate-pulse">Archivist is analyzing records...</div>}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about factions, characters, or timeline events..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-red-500"
        />
        <button type="submit" className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded font-semibold transition-colors">
          Query
        </button>
      </form>
    </div>
  );
}