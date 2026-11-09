import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string; banned?: string } => ({ ...(typeof s["next"] === "string" ? { next: s["next"] } : {}), ...(typeof s["banned"] === "string" ? { banned: s["banned"] } : {}) }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Admin sign in — SCU" },
      { name: "description", content: "Sign in to manage the SCU archive." },
      { property: "og:title", content: "Admin sign in — SCU" },
      { property: "og:description", content: "Sign in to manage the SCU archive." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // Swipe right anywhere on the auth screen returns to the app.
  useEffect(() => {
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
    };
    const end = (e: TouchEvent) => {
      const s = touchStart.current;
      touchStart.current = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (dx > 90 && Math.abs(dx) > Math.abs(dy) * 1.5) nav({ to: "/" });
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    return () => { window.removeEventListener("touchstart", start); window.removeEventListener("touchend", end); };
  }, [nav]);
  const { next: rawNext } = Route.useSearch();
  const next = oauthReturnPath(rawNext);
  const hasNext = rawNext !== undefined && next !== "/";
  const [mode, setMode] = useState<"in" | "up">("in");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
    // Never leave the form spinning forever on a stalled network.
    const deadline = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 10_000));
    if (mode === "in") {
      // Username-first: resolve username → email via the lookup RPC; "@" means email.
      let loginEmail = identifier.trim();
      if (!loginEmail.includes("@")) {
        const { data: resolved, error: lookupErr } = await Promise.race([
          supabase.rpc("lookup_login_email", { p_username: loginEmail }),
          deadline,
        ]);
        if (lookupErr || !resolved) {
          setBusy(false);
          toast.error(lookupErr ? "Username lookup unavailable — sign in with your email." : "No account found for that username.");
          return;
        }
        loginEmail = resolved as string;
      }
      const { error } = await Promise.race([supabase.auth.signInWithPassword({ email: loginEmail, password }), deadline]);
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (hasNext) window.location.assign(next);
      else nav({ to: "/characters" });
    } else {
      const { data: signUpData, error } = await Promise.race([supabase.auth.signUp({ email, password, options: { emailRedirectTo: new URL("/auth", window.location.origin).href + (hasNext ? `?next=${encodeURIComponent(next)}` : "") } }), deadline]);
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      // Best-effort: stamp the username onto the profile (works when email confirmation is off).
      const uname = username.trim();
      const uid = signUpData.user?.id;
      if (uname && uid) {
        const { error: profErr } = await supabase.from("profiles").update({ display_name: uname }).eq("id", uid);
        if (profErr) toast.message("Account created — set your username later in Profile.");
      }
      toast.success("Check your email to confirm your account.");
    }
    } catch {
      toast.error("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <h1 className="text-4xl font-medium">{mode === "in" ? "Sign in" : "Create account"}</h1>
      <form onSubmit={submit} className="mt-8 grid gap-4">
        {mode === "in" ? (
          <div className="grid gap-1.5"><Label>Username or email</Label><Input required value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" /></div>
        ) : (
          <>
            <div className="grid gap-1.5"><Label>Username</Label><Input required minLength={3} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></div>
            <div className="grid gap-1.5"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          </>
        )}
        <div className="grid gap-1.5"><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} /></div>
        <Button disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : "Sign up"}</Button>
        {mode === "in" && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={async () => {
              const id = identifier.trim();
              if (!id) { toast.error("Enter your username or email first."); return; }
              let email = id.includes("@") ? id : "";
              if (!email) {
                const { data } = await supabase.rpc("lookup_login_email", { p_username: id });
                email = data ?? "";
              }
              if (!email) { toast.error("Account not found."); return; }
              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: new URL("/auth", window.location.origin).href,
              });
              if (error) toast.error(error.message);
              else toast.success("Password reset link sent — check your email.");
            }}
          >
            Forgot password?
          </button>
        )}
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-sm text-muted-foreground hover:text-foreground">
        {mode === "in" ? "First time? Create your account" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
