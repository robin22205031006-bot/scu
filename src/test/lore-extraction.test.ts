import { describe, expect, it } from "vitest";
import { parseLoreExtraction } from "@/lib/lore-extraction";

const source = "Kael Varn joined the Order of Dusk. In 2042, Kael Varn opened the Dusk Gate.";
const payload = {
  characters: [{ kind: "character", name: "Kael Varn", alias: null, role: null, status: "Alive", description: "Joined the Order of Dusk.", quote: "Kael Varn joined the Order of Dusk." }],
  organizations: [{ kind: "organization", name: "Order of Dusk", alias: null, role: null, status: "Active", description: "An organization.", quote: "Kael Varn joined the Order of Dusk." }],
  updates: [],
  timeline_events: [{ title: "Dusk Gate opens", era: "2042", description: "Kael Varn opened the gate.", quote: "In 2042, Kael Varn opened the Dusk Gate." }],
};

describe("Gemini structured lore extraction", () => {
  it("maps characters, organizations, and timeline events to the shared archive write contract", () => {
    const result = parseLoreExtraction(JSON.stringify(payload), source);
    expect(result.new_entities.map((e) => [e.kind, e.name])).toEqual([["character", "Kael Varn"], ["organization", "Order of Dusk"]]);
    expect(result.events).toEqual(payload.timeline_events);
  });
  it("keeps existing entity updates separate from newly created entries", () => {
    const update = { existing_name: "Kael Varn", new_facts: "Opened the Dusk Gate.", status: null, quote: "In 2042, Kael Varn opened the Dusk Gate." };
    expect(parseLoreExtraction(JSON.stringify({ ...payload, characters: [], updates: [update] }), source).updates).toEqual([update]);
  });
  it("rejects unsupported invented lore even when JSON is structurally valid", () => {
    const result = parseLoreExtraction(JSON.stringify({ ...payload, characters: [{ ...payload.characters[0], name: "Mira", quote: "Mira defeated a dragon." }] }), source);
    expect(result.new_entities.map((e) => e.name)).toEqual(["Order of Dusk"]);
  });
  it("rejects invalid JSON before the save stage", () => {
    expect(() => parseLoreExtraction("not json", source)).toThrow();
    expect(() => parseLoreExtraction(JSON.stringify({ characters: [] }), source)).toThrow();
  });
});