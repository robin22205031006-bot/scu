import React, { useEffect, useState } from 'react';
import { scuCache } from '../services/scuCache';

export function LoreExplorer() {
  const [tab, setTab] = useState<'characters' | 'organizations' | 'timeline'>('characters');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      if (tab === 'characters') setData(await scuCache.getCharacters());
      else if (tab === 'organizations') setData(await scuCache.getOrganizations());
      else if (tab === 'timeline') setData(await scuCache.getTimeline());
      setLoading(false);
    }
    loadData();
  }, [tab]);

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6 tracking-wider text-red-500">Sentinels Cinematic Universe</h1>
      
      <div className="flex space-x-4 mb-6">
        {(['characters', 'organizations', 'timeline'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded uppercase font-semibold text-sm transition-colors ${
              tab === t ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 animate-pulse">Decrypting SCU Archives...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((item, idx) => (
            <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-5 shadow-lg">
              <h3 className="text-xl font-bold text-red-400 mb-2">{item.name || item.event_name}</h3>
              {item.faction && <span className="inline-block bg-red-900/50 text-red-300 text-xs px-2 py-1 rounded mb-2">Faction: {item.faction}</span>}
              <p className="text-gray-300 text-sm mb-3">{item.bio || item.description || item.lore}</p>
              {item.combat_style && <p className="text-xs text-gray-400"><strong>Combat Style:</strong> {item.combat_style}</p>}
              {item.year && <p className="text-xs text-gray-400"><strong>Year:</strong> {item.year}</p>}
            </div>
          ))}
          {data.length === 0 && <p className="text-gray-500">No records found in cache or database.</p>}
        </div>
      )}
    </div>
  );
}