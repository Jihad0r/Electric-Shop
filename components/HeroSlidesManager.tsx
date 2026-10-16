"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import HeroSlideModal from "@/components/HeroSlideModal";
import { MAX_SLIDES, type HeroSlideData } from "@/lib/heroDefaults";

type State = "loading" | "ready" | "error";
type ModalState = { slide?: HeroSlideData } | null; // {} = new slide

const smallButton =
  "rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40";

export default function HeroSlidesManager() {
  const [state, setState] = useState<State>("loading");
  const [slides, setSlides] = useState<HeroSlideData[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/hero/slides");
        if (!res.ok) throw new Error("Failed to load");
        const data: HeroSlideData[] = await res.json();
        if (!cancelled) {
          setSlides(data);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaved = (saved: HeroSlideData) =>
    setSlides((prev) =>
      prev.some((s) => s.id === saved.id)
        ? prev.map((s) => (s.id === saved.id ? saved : s))
        : [...prev, saved]
    );

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= slides.length || busy) return;

    const previous = slides;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];

    setSlides(next); // show the new order straight away
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/hero/slides/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setSlides(previous); // put it back if saving failed
      setError("Could not change the order. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (slide: HeroSlideData) => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/hero/slides/${slide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !slide.isActive }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not update the slide");
        return;
      }
      handleSaved(json as HeroSlideData);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slide: HeroSlideData) => {
    const name = [slide.titleTop, slide.titleAccent].filter(Boolean).join(" ") || "this slide";
    const last = slides.length === 1;
    const ok = window.confirm(
      `Delete "${name}"? This cannot be undone.${
        last ? " It's your only slide, so the home page will show the default hero." : ""
      }`
    );
    if (!ok) return;

    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/hero/slides/${slide.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not delete the slide");
        return;
      }
      setSlides((prev) => prev.filter((s) => s.id !== slide.id));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const activeCount = slides.filter((s) => s.isActive).length;
  const full = slides.length >= MAX_SLIDES;

  return (
    <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Hero slides</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            The banner at the top of your home page. With 2 or more active slides it becomes a slider.
          </p>
        </div>
        <button
          onClick={() => setModal({})}
          disabled={full || state !== "ready"}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          + Add slide
        </button>
      </div>

      {state === "loading" && <p className="mt-4 text-sm text-gray-500">Loading slides...</p>}
      {state === "error" && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          Could not load the slides. Please refresh the page.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {state === "ready" && (
        <>
          {slides.length === 0 ? (
            <div className="mt-4 rounded-xl bg-gray-50 px-4 py-8 text-center">
              <p className="font-medium text-gray-900">No slides yet</p>
              <p className="mt-1 text-sm text-gray-500">
                The home page is showing the default hero. Add a slide to replace it.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-3 text-xs text-gray-400">
                {slides.length} of {MAX_SLIDES} slides · {activeCount} on the home page
                {activeCount === 0 && " (none active, so the default hero is shown)"}
              </p>

              <ul className="mt-3 space-y-3">
                {slides.map((slide, index) => {
                  const title =
                    [slide.titleTop, slide.titleAccent].filter(Boolean).join(" ") || "Untitled";
                  return (
                    <li
                      key={slide.id}
                      className={`rounded-xl p-3 ring-1 ring-gray-200 ${
                        slide.isActive ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      <div className="flex gap-3">
                        {slide.imageUrl ? (
                          <Image
                            src={slide.imageUrl}
                            alt=""
                            width={64}
                            height={64}
                            className="h-16 w-16 shrink-0 rounded-lg bg-gray-100 object-contain"
                          />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-center text-[10px] text-gray-400">
                            No image
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-gray-900">
                              {index + 1}. {title}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                slide.isActive
                                  ? "bg-green-50 text-green-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {slide.isActive ? "Active" : "Paused"}
                            </span>
                          </div>
                          {slide.text && (
                            <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{slide.text}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => move(index, -1)}
                          disabled={busy || index === 0}
                          aria-label="Move up"
                          className={smallButton}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => move(index, 1)}
                          disabled={busy || index === slides.length - 1}
                          aria-label="Move down"
                          className={smallButton}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => setModal({ slide })}
                          disabled={busy}
                          className={smallButton}
                        >
                          Edit
                        </button>
                        <button onClick={() => toggle(slide)} disabled={busy} className={smallButton}>
                          {slide.isActive ? "Pause" : "Resume"}
                        </button>
                        <button
                          onClick={() => remove(slide)}
                          disabled={busy}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}

      {modal && (
        <HeroSlideModal
          key={modal.slide?.id ?? "new"}
          slide={modal.slide}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}