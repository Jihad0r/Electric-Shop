"use client";
import { useCallback, useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";

const AUTOPLAY_MS = 3500; // time between automatic moves, in milliseconds

type Props = {
  children: ReactNode; // the <li> cards
  label: string; // read out by screen readers
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const arrowClass =
  "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-2 ring-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-0";

export default function ProductSlider({ children, label }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const paused = useRef(false); // mouse over, or keyboard focus inside
  const lastClick = useRef(0); // last time an arrow was clicked
  const maxIndexRef = useRef(0);

  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0); // width of one card plus the gap
  const [maxOffset, setMaxOffset] = useState(0); // how far the row can move, in pixels
  const [perView, setPerView] = useState(1); // how many cards fit on screen

  // Measures the cards and the space available (runs on load and on every resize)
  const measure = useCallback(() => {
    const v = viewport.current;
    const t = track.current;
    const first = t?.firstElementChild as HTMLElement | null;
    if (!v || !t || !first) return;

    const gap = parseFloat(getComputedStyle(t).columnGap) || 0;
    const nextStep = first.offsetWidth + gap;

    setStep(nextStep);
    setMaxOffset(Math.max(0, t.offsetWidth - v.clientWidth));
    setPerView(Math.max(1, Math.floor((v.clientWidth + gap) / nextStep)));
  }, []);

  useEffect(() => {
    const v = viewport.current;
    const t = track.current;
    if (!v || !t) return;

    const observer = new ResizeObserver(measure);
    observer.observe(v);
    observer.observe(t);
    return () => observer.disconnect();
  }, [measure]);

  const maxIndex = step > 0 ? Math.ceil(maxOffset / step) : 0;
  const current = Math.min(index, maxIndex);
  const offset = Math.min(current * step, maxOffset);
  const overflowing = maxOffset > 2; // false when every card already fits

  useEffect(() => {
    maxIndexRef.current = maxIndex;
  }, [maxIndex]);

  // Automatic sliding: one card at a time, then back to the start
  useEffect(() => {
    const timer = setInterval(() => {
      if (paused.current || document.hidden || reducedMotion()) return;
      if (Date.now() - lastClick.current < AUTOPLAY_MS) return; // an arrow was just used

      const max = maxIndexRef.current;
      if (max <= 0) return; // everything fits, nothing to slide

      setIndex((i) => (i >= max ? 0 : i + 1));
    }, AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, []);

  const go = (direction: 1 | -1) => {
    lastClick.current = Date.now();
    setIndex(Math.max(0, Math.min(current + direction * perView, maxIndex)));
  };

  // Tabbing to a card that is out of view brings it into view
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    paused.current = true;

    const li = (e.target as HTMLElement).closest("li");
    const cards = track.current ? Array.from(track.current.children) : [];
    const i = li ? cards.indexOf(li) : -1;
    if (i < 0) return;

    if (i < current) setIndex(i);
    else if (i >= current + perView) setIndex(Math.min(i - perView + 1, maxIndex));
  };

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onPointerEnter={(e) => {
        // Only a real mouse pauses it. A tap on a phone must not freeze it.
        if (e.pointerType === "mouse") paused.current = true;
      }}
      onPointerLeave={() => {
        paused.current = false;
      }}
      onFocus={onFocus}
      onBlur={() => {
        paused.current = false;
      }}
    >
      {/* The viewport clips the row. Nothing in it can be scrolled, dragged or swiped. */}
      <div
        ref={viewport}
        onScroll={(e) => {
          // Browsers can scroll a clipped box when a child gets focus. Undo it.
          if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0;
        }}
        className="overflow-hidden py-3"
      >
        <ul
          ref={track}
          className="flex w-max gap-3 transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${offset}px)` }}
        >
          {children}
        </ul>
      </div>

      {overflowing && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={current <= 0}
            aria-label="Previous products"
            className={`${arrowClass} left-1 sm:-left-4`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={current >= maxIndex}
            aria-label="Next products"
            className={`${arrowClass} right-1 sm:-right-4`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}