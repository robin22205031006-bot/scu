import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askLore } from "@/lib/ai-box.functions";

type Msg = { role: "user" | "assistant"; content: string; sources?: string[] };

export function LoreChat() {
  const ask = useServerFn(askLore);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const send = async () => {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const r = await ask({ data: { messages: next.slice(-20) } });
      setMsgs([...next, { role: "assistant", content: r.reply, sources: r.sources }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "The archive is unreachable right now. Please try again." }]);
    } finally {
      setBusy(false);
      setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-6 pt-28 sm:px-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Archivist</p>
          <h1 className="mt-2 text-5xl font-medium glow-text">SCU AI Box</h1>
          <p className="mt-2 text-sm text-muted-foreground">Answers come only from the SCU archive.</p>
        </div>
        <span className="mb-1 hidden items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] uppercase tracking-widest text-accent sm:inline-flex">
          <FileText className="h-3 w-3" /> Powered by official SCU Archives
        </span>
      </div>
      <div className="mt-6 grid flex-1 content-start gap-3">
        {msgs.length === 0 && (
          <div className="glass grid place-items-center gap-2 rounded-2xl p-10 text-center text-sm text-muted-foreground">
            <Bot className="h-8 w-8 text-accent" />Ask about a character, faction or event.
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="grid gap-1.5">
            <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "justify-self-end bg-primary text-primary-foreground" : "glass justify-self-start"}`}>{m.content}</div>
            {m.role === "assistant" && m.sources && m.sources.length > 0 && (
              <div className="justify-self-start pl-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                Sources: {m.sources.join(", ")}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="glass justify-self-start rounded-2xl px-4 py-2.5 text-sm text-muted-foreground">Searching the archive…</div>}
        <div ref={end} />
      </div>
      <form className="glass sticky bottom-4 mt-4 flex gap-2 rounded-full p-1.5" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask the archive…" className="border-0 bg-transparent" maxLength={2000} />
        <Button type="submit" size="icon" className="rounded-full" disabled={busy || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </main>
  );
}
