"use client";

import { useCallback, useEffect, useState } from "react";
import { siteAsset } from "@/lib/assetBase";

const SLIDES = [
  {
    src: "/assets/imgg/dl-acc.jpg",
    alt: "Le Repasseur — collecte et repassage à domicile, restitué en 24 h",
  },
  {
    src: "/assets/imgg/dl-SliderSite1.jpg",
    alt: "Le Repasseur — la flemme de repasser ?",
  },
  {
    src: "/assets/imgg/dl-SliderSite3.jpg",
    alt: "Le Repasseur — abonnements à partir de 19 € par mois",
  },
] as const;

const INTERVAL_MS = 6000;

export function HomeHeroSlider() {
  const [index, setIndex] = useState(0);
  const count = SLIDES.length;

  const goTo = useCallback(
    (next: number) => {
      setIndex((next + count) % count);
    },
    [count]
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [count]);

  const slideWidthPercent = 100 / count;

  return (
    <section
      className="relative isolate w-full overflow-hidden bg-[#10294B]/5"
      aria-label="Bannière Le Repasseur"
      aria-roledescription="carousel"
    >
      <div
        className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{
          width: `${count * 100}%`,
          transform: `translateX(-${index * slideWidthPercent}%)`,
        }}
      >
        {SLIDES.map((slide) => (
          <div
            key={slide.src}
            className="shrink-0"
            style={{ width: `${slideWidthPercent}%` }}
            role="group"
            aria-roledescription="slide"
            aria-hidden={SLIDES[index]?.src !== slide.src}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteAsset(slide.src)}
              alt={slide.alt}
              className="block h-auto w-full object-cover object-center"
              draggable={false}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => goTo(index - 1)}
        className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-[#10294B]/75 text-white shadow-lg backdrop-blur-sm transition hover:bg-[#10294B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CE2029] sm:left-4 sm:h-11 sm:w-11"
        aria-label="Image précédente"
      >
        <span aria-hidden className="text-xl leading-none">
          ‹
        </span>
      </button>
      <button
        type="button"
        onClick={() => goTo(index + 1)}
        className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-[#10294B]/75 text-white shadow-lg backdrop-blur-sm transition hover:bg-[#10294B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CE2029] sm:right-4 sm:h-11 sm:w-11"
        aria-label="Image suivante"
      >
        <span aria-hidden className="text-xl leading-none">
          ›
        </span>
      </button>

      <div
        className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-2"
        role="tablist"
        aria-label="Choisir une bannière"
      >
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Bannière ${i + 1} sur ${count}`}
            onClick={() => goTo(i)}
            className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CE2029] focus-visible:ring-offset-2 ${
              i === index
                ? "w-8 bg-[#CE2029]"
                : "w-2.5 bg-white/80 hover:bg-white"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
