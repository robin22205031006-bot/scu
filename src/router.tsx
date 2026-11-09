import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { persistQueries } from "./lib/query-persist";

export const getRouter = () => {
  const queryClient = new QueryClient();
  if (typeof window !== "undefined") persistQueries(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
