"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { formatMoney } from "@/lib/format";
import { CURRENCY } from "@/lib/store";
import type { DiscountType, Offer } from "@/types/offer";
import type { Product } from "@/types/product";

type Props = {
  offer?: Offer; // when given, the popup edits this offer
  products: Product[];
  onClose: () => void;
  onSaved: (offer: Offer) => void;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

// ISO date -> value for <input type="datetime-local"> in the browser's own time zone
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OfferModal({ offer, products, onClose, onSaved }: Props) {
  const isEdit = Boolean(offer);

  const [title, setTitle] = useState(offer?.title ?? "");
  const [description, setDescription] = useState(offer?.description ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>(offer?.discountType ?? "percent");
  const [discountValue, setDiscountValue] = useState(offer ? String(offer.discountValue) : "");
  const [applyToAll, setApplyToAll] = useState(offer?.applyToAll ?? false);
  const [selected, setSelected] = useState<string[]>(offer?.products ?? []);
  const [startsAt, setStartsAt] = useState(toLocalInput(offer?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(offer?.endsAt ?? null));
  const [isActive, setIsActive] = useState(offer?.isActive ?? true);
  const [showOnHome, setShowOnHome] = useState(offer?.showOnHome ?? true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, search]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectShown = () =>
    setSelected((prev) => [...new Set([...prev, ...shown.map((p) => p._id)])]);

  // Example so the admin can see what the discount does
  const value = Number(discountValue);
  const example =
    Number.isFinite(value) && value > 0
      ? Math.max(0, discountType === "percent" ? 1000 * (1 - value / 100) : 1000 - value)
      : null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) return setError("Give the offer a title");
    if (!Number.isFinite(value) || value <= 0) return setError("Enter a discount value above 0");
    if (discountType === "percent" && value > 90) {
      return setError("A percent discount can't be more than 90");
    }
    if (!applyToAll && selected.length === 0) {
      return setError("Choose at least one product, or apply the offer to all products");
    }
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      return setError("The end date must be after the start date");
    }

    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/offers/${offer!._id}` : "/api/offers", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          discountType,
          discountValue: value,
          applyToAll,
          products: selected,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          isActive,
          showOnHome,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Could not save the offer");
        return;
      }

      onSaved(json as Offer);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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
        aria-labelledby="offer-modal-title"
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-h-[90dvh] sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="offer-modal-title" className="text-xl font-bold text-gray-900">
              {isEdit ? "Edit offer" : "New offer"}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Active offers show on your home page and apply at checkout.
            </p>
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
          <div>
            <label htmlFor="offer-title" className={labelClass}>
              Title *
            </label>
            <input
              id="offer-title"
              type="text"
              maxLength={60}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Laptop Deals"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="offer-description" className={labelClass}>
              Description
            </label>
            <input
              id="offer-description"
              type="text"
              maxLength={160}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown under the title on the home page"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
            <div>
              <label htmlFor="offer-type" className={labelClass}>
                Discount type
              </label>
              <select
                id="offer-type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                className={inputClass}
              >
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed amount ({CURRENCY})</option>
              </select>
            </div>
            <div>
              <label htmlFor="offer-value" className={labelClass}>
                {discountType === "percent" ? "Percent off *" : `Amount off (${CURRENCY}) *`}
              </label>
              <input
                id="offer-value"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percent" ? "e.g. 20" : "e.g. 500"}
                className={inputClass}
              />
            </div>
          </div>

          {example !== null && (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
              Example: a product at {formatMoney(1000, CURRENCY)} would cost{" "}
              <strong>{formatMoney(example, CURRENCY)}</strong>.
            </p>
          )}

          {/* Which products */}
          <section className="rounded-xl border border-gray-200 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-900">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Apply to all products
            </label>

            {!applyToAll && (
              <div className="mt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products..."
                    aria-label="Search products"
                    className={inputClass}
                  />
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={selectShown}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Select shown
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelected([])}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-xs text-gray-500">{selected.length} selected</p>

                <ul className="mt-2 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-lg ring-1 ring-gray-200">
                  {shown.length === 0 && (
                    <li className="px-3 py-4 text-center text-sm text-gray-500">
                      No products found.
                    </li>
                  )}
                  {shown.map((p) => (
                    <li key={p._id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selected.includes(p._id)}
                          onChange={() => toggle(p._id)}
                          className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600"
                        />
                        {p.image?.url ? (
                          <Image
                            src={p.image.url}
                            alt=""
                            width={36}
                            height={36}
                            className="h-9 w-9 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="h-9 w-9 shrink-0 rounded bg-gray-100" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                          {p.name}
                        </span>
                        <span className="shrink-0 text-xs text-gray-500">
                          {formatMoney(p.price, CURRENCY)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
            <div>
              <label htmlFor="offer-start" className={labelClass}>
                Starts (optional)
              </label>
              <input
                id="offer-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="offer-end" className={labelClass}>
                Ends (optional)
              </label>
              <input
                id="offer-end"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-gray-400">
            Leave both empty to run the offer until you switch it off.
          </p>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Offer is switched on
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showOnHome}
                onChange={(e) => setShowOnHome(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Show as a row on the home page
            </label>
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
              {saving ? "Saving..." : isEdit ? "Save changes" : "Create offer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}