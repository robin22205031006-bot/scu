import { motion } from "framer-motion";
import { useAnimationsEnabled } from "@/lib/animations";

/** Kinetic typography: spring-staggered letter reveal (stiffness 250, damping 20). */
export function KineticText({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const animOn = useAnimationsEnabled();
  if (!animOn) return <span className={className}>{text}</span>;
  return (
    <span className={className} aria-label={text}>
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ type: "spring", stiffness: 250, damping: 20, delay: delay + i * 0.035, mass: 0.7 }}
        >
          {ch === " " ? "\u00A0" : ch}
        </motion.span>
      ))}
    </span>
  );
}
