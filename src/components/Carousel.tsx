import { useEffect, useState } from 'react';

interface CarouselProps {
  slides: { src: string; alt: string }[];
}

export function Carousel({ slides }: CarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className="relative mt-5 w-full overflow-hidden rounded-lg border">
      <div
        className="flex items-center transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, idx) => (
          <div key={idx} className="w-full shrink-0">
            <img
              src={slide.src}
              alt={slide.alt}
              referrerPolicy="no-referrer"
              className="block w-full h-auto object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setIndex(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all ${
                idx === index ? 'w-5 bg-[#5a4bda] dark:bg-[#29ff94]' : 'w-2 bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
