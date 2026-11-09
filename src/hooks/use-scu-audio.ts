import { useEffect, useState } from "react";
import { isMuted, onMuteChange, setMuted, sfx } from "@/lib/scu-audio";

/** Reactive mute flag synced with localStorage + the scu-mute-change event. */
export function useScuMute() {
  const [muted, setMutedState] = useState(isMuted);
  useEffect(() => onMuteChange(() => setMutedState(isMuted())), []);
  return {
    muted,
    toggleMute: () => setMuted(!muted),
  };
}

let installed = false;

/**
 * Installs global audio behavior once per app lifetime:
 *  - delegated click tick on any button/link/role=button press
 *  - one soft welcome tone on the first user interaction of the session
 * Safe to call from multiple components — only the first call installs.
 */
export function useScuAudioGlobal() {
  useEffect(() => {
    if (installed || typeof window === "undefined") return;
    installed = true;

    const onClick = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("[data-no-sfx]")) return;
      if (t.closest("button, a, [role='button'], summary, select")) sfx.click();
    };
    document.addEventListener("click", onClick, { passive: true });

    // Browsers block audio before a user gesture — fire the welcome tone on
    // the first interaction instead, once per session.
    let welcomed = false;
    try {
      welcomed = sessionStorage.getItem("scu-welcomed") === "1";
    } catch { /* ignore */ }
    const greet = () => {
      if (welcomed) return;
      welcomed = true;
      try { sessionStorage.setItem("scu-welcomed", "1"); } catch { /* ignore */ }
      sfx.welcome();
    };
    const onGesture = () => {
      greet();
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    if (!welcomed) {
      window.addEventListener("pointerdown", onGesture, { once: true, passive: true });
      window.addEventListener("keydown", onGesture, { once: true });
    }

    return () => document.removeEventListener("click", onClick);
  }, []);
}
