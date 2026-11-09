import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { KineticText } from "@/components/kinetic-text";

const KEY = "scu-welcomed";

/** Full-screen cinematic welcome shown once per session after sign-in. */
export function WelcomeVfx() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem(KEY);
    if (seen) return;
    sessionStorage.setItem(KEY, "1");
    setShow(true);
    const t1 = setTimeout(() => setLeaving(true), 2400);
    const t2 = setTimeout(() => setShow(false), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-black"
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Radial VFX bloom */}
      <motion.div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(168,85,247,0.25), transparent 60%)" }}
        animate={{ scale: [0.6, 1.15, 1], opacity: [0, 0.9, 0.5] }}
        transition={{ duration: 2.4, ease: "easeOut" }}
      />
      <motion.div
        className="absolute h-[60vmin] w-[60vmin] rounded-full border border-accent/30"
        animate={{ scale: [0.5, 1.4], opacity: [0, 0.6, 0] }}
        transition={{ duration: 2.6, ease: "easeOut" }}
      />
      <div className="relative text-center">
        <motion.p
          initial={{ opacity: 0, letterSpacing: "0.6em" }}
          animate={{ opacity: 1, letterSpacing: "0.35em" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="mb-3 text-xs uppercase text-accent"
        >
          Sentinels Cinematic Universe
        </motion.p>
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="font-display text-5xl font-bold glow-text sm:text-7xl"
        >
          <KineticText text="Welcome To The Universe" delay={0.3} />
        </motion.h1>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.9, duration: 0.7, ease: "easeOut" }}
          className="mx-auto mt-5 h-px w-48 bg-gradient-to-r from-transparent via-accent to-transparent"
        />
      </div>
    </motion.div>
  );
}
