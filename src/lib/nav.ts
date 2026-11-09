export const TABS = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/characters", label: "Characters", icon: "chars" },
  { to: "/abilities", label: "Abilities", icon: "abilities" },
  { to: "/archive", label: "Archive", icon: "archive" },
  { to: "/story", label: "Story", icon: "book" },
  { to: "/map", label: "Map", icon: "map" },
  { to: "/fandom", label: "Fandom", icon: "fandom" },
  { to: "/ai", label: "AI Box", icon: "ai" },
  { to: "/vault", label: "Vault", icon: "vault" },
] as const;

export const STAFF_TAB = { to: "/admin", label: "Admin", icon: "admin" } as const;

export type TabPath = (typeof TABS)[number]["to"] | typeof STAFF_TAB.to;

export function tabIndex(pathname: string, tabs: readonly { to: string }[]): number {
  const exact = tabs.findIndex((t) => t.to === pathname);
  if (exact >= 0) return exact;
  return tabs.findIndex((t) => t.to !== "/" && pathname.startsWith(t.to));
}
