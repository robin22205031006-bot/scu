/** Client-side favorites — offline-first, survives reloads. */
export interface FavoriteEntry {
  id: string;
  name: string;
  kind: string;
}

const KEY = "scu-favorites";
const listeners = new Set<() => void>();

export function favorites(): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FavoriteEntry[]) : [];
  } catch {
    return [];
  }
}

function save(list: FavoriteEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* noop */ }
  listeners.forEach((fn) => fn());
}

export function isFavorite(id: string) {
  return favorites().some((f) => f.id === id);
}

export function toggleFavorite(entry: FavoriteEntry) {
  const list = favorites();
  const next = list.some((f) => f.id === entry.id)
    ? list.filter((f) => f.id !== entry.id)
    : [...list, entry];
  save(next);
  return !list.some((f) => f.id === entry.id);
}

export function removeFavorite(id: string) {
  save(favorites().filter((f) => f.id !== id));
}

export function onFavoritesChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
