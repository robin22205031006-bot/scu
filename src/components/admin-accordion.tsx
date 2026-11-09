import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Collapsible admin section — collapsed by default, chevron toggles the body. */
export function AdminAccordion({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="glass rounded-2xl">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="font-display text-lg">{title}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-border/50 px-5 py-4 [&>section]:border-0 [&>section]:bg-transparent [&>section]:p-0">{children}</div>}
    </section>
  );
}
