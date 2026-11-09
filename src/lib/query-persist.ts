import type { QueryClient } from "@tanstack/react-query";

/**
 * Offline-first query persistence: mirrors successful query data into
 * localStorage so a fresh offline load renders cached lore instantly.
 * Account-scoped keys are skipped to avoid leaking private data.
 */
const KEY = "scu-rq-cache-v1";
const MAX_BYTES = 1_500_000;
const SKIP = /^\[(session|session-cache|admin|roles|banned)/;

function snapshot(qc: QueryClient) {
  const out: Record<string, unknown> = {};
  for (const q of qc.getQueryCache().getAll()) {
    const key = JSON.stringify(q.queryKey);
    if (SKIP.test(key)) continue;
    if (q.state.status !== "success" || q.state.data === undefined) continue;
    try {
      out[key] = q.state.data;
    } catch { /* unserializable */ }
  }
  const json = JSON.stringify(out);
  if (json.length < MAX_BYTES) {
    try { localStorage.setItem(KEY, json); } catch { /* quota */ }
  }
}

export function restoreQueries(qc: QueryClient) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, data] of Object.entries(entries)) {
      try { qc.setQueryData(JSON.parse(key), data); } catch { /* bad key */ }
    }
  } catch { /* corrupt cache */ }
}

export function persistQueries(qc: QueryClient) {
  restoreQueries(qc);
  let timer: ReturnType<typeof setTimeout> | undefined;
  qc.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => snapshot(qc), 2000);
  });
  window.addEventListener("pagehide", () => snapshot(qc));
}
