const KEY = "scu-animations";
const EVENT = "scu-animations-change";

export function animationsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAnimationsEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(EVENT));
}

export function onAnimationsChange(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

import { useSyncExternalStore } from "react";

export function useAnimationsEnabled(): boolean {
  return useSyncExternalStore(
    (cb) => onAnimationsChange(cb),
    animationsEnabled,
    () => true,
  );
}
