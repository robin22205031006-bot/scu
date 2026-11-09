import { describe, expect, it } from "vitest";
import { buildUpdatePatch, filterGrounded, mergeLocks, validLoreStatus } from "@/lib/lore-merge";

const source = "Kael Varn, called the Ashen Blade, swore his oath to the Order of Dusk in the year of fire.";

describe("PDF grounding", () => {
  it("drops a character whose quote is not in the PDF", () => {
    const out = filterGrounded(
      {
        new_entities: [
          { kind: "character", name: "Kael Varn", alias: "Ashen Blade", role: null, status: null, description: "", quote: "Kael Varn, called the Ashen Blade" },
          { kind: "character", name: "Mira", alias: null, role: null, status: null, description: "", quote: "Mira led the rebellion" },
        ],
        updates: [],
        events: [],
      },
      source,
    );
    expect(out.new_entities.map((e) => e.name)).toEqual(["Kael Varn"]);
  });
});

describe("merge respects admin edits", () => {
  it("limits character statuses to the five specified values", () => {
    expect(["Alive", "Dead", "Retired", "Missing", "Legend"].map((s) => validLoreStatus("character", s))).toEqual(["Alive", "Dead", "Retired", "Missing", "Legend"]);
    expect(validLoreStatus("character", "Active")).toBeNull();
    expect(validLoreStatus("character", "Unknown")).toBeNull();
  });
  it("limits group statuses to Active or Inactive", () => {
    for (const kind of ["organization", "clan", "bloodline", "faction"] as const) {
      expect(validLoreStatus(kind, "Active")).toBe("Active");
      expect(validLoreStatus(kind, "Inactive")).toBe("Inactive");
      expect(validLoreStatus(kind, "Dead")).toBeNull();
    }
  });
  it("rejects character-only statuses for an existing group", () => {
    expect(buildUpdatePatch({ kind: "clan", status: "Active", locked_fields: [] }, { existing_name: "Dusk", new_facts: "", status: "Dead", quote: "x" })).toEqual({});
  });
  it("never changes a locked status", () => {
    const patch = buildUpdatePatch(
      { status: "Alive", locked_fields: ["status"] },
      { existing_name: "Kael", new_facts: "", status: "Dead", quote: "x" },
    );
    expect(patch).toEqual({});
  });
  it("updates status when not locked", () => {
    const patch = buildUpdatePatch(
      { status: "Alive", locked_fields: [] },
      { existing_name: "Kael", new_facts: "", status: "Dead", quote: "x" },
    );
    expect(patch).toEqual({ status: "Dead" });
  });
  it("adds edited fields to locks", () => {
    expect(mergeLocks(["name"], ["status", "name"])).toEqual(["name", "status"]);
  });
});
