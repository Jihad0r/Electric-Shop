"use client";
import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { DEFAULT_HERO_IMAGE, type HeroSlideData } from "@/lib/heroDefaults";
type Fallback = { id: string; image: string };

const AUTOPLAY_MS = 6000; // time each slide stays, in milliseconds
const SWIPE_PX = 50;

const FALLBACK_POSITIONS = [
  "left-0 top-8 w-[54%]",
  "right-0 top-0 w-[44%]",
  "right-[6%] bottom-0 w-[40%]",
];

const buttonClass =
  "mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-500";

const arrowClass =
  "flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20";

function Visual({
  slide,
  fallback,
  priority,
}: {
  slide: HeroSlideData;
  fallback: Fallback[];
  priority: boolean;
}) {
  const showBadge = slide.showBadge && Boolean(slide.badgeTop || slide.badgeMain);

  // Sits on the top-right corner of whatever it is placed inside
  const badge = showBadge && (
    <div className="absolute -right-2 -top-3 z-10 rounded-xl bg-brand-600 px-3 py-2 text-center leading-tight shadow-lg shadow-brand-600/40 sm:-right-4 sm:-top-4 sm:px-4 sm:py-2.5">
      <p className="text-xs text-blue-100">{slide.badgeTop}</p>
      <p className="text-base font-extrabold text-white sm:text-lg">{slide.badgeMain}</p>
    </div>
  );

  // Your picture: no box, no frame. The wrapper is exactly as big as the image,
  // so the badge lands on the image's own top-right corner.
    // The slide's own image, or the default one
  const src = slide.imageUrl || DEFAULT_HERO_IMAGE;

  if (src) {
    return (
      <div className="flex justify-center">
        <div className="relative inline-block max-w-full">
          {badge}
          {/* A plain <img> keeps its natural proportions, so the corner is always the image's corner */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            fetchPriority={priority ? "high" : undefined}
            className="block h-auto max-h-72 w-auto max-w-full object-contain drop-shadow-2xl sm:max-h-96 lg:max-h-[28rem]"
          />
        </div>
      </div>
    );
  }

  // No image uploaded: show the newest product photos
  if (fallback.length > 0) {
    return (
      <div className="relative mx-auto h-72 w-full max-w-md sm:h-96 lg:max-w-none">
        {badge}
        <div className="absolute inset-0" aria-hidden="true">
          {fallback.map((p, i) => (
            <div
              key={p.id}
              className={`absolute ${FALLBACK_POSITIONS[i]} aspect-square overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/15 backdrop-blur`}
            >
              <Image src={p.image} alt="" fill sizes="260px" className="object-contain p-3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default function HeroSlider({
  slides,
  fallback,
}: {
  slides: HeroSlideData[];
  fallback: Fallback[]; // newest product photos, used by slides that have no image
}) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const touchX = useRef<number | null>(null);

  // People who prefer less motion get no automatic sliding
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduceMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  // Slide automatically. Changing slide by hand restarts the timer
  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [count, paused, reduceMotion, index]);

  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > SWIPE_PX) go(index + (dx < 0 ? 1 : -1));
  };

  return (
    <section
      className="relative overflow-hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="absolute inset-0 bg-linear-to-r from-ink-950 via-ink-900 to-brand-700"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* All slides share one cell, so the tallest one sets the height and they crossfade */}
        <div className="grid">
          {slides.map((slide, i) => {
            const active = i === index;
            const Heading = i === 0 ? "h1" : "h2"; // one h1 per page
            const hasButton = Boolean(slide.buttonText && slide.buttonHref);
            const isExternal = /^https?:\/\//i.test(slide.buttonHref);

            return (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                aria-hidden={!active}
                className={`col-start-1 row-start-1 grid items-center gap-10 py-12 transition-[opacity,visibility] duration-500 sm:py-16 lg:grid-cols-2 lg:py-20 ${
                  active ? "visible opacity-100" : "invisible opacity-0"
                }`}
              >
                <div>
                  <Heading className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
                    {slide.titleTop}
                    {slide.titleTop && slide.titleAccent && <br />}
                    <span className="bg-linear-to-r from-sky-200 to-sky-400 bg-clip-text text-transparent">
                      {slide.titleAccent}
                    </span>
                  </Heading>

                  {slide.text && (
                    <p className="mt-5 max-w-lg text-base text-slate-100 sm:text-lg">{slide.text}</p>
                  )}

                  {hasButton &&
                    (isExternal ? (
                      <a href={slide.buttonHref} className={buttonClass}>
                        {slide.buttonText} <span aria-hidden="true">&rarr;</span>
                      </a>
                    ) : (
                      <Link href={slide.buttonHref} className={buttonClass}>
                        {slide.buttonText} <span aria-hidden="true">&rarr;</span>
                      </Link>
                    ))}
                </div>

                <Visual slide={slide} fallback={fallback} priority={i === 0} />
              </div>
            );
          })}
        </div>

        {/* Controls sit below the slides, so they never cover the content */}
        {count > 1 && (
          <div className="flex items-center justify-center gap-4 pb-6">
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous slide"
              className={arrowClass}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index ? "true" : undefined}
                  className={`h-2.5 rounded-full transition-all ${
                    i === index ? "w-7 bg-white" : "w-2.5 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next slide"
              className={arrowClass}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}