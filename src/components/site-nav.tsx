import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, BookMarked, BookOpen, Bot, Castle, Clock, EyeOff, FileLock, Home, LogOut, Map as MapIcon, MessagesSquare, Music, Network, Shield, Sparkles, User, Users, Volume2, VolumeX, WandSparkles, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useIsStaff, useSession } from "@/hooks/use-admin";
import { useScuMute } from "@/hooks/use-scu-audio";
import { setAnimationsEnabled, useAnimationsEnabled } from "@/lib/animations";
import { useAppearance } from "@/hooks/use-appearance";
import { supabase } from "@/integrations/supabase/client";
import { STAFF_TAB, TABS, tabIndex } from "@/lib/nav";
import { ambientPlaying, ambientStart, ambientStop, onMuteChange, setAudioFiles, setMuted } from "@/lib/scu-audio";
import { onSpoilerChange, setSpoilersHidden, spoilersHidden } from "@/lib/spoiler";
import { useNavHidden } from "@/lib/nav-visibility";
import { navMode } from "./floating-nav";
import { DayNightToggle } from "./day-night-toggle";
import { ThemeDrawer } from "./theme-drawer";
import { UniversalSearch } from "./universal-search";
import { MobileMenu } from "./mobile-menu";
import { Download } from "lucide-react";

const ICONS = { home: Home, orgs: Shield, chars: Users, abilities: WandSparkles, archive: Archive, series: BookMarked, book: BookOpen, time: Clock, map: MapIcon, graph: Network, clans: Castle, fandom: MessagesSquare, ai: Bot, vault: FileLock, admin: Sparkles };

export function SiteNav() {
  const isStaff = useIsStaff();
  const { data: user } = useSession();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
  // Load admin-uploaded audio clips once for the session.
  useQuery({
    queryKey: ["app-settings", "audio_settings"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "audio_settings").maybeSingle();
      const files = (data?.value as { files?: Record<string, string> } | null)?.files;
      setAudioFiles(files);
      return files ?? null;
    },
  });
  const { muted, toggleMute } = useScuMute();
  const animOn = useAnimationsEnabled();
  const [ambient, setAmbient] = useState(false);
  const [hideSpoilers, setHideSpoilers] = useState(spoilersHidden);
  useEffect(() => onSpoilerChange(() => setHideSpoilers(spoilersHidden())), []);
  const toggleAmbient = () => {
    if (ambientPlaying() || ambient) { ambientStop(); setAmbient(false); }
    else { ambientStart(); setAmbient(true); }
  };
  const { zoom } = useAppearance();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { data: navHidden } = useQuery({
    queryKey: ["app-settings", "nav_visibility"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "nav_visibility").maybeSingle();
      return (data?.value ?? {}) as Record<string, boolean>;
    },
  });
  const tabs = useMemo(() => {
    const base = isStaff ? [...TABS, STAFF_TAB] : [...TABS];
    const hidden = navHidden ?? {};
    return base.filter((t) => hidden[t.to] ?? true);
  }, [isStaff, navHidden]);
  const active = tabIndex(pathname, tabs);
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = refs.current[active];
    if (el) {
      setPill({ left: el.offsetLeft, width: el.offsetWidth });
      el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
  }, [active, tabs.length]);

  // Swipe left/right anywhere to move between adjacent tabs.
  useEffect(() => {
    let sx = 0, sy = 0, skip = false;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      sx = t.clientX; sy = t.clientY;
      skip = e.touches.length !== 1 || !(e.target instanceof Element) || !!e.target.closest("[data-no-swipe], input, textarea, select, [role=dialog]");
    };
    const end = (e: TouchEvent) => {
      if (skip) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      const next = tabs[active + (dx < 0 ? 1 : -1)];
      if (active >= 0 && next) nav({ to: next.to });
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    return () => { window.removeEventListener("touchstart", start); window.removeEventListener("touchend", end); };
  }, [active, tabs, nav]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  };

  const progress = tabs.length > 1 && active >= 0 ? (active / (tabs.length - 1)) * 100 : 0;

  const autoHidden = useNavHidden();
  const [hudMode, setHudMode] = useState(navMode() === "hud");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const sync = () => setHudMode(navMode() === "hud");
    window.addEventListener("scu-nav-mode", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("scu-nav-mode", sync); window.removeEventListener("storage", sync); };
  }, []);

  // Dossier route has its own full-screen header — hide global nav there.
  if (pathname === "/character") return null;

  // Render an empty shell until mounted: nav depends on localStorage/auth state
  // that differs between SSR and the client — rendering real content pre-mount
  // caused hydration mismatches.
  if (!mounted) {
    return <nav className="fixed inset-x-0 top-3 z-40 flex justify-center" aria-hidden="true"><div className="h-11 w-64" /></nav>;
  }

  return (
    <nav
      className={`fixed inset-x-0 top-3 z-40 flex flex-col items-center gap-1.5 px-2 transition-all duration-300 ease-in-out ${autoHidden || hudMode ? "pointer-events-none -translate-y-[120%] opacity-0" : "translate-y-0 opacity-100"}`}
      aria-hidden={autoHidden || hudMode ? true : undefined}
    >
      <div className="glass glow-ring flex max-w-full items-center gap-0.5 rounded-full px-1.5 py-1.5">
        <div className="relative flex items-center overflow-x-auto [scrollbar-width:none]">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-secondary transition-[transform,opacity,width] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] will-change-transform"
            style={{ transform: `translateX(${pill.left}px)`, width: pill.width, opacity: active >= 0 ? 1 : 0 }}
          />
          {tabs.map((t, i) => {
            const Icon = ICONS[t.icon];
            const on = i === active;
            return (
              <Link
                key={t.to}
                to={t.to}
                preload="intent"
                ref={(el) => { refs.current[i] = el; }}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${on ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className={`h-3.5 w-3.5 ${on ? "text-accent" : ""}`} />
                <span className={on ? "" : "hidden md:inline"}>{t.label}</span>
                {on && <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent glow-ring" />}
              </Link>
            );
          })}
        </div>
        <span className="mx-1 h-4 w-px bg-border" />
        <MobileMenu
          main={tabs.map((t) => ({ to: t.to, label: t.label, icon: ICONS[t.icon] }))}
          extra={[
            { to: "/series", label: "Series", icon: BookMarked },
            { to: "/orgs", label: "Organizations", icon: Shield },
            { to: "/install", label: "Install app", icon: Download },
          ]}
        />
        <Link to="/install" aria-label="Install app" title="Install app" className="hidden h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground md:grid">
          <Download className="h-3.5 w-3.5" />
        </Link>
        <UniversalSearch />
        <ThemeDrawer />
        <button aria-label="Zoom out text" onClick={() => zoom(-1)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"><ZoomOut className="h-3.5 w-3.5" /></button>
        <button aria-label="Zoom in text" onClick={() => zoom(1)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"><ZoomIn className="h-3.5 w-3.5" /></button>
        <DayNightToggle />
        <button
          aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          title={muted ? "Unmute" : "Mute"}
          onClick={toggleMute}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
        <button
          aria-label={animOn ? "Disable cinematic animations" : "Enable cinematic animations"}
          title={animOn ? "Animations on" : "Animations off"}
          onClick={() => setAnimationsEnabled(!animOn)}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${animOn ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label={ambient ? "Stop ambient music" : "Play ambient music"}
          title={ambient ? "Ambient off" : "Ambient on"}
          onClick={toggleAmbient}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${ambient ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Music className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label={hideSpoilers ? "Show character roles" : "Hide character roles (spoiler-free)"}
          title={hideSpoilers ? "Show roles" : "Hide roles"}
          onClick={() => setSpoilersHidden(!hideSpoilers)}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${hideSpoilers ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
        {user ? (
          <>
            <Link to="/profile" aria-label="Profile" title={profile?.display_name ?? "Profile"} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground">
              <User className="h-3.5 w-3.5" />
            </Link>
            <button aria-label="Sign out" onClick={signOut} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" /></button>
          </>
        ) : (
          <Link to="/auth" className="whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Sign in</Link>
        )}
      </div>
      <div className="h-0.5 w-40 overflow-hidden rounded-full bg-border" aria-hidden>
        <div className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-500" style={{ transform: `scaleX(${Math.max(progress, 6)}%)` }} />
      </div>
    </nav>
  );
}
