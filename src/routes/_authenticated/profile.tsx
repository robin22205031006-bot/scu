import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-admin";
import { favorites, onFavoritesChange, removeFavorite, type FavoriteEntry } from "@/lib/favorites";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — SCU" }, { name: "description", content: "Manage your SCU account, username, and favorite characters." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const { data: user } = useSession();
  const [favs, setFavs] = useState<FavoriteEntry[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("display_name, email").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setFavs(favorites());
    return onFavoritesChange(() => setFavs(favorites()));
  }, []);
  useEffect(() => { setUsername(profile?.display_name ?? ""); }, [profile?.display_name]);

  const saveUsername = async () => {
    if (!user?.id || busy) return;
    setBusy("name");
    const { error } = await supabase.from("profiles").update({ display_name: username.trim() || null }).eq("id", user.id);
    setBusy(null);
    if (error) { toast.error(error.message.includes("duplicate") || error.code === "23505" ? "That username is taken." : error.message); return; }
    toast.success("Username updated.");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const changePassword = async () => {
    if (!password || busy) return;
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setBusy("pw");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setPassword("");
    toast.success("Password updated.");
  };

  return (
    <main className="mx-auto max-w-2xl px-5 pb-24 pt-28">
      <h1 className="text-4xl font-medium">Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user?.email ?? "Not signed in."}</p>

      <section className="glass mt-8 rounded-2xl p-5">
        <h2 className="text-lg">Account</h2>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-1.5">
            <Label>Username</Label>
            <div className="flex gap-2">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a username" />
              <Button variant="secondary" disabled={busy === "name" || username.trim() === (profile?.display_name ?? "")} onClick={saveUsername}>
                {busy === "name" ? "…" : "Save"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Shown across the app — sign in with this username or your email.</p>
          </div>
          <div className="grid gap-1.5">
            <Label>New password</Label>
            <div className="flex gap-2">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" autoComplete="new-password" />
              <Button variant="secondary" disabled={busy === "pw" || !password} onClick={changePassword}>
                {busy === "pw" ? "…" : "Update"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="glass mt-6 rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-lg"><Heart className="h-4 w-4 text-accent" /> Favorite characters</h2>
        {favs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No favorites yet — open any character dossier and tap the heart to save them here.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {favs.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                <Link to="/characters" search={{ open: f.id }} className="font-medium hover:text-accent">{f.name}</Link>
                <button aria-label={`Remove ${f.name}`} onClick={() => removeFavorite(f.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
