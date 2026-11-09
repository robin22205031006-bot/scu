import { createFileRoute } from "@tanstack/react-router";
import { LoreChat } from "@/components/LoreChat";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "SCU AI Box — Sentinels Cinematic Universe" },
      { name: "description", content: "Ask questions answered only from SCU lore." },
      { property: "og:title", content: "SCU AI Box" },
      { property: "og:description", content: "Ask questions answered only from SCU lore." },
    ],
  }),
  component: LoreChat,
});

