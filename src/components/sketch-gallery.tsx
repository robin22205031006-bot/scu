import { useEffect, useState } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";

/** Multi-angle sketch / turnaround viewer with swipe and angle dots. */
export function SketchGallery({ images, name }: { images: string[]; name: string }) {
  const [api, setApi] = useState<CarouselApi>();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!api) return;
    const on = () => setI(api.selectedScrollSnap());
    on();
    api.on("select", on);
    api.on("reInit", on);
    return () => { api.off("select", on); api.off("reInit", on); };
  }, [api]);
  if (!images.length) return null;
  return (
    <div data-no-swipe className="grid gap-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
        <span>Sketch gallery</span>
        <span>Angle {i + 1}/{images.length} · {Math.round((360 / images.length) * i)}°</span>
      </div>
      <Carousel setApi={setApi} className="relative">
        <CarouselContent>
          {images.map((src, k) => (
            <CarouselItem key={k}>
              <img src={src} alt={`${name} angle ${k + 1}`} loading="lazy" className="aspect-[4/5] w-full rounded-xl bg-secondary object-contain" />
            </CarouselItem>
          ))}
        </CarouselContent>
        {images.length > 1 && (<><CarouselPrevious className="left-2" /><CarouselNext className="right-2" /></>)}
      </Carousel>
      <div className="flex justify-center gap-1.5">
        {images.map((_, k) => (
          <button key={k} aria-label={`Angle ${k + 1}`} onClick={() => api?.scrollTo(k)} className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${k === i ? "w-5 bg-accent" : "w-1.5 bg-border"}`} />
        ))}
      </div>
    </div>
  );
}
