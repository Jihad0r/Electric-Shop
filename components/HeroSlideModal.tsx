"use client";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { HERO_LIMITS, isSafeHref, type HeroSlideData } from "@/lib/heroDefaults";

type Props = {
  slide?: HeroSlideData; // when given, the popup edits this slide
  onClose: () => void;
  onSaved: (slide: HeroSlideData) => void;
};

type FormState = {
  titleTop: string;
  titleAccent: string;
  text: string;
  buttonText: string;
  buttonHref: string;
  showBadge: boolean;
  badgeTop: string;
  badgeMain: string;
  isActive: boolean;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 4 * 1024 * 1024; // 4MB, same limit as the API

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

export default function HeroSlideModal({ slide, onClose, onSaved }: Props) {
  const isEdit = Boolean(slide);

  const [form, setForm] = useState<FormState>({
    titleTop: slide?.titleTop ?? "",
    titleAccent: slide?.titleAccent ?? "",
    text: slide?.text ?? "",
    buttonText: slide ? slide.buttonText : "Shop Now",
    buttonHref: slide ? slide.buttonHref : "/products",
    showBadge: slide?.showBadge ?? false,
    badgeTop: slide?.badgeTop ?? "Up to",
    badgeMain: slide?.badgeMain ?? "",
    isActive: slide?.isActive ?? true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [inputKey, setInputKey] = useState(0); // remounts the file input to clear it
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Preview of a newly chosen image, released when it changes or the popup closes
  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  // Stop the page behind from scrolling while the popup is open
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Close with the Escape key (not while saving)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const imageShown = removeImage ? "" : filePreview || slide?.imageUrl || "";

  const onText = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const onImage = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0] ?? null;
    setError("");

    if (!chosen) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(chosen.type)) {
      setError("Only JPG, PNG or WEBP images are allowed");
      e.target.value = "";
      setFile(null);
      return;
    }
    if (chosen.size > MAX_SIZE) {
      setError("Image must be under 4MB");
      e.target.value = "";
      setFile(null);
      return;
    }
    setFile(chosen);
    setRemoveImage(false);
  };

  const clearImage = () => {
    setFile(null);
    setRemoveImage(true);
    setInputKey((n) => n + 1);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const buttonText = form.buttonText.trim();
    const buttonHref = form.buttonHref.trim();

    if (!form.titleTop.trim() && !form.titleAccent.trim()) return setError("Add a heading");
    if (buttonText && !isSafeHref(buttonHref)) {
      return setError("The button link must start with / (for example /laptops) or https://");
    }

    const data = new FormData();
    data.append("titleTop", form.titleTop.trim());
    data.append("titleAccent", form.titleAccent.trim());
    data.append("text", form.text.trim());
    data.append("buttonText", buttonText);
    data.append("buttonHref", buttonHref);
    data.append("showBadge", String(form.showBadge));
    data.append("badgeTop", form.badgeTop.trim());
    data.append("badgeMain", form.badgeMain.trim());
    data.append("isActive", String(form.isActive));
    if (file) data.append("image", file);
    if (removeImage) data.append("removeImage", "true");

    setSaving(true);
    try {
      // Don't set Content-Type yourself; the browser adds the multipart boundary
      const res = await fetch(isEdit ? `/api/hero/slides/${slide!.id}` : "/api/hero/slides", {
        method: isEdit ? "PUT" : "POST",
        body: data,
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Could not save the slide");
        return;
      }

      onSaved(json as HeroSlideData);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const showBadgePreview = form.showBadge && (form.badgeTop || form.badgeMain);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="slide-modal-title"
        className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-h-[90dvh] sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="slide-modal-title" className="text-xl font-bold text-gray-900">
              {isEdit ? "Edit slide" : "New slide"}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">Changes go live as soon as you save.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-md p-1 text-2xl leading-none text-gray-400 transition hover:text-gray-700 disabled:opacity-50"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
            <div>
              <label htmlFor="slide-title-top" className={labelClass}>
                Heading, line 1
              </label>
              <input
                id="slide-title-top"
                name="titleTop"
                type="text"
                maxLength={HERO_LIMITS.title}
                value={form.titleTop}
                onChange={onText}
                placeholder="Upgrade Your"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="slide-title-accent" className={labelClass}>
                Heading, line 2 (coloured)
              </label>
              <input
                id="slide-title-accent"
                name="titleAccent"
                type="text"
                maxLength={HERO_LIMITS.title}
                value={form.titleAccent}
                onChange={onText}
                placeholder="Tech Experience"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="slide-text" className={labelClass}>
              Paragraph
            </label>
            <textarea
              id="slide-text"
              name="text"
              rows={3}
              maxLength={HERO_LIMITS.text}
              value={form.text}
              onChange={onText}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">
              {form.text.length}/{HERO_LIMITS.text}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
            <div>
              <label htmlFor="slide-button-text" className={labelClass}>
                Button text
              </label>
              <input
                id="slide-button-text"
                name="buttonText"
                type="text"
                maxLength={HERO_LIMITS.button}
                value={form.buttonText}
                onChange={onText}
                placeholder="Shop Now"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="slide-button-href" className={labelClass}>
                Button link
              </label>
              <input
                id="slide-button-href"
                name="buttonHref"
                type="text"
                maxLength={HERO_LIMITS.href}
                value={form.buttonHref}
                onChange={onText}
                placeholder="/laptops"
                className={inputClass}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-gray-400">
            Links start with / for pages on your store (like /laptops or /products/ID), or https://
            for other sites. Leave the button text empty to hide the button.
          </p>

          <fieldset className="rounded-lg border border-gray-200 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-900">
              <input
                type="checkbox"
                checked={form.showBadge}
                onChange={(e) => setForm((prev) => ({ ...prev, showBadge: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Show the corner badge
            </label>

            {form.showBadge && (
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="slide-badge-top" className={labelClass}>
                    Small text
                  </label>
                  <input
                    id="slide-badge-top"
                    name="badgeTop"
                    type="text"
                    maxLength={HERO_LIMITS.badge}
                    value={form.badgeTop}
                    onChange={onText}
                    placeholder="Up to"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="slide-badge-main" className={labelClass}>
                    Big text
                  </label>
                  <input
                    id="slide-badge-main"
                    name="badgeMain"
                    type="text"
                    maxLength={HERO_LIMITS.badge}
                    value={form.badgeMain}
                    onChange={onText}
                    placeholder="40% OFF"
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </fieldset>

          <div>
            <label htmlFor="slide-image" className={labelClass}>
              Slide image
            </label>
            <input
              key={inputKey}
              id="slide-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onImage}
              className="block w-full text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-400">
              JPG, PNG or WEBP, up to 4MB. A PNG with a transparent background looks best. Without an
              image, the slide shows your newest products.
            </p>
            {imageShown && (
              <button
                type="button"
                onClick={clearImage}
                className="mt-2 text-sm font-medium text-red-600 hover:underline"
              >
                Remove image
              </button>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Show this slide on the home page
          </label>

          {/* Live preview */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Preview</p>
            <div className="overflow-hidden rounded-xl bg-linear-to-r from-ink-950 via-ink-900 to-brand-700 p-5">
              <div className="grid items-center gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-2xl font-extrabold leading-tight text-white">
                    {form.titleTop}
                    {form.titleTop && form.titleAccent && <br />}
                    <span className="bg-linear-to-r from-sky-200 to-sky-400 bg-clip-text text-transparent">
                      {form.titleAccent}
                    </span>
                  </p>
                  {form.text && <p className="mt-2 text-sm text-slate-100">{form.text}</p>}
                  {form.buttonText && (
                    <span className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
                      {form.buttonText} &rarr;
                    </span>
                  )}
                </div>

                <div className="flex min-h-32 items-center justify-center">
  {imageShown ? (
    <div className="relative inline-block max-w-full">
      {showBadgePreview && (
        <div className="absolute -right-2 -top-2 z-10 rounded-lg bg-brand-600 px-2.5 py-1.5 text-center leading-tight">
          <p className="text-[10px] text-blue-100">{form.badgeTop}</p>
          <p className="text-sm font-extrabold text-white">{form.badgeMain}</p>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageShown}
        alt="Slide preview"
        className="block h-auto max-h-40 w-auto max-w-full object-contain drop-shadow-xl"
      />
    </div>
  ) : (
    <p className="px-4 text-center text-xs text-slate-300">
      No image. Your newest products are shown instead.
    </p>
  )}
</div>
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : isEdit ? "Save changes" : "Add slide"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}