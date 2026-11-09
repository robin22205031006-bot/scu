/** Reader spoiler mask — hides role/alignment tags on cards and dossiers. */
const KEY = "scu-spoilers-hidden";
const EVENT = "scu-spoiler-change";

export function spoilersHidden(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSpoilersHidden(hidden: boolean) {
  try {
    localStorage.setItem(KEY, hidden ? "1" : "0");
  } catch { /* storage optional */ }
  window.dispatchEvent(new Event(EVENT));
}

export function onSpoilerChange(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
