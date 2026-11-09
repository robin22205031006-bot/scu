import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState, type ComponentType } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Item = { to: string; label: string; icon: ComponentType<{ className?: string }> };

export function MobileMenu({ main, extra }: { main: Item[]; extra: Item[] }) {
  const [open, setOpen] = useState(false);
  const row = (t: Item) => {
    const Icon = t.icon;
    return (
      <Link
        key={t.to}
        to={t.to as never}
        onClick={() => setOpen(false)}
        activeOptions={{ exact: t.to === "/" }}
        activeProps={{ className: "bg-secondary text-foreground" }}
        inactiveProps={{ className: "text-muted-foreground" }}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:text-foreground"
      >
        <Icon className="h-4 w-4 text-accent" />
        {t.label}
      </Link>
    );
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button aria-label="Open menu" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground md:hidden">
          <Menu className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto">
        <SheetHeader><SheetTitle>Sentinels</SheetTitle></SheetHeader>
        <nav className="mt-4 flex flex-col gap-1">
          {main.map(row)}
          <p className="mt-4 px-3 text-xs uppercase tracking-wider text-muted-foreground">Explore</p>
          {extra.map(row)}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
