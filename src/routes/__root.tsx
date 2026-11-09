import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { WifiOff } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { SiteNav } from "@/components/site-nav";
import { FloatingNav } from "@/components/floating-nav";
import { WelcomeVfx } from "@/components/welcome-vfx";
import { AmbientField } from "@/components/ambient-field";
import { PlexusWallpaper } from "@/components/plexus-wallpaper";
import { ScrollProgress } from "@/components/scroll-progress";
import { AppearanceProvider } from "@/hooks/use-appearance";
import { TypographyProvider } from "@/hooks/use-typography";
import { supabase } from "@/integrations/supabase/client";
import { syncSessionCache } from "@/lib/session-cache";
import { useScuAudioGlobal } from "@/hooks/use-scu-audio";
import { playWelcome } from "@/lib/scu-audio";
import { ErrorBoundary } from "@/components/error-boundary";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // SPA mode: the app is fully client-rendered. SSR 500s on TanStack Start
  // are eliminated because no route renders on the server; server functions
  // (auth-gated ingest/AI/roles) still work over fetch.
  ssr: false,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Sentinels Cinematic Universe" },
      { name: "description", content: "The archive of the Sentinels Cinematic Universe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#0a0d14" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Sentinels" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Manrope:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" style={{ backgroundColor: "#020408", colorScheme: "dark" }}>
      <head>
        <HeadContent />
      </head>
      <body style={{ backgroundColor: "#020408" }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  useScuAudioGlobal();
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister())).catch(() => {});
    }
  }, []);
  useEffect(() => {
    const onOnline = () => {
      void queryClient.invalidateQueries();
      void router.invalidate();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [queryClient, router]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event !== "INITIAL_SESSION" &&
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED" &&
        event !== "TOKEN_REFRESHED"
      )
        return;
      syncSessionCache(queryClient, session?.user ?? null);
      if (event === "SIGNED_OUT") {
        // Strict sign-out: purge persisted offline cache so re-entry requires online auth.
        try { localStorage.removeItem("scu-rq-cache-v1"); } catch { /* storage unavailable */ }
      }
      queueMicrotask(() => {
        void router.invalidate();
        if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
      });
      if (event === "SIGNED_IN" && session) {
        setTimeout(() => playWelcome(), 400);
        const key = `scu-logged-${session.user.id}-${new Date().toDateString()}`;
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            setTimeout(() => { void supabase.from("activity_log").insert({ user_id: session.user.id, action: "Signed in" }); }, 0);
          }
        } catch { /* Logging must not block sign-in when storage is unavailable. */ }
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <AppearanceProvider>
        <TypographyProvider>
        <ErrorBoundary>
        <div className="ambient-bg relative min-h-screen">
          <AmbientField />
          <PlexusWallpaper />
          <ScrollProgress />
          <SiteNav />
          <FloatingNav />
          <WelcomeVfx />
          {offline && (
            <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/40 bg-zinc-950/90 px-4 py-2 text-xs font-medium text-amber-200 shadow-lg backdrop-blur-sm">
              <WifiOff className="h-3.5 w-3.5" />
              Offline — showing cached archive data
            </div>
          )}
          <Outlet />
        </div>
        </ErrorBoundary>
        <Toaster />
        </TypographyProvider>
      </AppearanceProvider>
    </QueryClientProvider>
  );
}
