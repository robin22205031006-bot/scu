import React, { useState } from 'react';
import { LoreExplorer } from './components/LoreExplorer';
import { ArchivistChat } from './components/ArchivistChat';

export default function App() {
  const [view, setView] = useState<'explorer' | 'chat'>('explorer');

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Navigation Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold tracking-widest text-red-500">SCU - SENTINELS</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setView('explorer')}
            className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
              view === 'explorer' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Lore Explorer
          </button>
          <button
            onClick={() => setView('chat')}
            className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
              view === 'chat' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Archivist AI
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 overflow-hidden">
        {view === 'explorer' ? <LoreExplorer /> : <ArchivistChat />}
      </main>
    </div>
  );
}