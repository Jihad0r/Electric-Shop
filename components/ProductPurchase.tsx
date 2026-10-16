"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addToCart } from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { CURRENCY } from "@/lib/store";
import type { ProductDetail, ProductDetailVariant } from "@/types/product";

type Selected = Record<string, string>; // option name -> chosen value

const LOW_STOCK = 5;
const MAX_QTY = 10;

const selectionsOf = (v: ProductDetailVariant): Selected =>
  Object.fromEntries(v.selections.map((s) => [s.name, s.value]));

export default function ProductPurchase({ product }: { product: ProductDetail }) {
  const { options, variants } = product;
  const hasOptions = variants.length > 0;

  // Start on the first combination that is in stock
  const [selected, setSelected] = useState<Selected>(() => {
    const start = variants.find((v) => v.stock > 0) ?? variants[0];
    return start ? selectionsOf(start) : {};
  });
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // The combination that matches the current choices
  const variant = useMemo(
    () =>
      hasOptions
        ? variants.find((v) =>
            options.every((o) =>
              v.selections.some((s) => s.name === o.name && s.value === selected[o.name])
            )
          )
        : undefined,
    [hasOptions, variants, options, selected]
  );

  const price = hasOptions ? (variant?.price ?? 0) : product.price;
  const originalPrice = hasOptions ? variant?.originalPrice : product.originalPrice;
  const discountPercent = hasOptions ? variant?.discountPercent : product.discountPercent;
  const stock = hasOptions ? (variant?.stock ?? 0) : product.stock;
  const label = variant ? variant.selections.map((s) => s.value).join(" / ") : "";

  const maxQty = Math.max(1, Math.min(stock, MAX_QTY));
  const qty = Math.min(quantity, maxQty);

  // Picking a value: keep the other choices when that combination exists,
  // otherwise jump to the closest combination that does
  const pick = (name: string, value: string) => {
    const withValue = variants.filter((v) =>
      v.selections.some((s) => s.name === name && s.value === value)
    );
    if (withValue.length === 0) return;

    const keepsOthers = withValue.find((v) =>
      options.every(
        (o) =>
          o.name === name ||
          v.selections.some((s) => s.name === o.name && s.value === selected[o.name])
      )
    );
    const best = keepsOthers ?? withValue.find((v) => v.stock > 0) ?? withValue[0];

    setSelected(selectionsOf(best));
    setQuantity(1);
    setAdded(false);
  };

  // Is this value available in stock together with the other current choices?
  const inStock = (name: string, value: string) =>
    variants.some(
      (v) =>
        v.stock > 0 &&
        v.selections.some((s) => s.name === name && s.value === value) &&
        options.every(
          (o) =>
            o.name === name ||
            v.selections.some((s) => s.name === o.name && s.value === selected[o.name])
        )
    );

  const handleAdd = () => {
    if (stock === 0) return;

    addToCart({
      productId: product._id,
      variantId: variant?._id,
      name: product.name,
      image: product.image,
      label: label || undefined,
      price,
      quantity: qty,
    });

    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 3000);
  };

  return (
    <div>
      {/* Price */}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-3xl font-bold text-gray-900">
          {formatMoney(price, CURRENCY)}
        </p>
        {originalPrice !== undefined && (
          <p className="text-lg text-gray-400 line-through">
            {formatMoney(originalPrice, CURRENCY)}
          </p>
        )}
        {discountPercent !== undefined && (
          <span className="rounded-md bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
            -{discountPercent}%
          </span>
        )}
      </div>

      {/* Options (RAM, Storage...) */}
      {options.map((option) => (
        <fieldset key={option.name} className="mt-5">
          <legend className="text-sm font-medium text-gray-700">
            {option.name}: <span className="font-semibold text-gray-900">{selected[option.name]}</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {option.values.map((value) => {
              const isSelected = selected[option.name] === value;
              const available = inStock(option.name, value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => pick(option.name, value)}
                  aria-pressed={isSelected}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    isSelected
                      ? "border-brand-600 bg-blue-50 text-brand-700 ring-1 ring-brand-600"
                      : available
                        ? "border-gray-300 text-gray-800 hover:border-gray-400"
                        : "border-gray-200 text-gray-400 line-through hover:border-gray-300"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      {/* Stock */}
      <p
        className={`mt-5 text-sm font-medium ${
          stock === 0 ? "text-red-600" : stock <= LOW_STOCK ? "text-amber-600" : "text-green-600"
        }`}
      >
        {stock === 0 ? "Out of stock" : stock <= LOW_STOCK ? `Only ${stock} left` : "In stock"}
      </p>

      {/* Quantity and add to cart */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex w-full items-center justify-between rounded-lg border border-gray-300 sm:w-36">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, qty - 1))}
            disabled={stock === 0 || qty <= 1}
            aria-label="Decrease quantity"
            className="px-4 py-2.5 text-lg text-gray-700 transition hover:bg-gray-50 disabled:text-gray-300"
          >
            −
          </button>
          <span aria-live="polite" className="text-sm font-semibold text-gray-900">
            {stock === 0 ? 0 : qty}
          </span>
          <button
            type="button"
            onClick={() => setQuantity(Math.min(maxQty, qty + 1))}
            disabled={stock === 0 || qty >= maxQty}
            aria-label="Increase quantity"
            className="px-4 py-2.5 text-lg text-gray-700 transition hover:bg-gray-50 disabled:text-gray-300"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={stock === 0}
          className="flex-1 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {stock === 0 ? "Out of stock" : "Add to Cart"}
        </button>
      </div>

      {added && (
        <p role="status" className="mt-3 text-sm text-green-700">
          Added to your cart.{" "}
          <Link href="/cart" className="font-medium underline">
            View cart
          </Link>
        </p>
      )}
    </div>
  );
}