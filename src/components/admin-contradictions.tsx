import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CANON_SCOPES } from "@/lib/canon";

export interface ConflictRow {
  id: string;
  entity_id: string;
  entity_name: string;
  text: string;
  source: string | null;
  created_at: string;
}

interface ParsedConflict {
  field: string;
  a: string;
  b: string;
}

/** Parses "[conflict] <field>: archived 'X' vs extracted 'Y'" into a question. */
function parseConflict(text: string): ParsedConflict | null {
  const m = text.match(/\[conflict\]\s*([a-z_]+):\s*archived\s*'([^']+)'\s*vs\s*(?:extracted\s*)?'([^']+)'/i);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  return { field: m[1].toLowerCase(), a: m[2], b: m[3] };
}

const LIFE_STATUSES = ["Alive", "Dead", "Presumed Dead"] as const;
const FIELD_LABELS: Record<string, string> = {
  status: "life status",
  kind: "entity type",
  category: "category",
  role: "role",
  faction: "faction",
};

type ScopeMap = Record<string, string>; // canon scope -> chosen value

export function AdminContradictions({ conflicts }: { conflicts: ConflictRow[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [periodFor, setPeriodFor] = useState<string | null>(null);
  const [periodMap, setPeriodMap] = useState<ScopeMap>({});
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-conflicts"] });

  const clearConflict = async (c: ConflictRow) => {
    const { error } = await supabase.from("lore_notes").delete().eq("id", c.id);
    if (error) throw error;
  };

  /** Single canon answer — writes value globally and clears the flag. */
  const pick = async (c: ConflictRow, field: string, value: string) => {
    setBusy(c.id);
    try {
      if (field === "status") {
        const { error } = await supabase.from("entities").update({ status: value }).eq("id", c.entity_id);
        if (error) throw error;
      }
      await supabase.from("lore_notes").insert({
        entity_id: c.entity_id,
        text: `[resolved] ${field} canonically set to '${value}'`,
        source: "admin-resolver",
      });
      await clearConflict(c);
      toast.success(`Canon ${FIELD_LABELS[field] ?? field} set to '${value}'`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resolve conflict.");
    } finally {
      setBusy(null);
    }
  };

  /** Both options are right — persist a per-season assignment matrix. */
  const savePeriods = async (c: ConflictRow, parsed: ParsedConflict) => {
    const entries = Object.entries(periodMap).filter(([, v]) => v);
    if (!entries.length) { toast.error("Assign at least one season."); return; }
    setBusy(c.id);
    try {
      for (const [scope, value] of entries) {
        const { error } = await supabase.from("lore_notes").insert({
          entity_id: c.entity_id,
          text: `[scope] ${parsed.field} '${value}' applies to ${scope}`,
          source: "admin-resolver",
        });
        if (error) throw error;
      }
      // Global status = value of the latest assigned canon season (timeline "now").
      const latest = CANON_SCOPES.filter((s) => periodMap[s]).at(-1);
      const latestVal = latest ? periodMap[latest] : undefined;
      if (parsed.field === "status" && latestVal) {
        const { error } = await supabase.from("entities").update({ status: latestVal }).eq("id", c.entity_id);
        if (error) throw error;
      }
      await clearConflict(c);
      toast.success(`Period map saved for ${entries.length} season${entries.length > 1 ? "s" : ""}`);
      setPeriodFor(null);
      setPeriodMap({});
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save period map.");
    } finally {
      setBusy(null);
    }
  };

  /** Custom third answer typed by the admin. */
  const saveCustom = async (c: ConflictRow, parsed: ParsedConflict) => {
    const value = customText.trim();
    if (!value) return;
    await pick(c, parsed.field, value);
    setCustomFor(null);
    setCustomText("");
  };

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="mb-1 text-2xl">Lore conflicts</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Each card asks which version is canon — pick one answer, or map both answers to specific seasons when both are true at different points in the timeline.
      </p>
      <ul className="grid gap-3 text-sm">
        {conflicts.map((c) => {
          const parsed = parseConflict(c.text);
          const isStatus = parsed?.field === "status";
          const isFaction = /faction|team|member|org/i.test(c.text);
          return (
            <li key={c.id} className="rounded-lg border border-border/60 bg-secondary/40 px-4 py-3">
              {/* Question header */}
              <p className="font-medium">
                {parsed
                  ? `${c.entity_name}: which ${FIELD_LABELS[parsed.field] ?? parsed.field} is canon?`
                  : `${c.entity_name}: resolve this conflict?`}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {c.text} · {c.source ?? ""} · {new Date(c.created_at).toLocaleDateString()}
              </p>

              {parsed && (
                <>
                  {/* Answer options — the exact conflict values */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {isStatus ? (
                      LIFE_STATUSES.map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={s === "Presumed Dead" ? "secondary" : "outline"}
                          disabled={busy === c.id}
                          onClick={() => pick(c, "status", s)}
                        >
                          {s}
                        </Button>
                      ))
                    ) : (
                      <>
                        <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => pick(c, parsed.field, parsed.a)}>
                          '{parsed.a}'
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => pick(c, parsed.field, parsed.b)}>
                          '{parsed.b}'
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === c.id}
                      onClick={() => {
                        const open = periodFor !== c.id;
                        setPeriodFor(open ? c.id : null);
                        setPeriodMap(open ? { [`${parsed.a}|${parsed.b}`]: "" } as ScopeMap : {});
                        setCustomFor(null);
                      }}
                    >
                      Both — assign seasons
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === c.id}
                      onClick={() => { setCustomFor(customFor === c.id ? null : c.id); setCustomText(""); setPeriodFor(null); }}
                    >
                      Other…
                    </Button>
                  </div>

                  {/* Custom answer */}
                  {customFor === c.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        className="w-48 rounded-md border border-border bg-background px-2 py-1 text-xs"
                        placeholder={`Custom ${FIELD_LABELS[parsed.field] ?? parsed.field}`}
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void saveCustom(c, parsed)}
                      />
                      <Button size="sm" disabled={busy === c.id || !customText.trim()} onClick={() => void saveCustom(c, parsed)}>Set as canon</Button>
                    </div>
                  )}

                  {/* Both-are-right: per-season assignment matrix */}
                  {periodFor === c.id && (
                    <div className="mt-3 rounded-md border border-accent/30 bg-accent/5 p-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Both answers are canon at different times — assign each to its seasons:
                      </p>
                      <div className="grid gap-1.5">
                        {CANON_SCOPES.map((scope) => (
                          <div key={scope} className="flex items-center gap-2">
                            <span className="w-28 text-xs">{scope}</span>
                            <select
                              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                              value={periodMap[scope] ?? ""}
                              onChange={(e) => setPeriodMap((m) => ({ ...m, [scope]: e.target.value }))}
                            >
                              <option value="">—</option>
                              <option value={parsed.a}>{parsed.a}</option>
                              <option value={parsed.b}>{parsed.b}</option>
                              {isStatus && LIFE_STATUSES.filter((s) => s !== parsed.a && s !== parsed.b).map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" disabled={busy === c.id} onClick={() => void savePeriods(c, parsed)}>Save period map</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setPeriodFor(null); setPeriodMap({}); }}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!parsed && isFaction && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === c.id}
                    onClick={() => { setCustomFor(customFor === c.id ? null : c.id); setPeriodFor(null); }}
                  >
                    Set faction scope…
                  </Button>
                </div>
              )}
              {!parsed && customFor === c.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className="w-48 rounded-md border border-border bg-background px-2 py-1 text-xs"
                    placeholder="Resolution note"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={busy === c.id || !customText.trim()}
                    onClick={async () => {
                      setBusy(c.id);
                      try {
                        await supabase.from("lore_notes").insert({ entity_id: c.entity_id, text: `[resolved] ${customText.trim()}`, source: "admin-resolver" });
                        await clearConflict(c);
                        toast.success("Conflict resolved.");
                        refresh();
                      } catch (err) { toast.error(err instanceof Error ? err.message : "Failed."); }
                      finally { setBusy(null); setCustomFor(null); setCustomText(""); }
                    }}
                  >
                    Resolve
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
