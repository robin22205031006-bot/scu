import { useAppearance } from "@/hooks/use-appearance";

/** Illustrated landscape switch: sunset clouds by day, desert moon and stars by night. */
export function DayNightToggle() {
  const { dark, setDark } = useAppearance();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to day" : "Switch to night"}
      onClick={() => setDark(!dark)}
      className="relative h-7 w-14 shrink-0 overflow-hidden rounded-full border"
    >
      <svg viewBox="0 0 56 28" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="dn-day" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6a46b" />
            <stop offset="1" stopColor="#f9d7a0" />
          </linearGradient>
          <linearGradient id="dn-night" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d1530" />
            <stop offset="1" stopColor="#2a2550" />
          </linearGradient>
        </defs>
        <g style={{ opacity: dark ? 0 : 1, transition: "opacity .5s" }}>
          <rect width="56" height="28" fill="url(#dn-day)" />
          <ellipse cx="40" cy="20" rx="12" ry="5" fill="#fff" opacity=".85" />
          <ellipse cx="48" cy="17" rx="8" ry="4" fill="#fff" opacity=".7" />
          <ellipse cx="30" cy="23" rx="10" ry="4" fill="#fff" opacity=".6" />
        </g>
        <g style={{ opacity: dark ? 1 : 0, transition: "opacity .5s" }}>
          <rect width="56" height="28" fill="url(#dn-night)" />
          <circle cx="30" cy="7" r=".8" fill="#fff" />
          <circle cx="38" cy="5" r=".6" fill="#fff" />
          <circle cx="45" cy="9" r=".7" fill="#fff" />
          <circle cx="24" cy="11" r=".5" fill="#fff" />
          <path d="M0 22 Q10 17 20 21 T40 20 T56 22 V28 H0Z" fill="#3b2c3f" />
          <path d="M0 25 Q14 21 28 24 T56 24 V28 H0Z" fill="#241a2a" />
        </g>
      </svg>
      <span
        className="absolute top-0.5 grid h-5.5 w-5.5 place-items-center rounded-full shadow-md transition-all duration-500"
        style={{ left: dark ? "calc(100% - 1.5rem)" : "0.125rem", width: 22, height: 22, background: dark ? "#e8e6f0" : "#ffd36b" }}
      >
        {dark && <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full" style={{ background: "#2a2550" }} />}
      </span>
    </button>
  );
}
