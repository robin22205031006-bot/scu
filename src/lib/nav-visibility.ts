import { useSyncExternalStore } from "react";

/**
 * Global navigation visibility — detail views (dossiers, explorers, editors)
 * set hidden=true to reclaim screen space; closing restores it.
 */
let hidden = false;
const listeners = new Set<() => void>();

export function setNavHidden(v: boolean) {
  if (hidden === v) return;
  hidden = v;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const get = () => hidden;

export function useNavHidden() {
  return useSyncExternalStore(subscribe, get, () => false);
}
