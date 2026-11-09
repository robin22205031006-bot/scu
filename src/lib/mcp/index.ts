import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEntities from "./tools/list-entities";
import getEntity from "./tools/get-entity";
import listTimeline from "./tools/list-timeline";
import addLoreNote from "./tools/add-lore-note";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "screenshot-perfect",
  title: "Screenshot Perfect",
  version: "0.1.0",
  instructions: "Read the Sentinels Cinematic Universe archive: characters, groups, dossiers and the timeline. Admins can append lore notes.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listEntities, getEntity, listTimeline, addLoreNote],
});
