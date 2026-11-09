import { describe, expect, it, vi } from "vitest";
import { ingestAdminPdf } from "@/controllers/adminController.js";
import type { Extraction } from "@/lib/lore-merge";

const text = "Ilyra Testwarden joined the organization Test Beacon Assembly. In 2042, they opened Test Beacon Gate.";
const extraction: Extraction = {
  new_entities: [
    { kind: "character", name: "Ilyra Testwarden", alias: null, role: null, status: "Alive", description: "Joined Test Beacon Assembly.", quote: "Ilyra Testwarden joined the organization Test Beacon Assembly." },
    { kind: "organization", name: "Test Beacon Assembly", alias: null, role: null, status: "Active", description: "An organization.", quote: "the organization Test Beacon Assembly" },
  ],
  updates: [],
  events: [{ title: "Test Beacon Gate opens", era: "2042", description: "They opened Test Beacon Gate.", quote: "In 2042, they opened Test Beacon Gate." }],
};

function setup() {
  const file = new File(["pdf"], "test-lore.pdf", { type: "application/pdf" });
  return { file, deps: {
    readPdf: vi.fn().mockResolvedValue(text),
    analyze: vi.fn().mockResolvedValue(extraction),
    apply: vi.fn().mockResolvedValue({ created: 2, updated: 0, events: 1 }),
    refresh: vi.fn().mockResolvedValue(undefined),
    onStage: vi.fn(),
  } };
}

describe("automatic admin PDF ingestion", () => {
  it("reads the selected PDF and sends its extracted text to AI", async () => {
    const { file, deps } = setup();
    await ingestAdminPdf(file, deps);
    expect(deps.readPdf).toHaveBeenCalledWith(file);
    expect(deps.analyze).toHaveBeenCalledWith({ data: { text } });
  });
  it("automatically saves characters, organizations and timeline entries without approval", async () => {
    const { file, deps } = setup();
    const result = await ingestAdminPdf(file, deps);
    expect(deps.apply).toHaveBeenCalledExactlyOnceWith({ data: { ...extraction, filename: "test-lore.pdf", source_text: text } });
    expect(result).toEqual({ created: 2, updated: 0, events: 1 });
  });
  it("refreshes archive queries after saving", async () => {
    const { file, deps } = setup();
    await ingestAdminPdf(file, deps);
    expect(deps.refresh).toHaveBeenCalledOnce();
    expect(deps.apply.mock.invocationCallOrder[0]).toBeLessThan(deps.refresh.mock.invocationCallOrder[0] ?? 0);
  });
  it("refreshes partial saves and surfaces failures without replaying writes", async () => {
    const { file, deps } = setup();
    deps.apply.mockRejectedValue(new Error("Partial save"));
    await expect(ingestAdminPdf(file, deps)).rejects.toThrow("Partial save");
    expect(deps.refresh).toHaveBeenCalledOnce();
    expect(deps.apply).toHaveBeenCalledOnce();
  });
  it("never invokes extraction or saving when PDF parsing fails", async () => {
    const { file, deps } = setup();
    deps.readPdf.mockRejectedValue(new Error("Unreadable PDF"));
    await expect(ingestAdminPdf(file, deps)).rejects.toThrow("Unreadable PDF");
    expect(deps.analyze).not.toHaveBeenCalled();
    expect(deps.apply).not.toHaveBeenCalled();
  });
});