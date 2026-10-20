"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  MAX_LINE_QTY,
  cartSnapshot,
  clearCart,
  parseCart,
  removeFromCart,
  setQuantity,
  subscribeCart,
  type CartItem,
} from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { FREE_SHIPPING_OVER, shippingFor } from "@/lib/shipping";
import { CURRENCY } from "@/lib/store";

type LineInfo = {
  available: boolean;
  name?: string;
  image?: string;
  label?: string;
  price?: number;
  originalPrice?: number;
  stock?: number;
};

type Status = "ok" | "over" | "soldout" | "unavailable";

type Row = {
  item: CartItem;
  name: string;
  image?: string;
  label?: string;
  unit: number;
  original?: number;
  stock?: number;
  status: Status;
  priceChanged: boolean;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) => formatMoney(n, CURRENCY);

// Lets the page wait until the browser has loaded the cart, so it never flashes "empty"
const noopSubscribe = () => () => {};

const stepButton =
  "flex h-9 w-9 items-center justify-center text-lg text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300";

export default function CartView() {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const raw = useSyncExternalStore(subscribeCart, cartSnapshot, () => "[]");
  const items = useMemo(() => parseCart(raw), [raw]);

  const [info, setInfo] = useState<Record<string, LineInfo>>({});
  const [failed, setFailed] = useState(false);

  // Lines we haven't checked against the database yet
  const missingSig = items
    .filter((i) => !info[i.key])
    .map((i) => i.key)
    .join("|");
  const checking = missingSig !== "" && !failed;

  useEffect(() => {
    if (!missingSig || failed) return;

    const controller = new AbortController();
    const keys = missingSig.split("|");
    const lines = keys.map((key) => {
      const [productId, variantId] = key.split(":");
      return { productId, variantId: variantId || undefined };
    });

    (async () => {
      try {
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: lines }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed");

        const data: { items: Record<string, LineInfo> } = await res.json();

        // Anything the server didn't answer for counts as unavailable, so we never wait forever
        const next: Record<string, LineInfo> = {};
        for (const key of keys) next[key] = data.items[key] ?? { available: false };
        setInfo((prev) => ({ ...prev, ...next }));
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();

    return () => controller.abort();
  }, [missingSig, failed]);

  const rows: Row[] = useMemo(
    () =>
      items.map((item) => {
        const live = info[item.key];

        if (live && !live.available) {
          return {
            item,
            name: item.name,
            image: item.image,
            label: item.label,
            unit: item.price,
            status: "unavailable",
            priceChanged: false,
          };
        }

        const stock = live?.stock;
        const status: Status =
          stock === undefined ? "ok" : stock <= 0 ? "soldout" : item.quantity > stock ? "over" : "ok";
        const unit = live?.price ?? item.price;

        return {
          item,
          name: live?.name ?? item.name,
          image: live?.image || item.image,
          label: live?.label ?? item.label,
          unit,
          original: live?.originalPrice,
          stock,
          status,
          priceChanged: Boolean(live) && unit !== item.price,
        };
      }),
    [items, info]
  );

  const counted = rows.filter((r) => r.status === "ok" || r.status === "over");
  const subtotal = round2(counted.reduce((sum, r) => sum + r.unit * r.item.quantity, 0));
  const savings = round2(
    counted.reduce((sum, r) => sum + (r.original ? (r.original - r.unit) * r.item.quantity : 0), 0)
  );
  const shipping = counted.length > 0 ? shippingFor(subtotal) : 0;
  const total = round2(subtotal + shipping);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const blocked = rows.some((r) => r.status !== "ok");
  const canCheckout = rows.length > 0 && !blocked && !checking;

  const handleClear = () => {
    if (window.confirm("Remove everything from your cart?")) clearCart();
  };

  if (!hydrated) {
    return (
      <div aria-hidden="true" className="rounded-2xl bg-white p-6 shadow-xl shadow-black/20">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-6 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-20 w-20 animate-pulse rounded-lg bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-6 py-16 text-center text-gray-900 shadow-xl shadow-black/20">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-gray-500">Looks like you haven&apos;t added anything yet.</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      {/* Items */}
      <section className="rounded-2xl bg-white p-4 text-gray-900 shadow-xl shadow-black/20 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Shopping cart</h1>
            <p className="text-sm text-gray-500">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-sm font-medium text-red-600 hover:underline"
          >
            Clear cart
          </button>
        </div>

        <ul className="mt-4 divide-y divide-gray-100">
          {rows.map((row) => {
            const { item } = row;
            const dimmed = row.status === "unavailable" || row.status === "soldout";
            const max = Math.min(row.stock ?? item.stock ?? MAX_LINE_QTY, MAX_LINE_QTY);
            const href = `/products/${item.productId}`;

            return (
              <li key={item.key} className="flex gap-3 py-4 sm:gap-4">
                <Link
                  href={href}
                  className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-50 sm:h-24 sm:w-24 ${
                    dimmed ? "opacity-50" : ""
                  }`}
                >
                  {row.image && (
                    <Image
                      src={row.image}
                      alt={row.name}
                      fill
                      sizes="96px"
                      className="object-contain p-2"
                    />
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={href}
                        className="line-clamp-2 text-sm font-semibold text-gray-900 hover:text-brand-600 sm:text-base"
                      >
                        {row.name}
                      </Link>
                      {row.label && <p className="text-xs text-brand-600">{row.label}</p>}
                      <p className="mt-1 text-sm text-gray-600">
                        {money(row.unit)}
                        {row.original !== undefined && (
                          <span className="ml-2 text-xs text-gray-400 line-through">
                            {money(row.original)}
                          </span>
                        )}
                      </p>
                      {row.priceChanged && (
                        <p className="text-xs text-amber-600">Price updated since you added it</p>
                      )}
                    </div>

                    {!dimmed && (
                      <p className="shrink-0 text-sm font-bold sm:text-base">
                        {money(row.unit * item.quantity)}
                      </p>
                    )}
                  </div>

                  {row.status === "unavailable" && (
                    <p role="alert" className="mt-2 text-sm text-red-600">
                      This item is no longer available. Remove it to continue.
                    </p>
                  )}
                  {row.status === "soldout" && (
                    <p role="alert" className="mt-2 text-sm text-red-600">
                      Out of stock. Remove it to continue.
                    </p>
                  )}
                  {row.status === "over" && (
                    <p role="alert" className="mt-2 text-sm text-amber-700">
                      Only {row.stock} left.{" "}
                      <button
                        type="button"
                        onClick={() => setQuantity(item.key, row.stock ?? 1)}
                        className="font-medium underline"
                      >
                        Set quantity to {row.stock}
                      </button>
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-3">
                    {dimmed ? (
                      <span />
                    ) : (
                      <div className="flex items-center overflow-hidden rounded-lg border border-gray-300">
                        <button
                          type="button"
                          onClick={() => setQuantity(item.key, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label={`Decrease quantity of ${row.name}`}
                          className={stepButton}
                        >
                          −
                        </button>
                        <span className="w-10 text-center text-sm font-semibold" aria-live="polite">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(item.key, item.quantity + 1)}
                          disabled={item.quantity >= max}
                          aria-label={`Increase quantity of ${row.name}`}
                          className={stepButton}
                        >
                          +
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.key)}
                      aria-label={`Remove ${row.name} from cart`}
                      className="text-sm font-medium text-gray-500 transition hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <Link
          href="/products"
          className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline"
        >
          &larr; Continue shopping
        </Link>
      </section>

      {/* Summary */}
      <aside className="rounded-2xl bg-white p-4 text-gray-900 shadow-xl shadow-black/20 sm:p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold">Order summary</h2>

        <dl className="mt-4 space-y-2 text-sm" aria-live="polite">
          <div className="flex justify-between">
            <dt className="text-gray-600">Subtotal</dt>
            <dd className="font-medium">{money(subtotal)}</dd>
          </div>
          {savings > 0 && (
            <div className="flex justify-between text-green-700">
              <dt>You save</dt>
              <dd>{money(savings)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-600">Shipping</dt>
            <dd className="font-medium">{shipping === 0 ? "Free" : money(shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>

        {shipping > 0 && counted.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-600">
              Add <strong>{money(round2(FREE_SHIPPING_OVER - subtotal))}</strong> more for free
              shipping.
            </p>
            <div className="mt-1.5 h-1.5 rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-brand-500"
                style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_OVER) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {canCheckout ? (
          <Link
            href="/checkout"
            className="mt-5 block rounded-lg bg-brand-600 px-6 py-3 text-center font-semibold text-white transition hover:bg-brand-700"
          >
            Proceed to checkout
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="mt-5 block w-full cursor-not-allowed rounded-lg bg-gray-300 px-6 py-3 text-center font-semibold text-white"
          >
            Proceed to checkout
          </button>
        )}

        {checking && <p className="mt-2 text-xs text-gray-500">Checking prices and stock...</p>}
        {!checking && blocked && (
          <p className="mt-2 text-xs text-red-600">Fix the items marked above to continue.</p>
        )}
        {failed && (
          <p className="mt-2 text-xs text-gray-500">
            We couldn&apos;t refresh prices. They&apos;ll be checked again when you order.
          </p>
        )}
      </aside>
    </div>
  );
}