"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addToCart, useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { CURRENCY } from "@/lib/store";
import type { ProductDetail, ProductDetailVariant } from "@/types/product";

type Selected = Record<string, string>; // option name -> chosen value
type Message = "added" | "partial" | "max" | "error" | null;

const LOW_STOCK = 5;
const MAX_QTY = 10;

const selectionsOf = (v: ProductDetailVariant): Selected =>
  Object.fromEntries(v.selections.map((s) => [s.name, s.value]));

export default function ProductPurchase({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const { cart } = useCart();
  const { options, variants } = product;
  const hasOptions = variants.length > 0;

  // Start on the first combination that is in stock
  const [selected, setSelected] = useState<Selected>(() => {
    const start = variants.find((v) => v.stock > 0) ?? variants[0];
    return start ? selectionsOf(start) : {};
  });
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<Message>(null);
  const [adding, setAdding] = useState(false);
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

  // How many of this exact product (and option) are already in the cart, from the database
  const cartKey = `${product._id}:${variant?._id ?? ""}`;
  const inCart = cart.lines.find((l) => l.key === cartKey)?.quantity ?? 0;

  // What can still be added
  const room = Math.max(0, stock - inCart);
  const maxQty = Math.max(1, Math.min(room, MAX_QTY));
  const qty = Math.min(quantity, maxQty);
  const ready = stock > 0 && (!hasOptions || Boolean(variant));
  const canAdd = ready && room > 0;
  const canBuy = ready && (canAdd || inCart > 0);

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
    setMessage(null);
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

  const putInCart = () =>
    addToCart({ productId: product._id, variantId: variant?._id, quantity: qty });

  const handleAdd = async () => {
    if (!canAdd || adding) return;

    setAdding(true);
    const result = await putInCart(); // the server enforces the stock limit
    setAdding(false);

    setMessage(
      result.status === "added"
        ? "added"
        : result.status === "partial"
          ? "partial"
          : result.status === "max" || result.status === "soldout"
            ? "max"
            : "error"
    );
    setQuantity(1);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 4000);
  };

  // Add to the cart, then go straight to checkout
  const handleBuyNow = async () => {
    if (!canBuy || adding) return;

    setAdding(true);
    if (canAdd) {
      const result = await putInCart();
      if (result.status === "error" || result.status === "unavailable" || result.status === "invalid") {
        setAdding(false);
        setMessage("error");
        return;
      }
    }
    router.push("/checkout");
  };

  const addText = stock === 0 ? "Out of stock" : room === 0 ? "Maximum in cart" : "Add to Cart";

  return (
    <div>
      {/* The chosen option, under the title */}
      {label && <p className="mt-1 text-sm text-gray-500">{label}</p>}

      {/* Price */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-3xl font-extrabold text-gray-900">{formatMoney(price, CURRENCY)}</p>
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
            {option.name}:{" "}
            <span className="font-semibold text-gray-900">{selected[option.name]}</span>
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
                        ? "border-gray-300 text-gray-800 hover:border-gray-500"
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

      {/* Stock and quantity */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p
          className={`flex items-center gap-2 text-sm font-medium ${
            stock === 0 ? "text-red-600" : stock <= LOW_STOCK ? "text-amber-600" : "text-green-600"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${
              stock === 0 ? "bg-red-500" : stock <= LOW_STOCK ? "bg-amber-500" : "bg-green-500"
            }`}
          />
          {stock === 0 ? "Out of stock" : stock <= LOW_STOCK ? `Only ${stock} left` : "In stock"}
        </p>

        <div className="flex items-center overflow-hidden rounded-lg border border-gray-300">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, qty - 1))}
            disabled={!canAdd || qty <= 1}
            aria-label="Decrease quantity"
            className="px-4 py-2 text-lg text-gray-700 transition hover:bg-gray-50 disabled:text-gray-300"
          >
            −
          </button>
          <span aria-live="polite" className="w-10 text-center text-sm font-semibold text-gray-900">
            {canAdd ? qty : 0}
          </span>
          <button
            type="button"
            onClick={() => setQuantity(Math.min(maxQty, qty + 1))}
            disabled={!canAdd || qty >= maxQty}
            aria-label="Increase quantity"
            className="px-4 py-2 text-lg text-gray-700 transition hover:bg-gray-50 disabled:text-gray-300"
          >
            +
          </button>
        </div>
      </div>

      {inCart > 0 && stock > 0 && (
        <p className="mt-2 text-sm text-gray-500">
          {inCart} in your cart{room === 0 ? ". That's all we have." : ""}
        </p>
      )}

      {/* Buttons */}
      <div className="mt-5 grid gap-3">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd || adding}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="9" cy="20" r="1.5" />
            <circle cx="18" cy="20" r="1.5" />
            <path d="M3 4h2.5l2.2 11h10.6L21 8H6.2" />
          </svg>
          {adding ? "Adding..." : addText}
        </button>

        <button
          type="button"
          onClick={handleBuyNow}
          disabled={!canBuy || adding}
          className="w-full rounded-xl bg-ink-900 px-6 py-3.5 font-semibold text-white transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Buy Now
        </button>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-3 text-sm ${message === "added" ? "text-green-700" : "text-amber-700"}`}
        >
          {message === "added" && "Added to your cart. "}
          {message === "partial" && "We added what was left in stock. "}
          {message === "max" && "All available stock is already in your cart. "}
          {message === "error" && "We couldn't add it. Please try again. "}
          <Link href="/cart" className="font-medium underline">
            View cart
          </Link>
        </p>
      )}
    </div>
  );
}