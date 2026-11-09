import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getInstallGuide } from "@/lib/install-guide.functions";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: "Install the app — Sentinels Cinematic Universe" },
      { name: "description", content: "Get personalized steps to install the Sentinels lore archive on your device." },
      { property: "og:title", content: "Install the app — Sentinels Cinematic Universe" },
      { property: "og:description", content: "Get personalized steps to install the Sentinels lore archive on your device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstallPage,
});

const DEVICES = ["Android phone", "iPhone", "iPad", "Android tablet", "Windows PC", "Mac", "Chromebook", "Linux"];
const BROWSERS = ["Chrome", "Safari", "Edge", "Firefox", "Samsung Internet", "Other / not sure"];
const GOALS = ["Icon on home screen", "Android install file (APK)", "Desktop app window", "Not sure — suggest the best"];

const selectCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function InstallPage() {
  const run = useServerFn(getInstallGuide);
  const [device, setDevice] = useState(DEVICES[0]!);
  const [browser, setBrowser] = useState(BROWSERS[0]!);
  const [goal, setGoal] = useState(GOALS[0]!);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSteps("");
    try {
      const r = await run({ data: { device, browser, goal, notes } });
      if (r.error) setError(r.error);
      else setSteps(r.steps);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Install</p>
      <h1 className="mt-2 font-serif text-4xl text-foreground">Take the archive with you</h1>
      <p className="mt-3 text-muted-foreground">
        Tell us about your device and we'll write install steps just for you.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5 rounded-lg border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="device">Device</Label>
          <select id="device" className={selectCls} value={device} onChange={(e) => setDevice(e.target.value)}>
            {DEVICES.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="browser">Browser</Label>
          <select id="browser" className={selectCls} value={browser} onChange={(e) => setBrowser(e.target.value)}>
            {BROWSERS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="goal">What would you like?</Label>
          <select id="goal" className={selectCls} value={goal} onChange={(e) => setGoal(e.target.value)}>
            {GOALS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Anything else? (optional)</Label>
          <Textarea id="notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. older phone, low storage, I don't see an install button…" />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Writing your steps…" : "Get my install steps"}
        </Button>
      </form>

      {error && <p role="alert" className="mt-6 text-sm text-destructive">{error}</p>}
      {steps && (
        <section aria-live="polite" className="mt-6 rounded-lg border border-border bg-card p-6">
          <h2 className="font-serif text-2xl text-foreground">Your steps</h2>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{steps}</div>
        </section>
      )}
    </div>
  );
}
