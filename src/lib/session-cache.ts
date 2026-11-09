import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

/** Remove account-dependent data before exposing a new identity. */
export function syncSessionCache(client: QueryClient, user: User | null) {
  void client.cancelQueries();
  client.removeQueries();
  client.setQueryData(["session"], user);
}