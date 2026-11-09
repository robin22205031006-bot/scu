import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type OAuthResult = { data: any; error: { message: string } | null };
const oauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
    approveAuthorization: (id: string) => Promise<OAuthResult>;
    denyAuthorization: (id: string) => Promise<OAuthResult>;
  };
}).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({ meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    { title: "Connect an app — SCU" },
    { name: "description", content: "Review an app’s requested access to your Sentinels Cinematic Universe account." },
    { property: "og:title", content: "Connect an app — SCU" },
    { property: "og:description", content: "Review an app’s requested access to your Sentinels Cinematic Universe account." },
    { name: "robots", content: "noindex" },
  ] }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("This connection link is missing its authorization id.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth.getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    const { data: u } = await supabase.auth.getUser();
    return { details: data, email: u.user?.email ?? "" };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md px-5 pt-32 text-sm">
      <h1 className="text-3xl">Connection unavailable</h1>
      <p className="mt-3 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
    </main>
  ),
});

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = details?.client?.name ?? details?.client?.client_name ?? "An app";
  const scopes: string[] = String(details?.scope ?? "").split(" ").filter(Boolean);
  const label = (s: string) =>
    s === "openid" ? "Confirm your identity" : s === "email" ? "Share your email address" : s === "profile" ? "Share your basic profile" : `Additional permission requested: ${s}`;

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve ? await oauth.approveAuthorization(authorization_id) : await oauth.denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect was returned. Please try again."); return; }
    window.location.href = target;
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-20 pt-32">
      <h1 className="text-4xl font-medium">Connect {client} to Sentinels Cinematic Universe</h1>
      <p className="mt-3 text-sm text-muted-foreground">Signed in as {email}. This lets {client} use this app as you.</p>
      {details?.redirect_uri && <p className="mt-2 text-xs text-muted-foreground">Returns to {details.redirect_uri}</p>}
      {scopes.length > 0 && <ul className="mt-6 grid gap-2 text-sm">{scopes.map((s) => <li key={s}>· {label(s)}</li>)}</ul>}
      <p className="mt-6 text-xs text-muted-foreground">This does not bypass this app's permissions — only the admin can edit the archive.</p>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-8 flex gap-3">
        <Button disabled={busy} onClick={() => decide(true)}>Approve</Button>
        <Button variant="ghost" disabled={busy} onClick={() => decide(false)}>Cancel connection</Button>
      </div>
    </main>
  );
}
