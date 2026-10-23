"use client";
import Image from "next/image";
import Link from "next/link";
import {
  MAX_LINE_QTY,
  clearCart,
  refreshCart,
  removeFromCart,
  setCartQuantity,
  useCart,
} from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { FREE_SHIPPING_OVER } from "@/lib/shipping";
import { CURRENCY } from "@/lib/store";

const money = (n: number) => formatMoney(n, CURRENCY);

const stepButton =
  "flex h-9 w-9 items-center justify-center text-lg text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300";

export default function CartView() {
  const { loaded, failed, busy, cart } = useCart();
  const { lines } = cart;

  if (!loaded) {
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

  if (failed && lines.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-6 py-16 text-center text-gray-900 shadow-xl shadow-black/20">
        <h1 className="text-2xl font-bold">We couldn&apos;t load your cart</h1>
        <p className="mt-2 text-gray-500">Please check your connection and try again.</p>
        <button
          type="button"
          onClick={() => refreshCart()}
          className="mt-6 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (lines.length === 0) {
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

  const working = busy > 0;
  const canCheckout = !cart.hasProblem && !working;

  const handleClear = () => {
    if (window.confirm("Remove everything from your cart?")) clearCart();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      {/* Items */}
      <section className="rounded-2xl bg-white p-4 text-gray-900 shadow-xl shadow-black/20 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Shopping cart</h1>
            <p className="text-sm text-gray-500">
              {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={working}
            className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
          >
            Clear cart
          </button>
        </div>

        <ul className="mt-4 divide-y divide-gray-100">
          {lines.map((line) => {
            const dimmed = line.problem === "unavailable" || line.problem === "soldout";
            const max = Math.min(line.stock, MAX_LINE_QTY);
            const href = `/products/${line.productId}`;

            return (
              <li key={line.key} className="flex gap-3 py-4 sm:gap-4">
                <Link
                  href={href}
                  className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white sm:h-24 sm:w-24 ${
                    dimmed ? "opacity-50" : ""
                  }`}
                >
                  {line.image && (
                    <Image
                      src={line.image}
                      alt={line.name}
                      fill
                      sizes="96px"
                      className="object-contain p-1"
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
                        {line.name}
                      </Link>
                      {line.label && <p className="text-xs text-brand-600">{line.label}</p>}
                      {!dimmed && (
                        <p className="mt-1 text-sm text-gray-600">
                          {money(line.unit)}
                          {line.original !== undefined && (
                            <span className="ml-2 text-xs text-gray-400 line-through">
                              {money(line.original)}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {!dimmed && (
                      <p className="shrink-0 text-sm font-bold sm:text-base">
                        {money(line.unit * line.quantity)}
                      </p>
                    )}
                  </div>

                  {line.problem === "unavailable" && (
                    <p role="alert" className="mt-2 text-sm text-red-600">
                      This item is no longer available. Remove it to continue.
                    </p>
                  )}
                  {line.problem === "soldout" && (
                    <p role="alert" className="mt-2 text-sm text-red-600">
                      Out of stock. Remove it to continue.
                    </p>
                  )}
                  {line.problem === "over" && (
                    <p role="alert" className="mt-2 text-sm text-amber-700">
                      Only {line.stock} left.{" "}
                      <button
                        type="button"
                        onClick={() => setCartQuantity(line.key, line.stock)}
                        disabled={working}
                        className="font-medium underline"
                      >
                        Set quantity to {line.stock}
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
                          onClick={() => setCartQuantity(line.key, line.quantity - 1)}
                          disabled={working || line.quantity <= 1}
                          aria-label={`Decrease quantity of ${line.name}`}
                          className={stepButton}
                        >
                          −
                        </button>
                        <span className="w-10 text-center text-sm font-semibold" aria-live="polite">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCartQuantity(line.key, line.quantity + 1)}
                          disabled={working || line.quantity >= max}
                          aria-label={`Increase quantity of ${line.name}`}
                          className={stepButton}
                        >
                          +
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => removeFromCart(line.key)}
                      disabled={working}
                      aria-label={`Remove ${line.name} from cart`}
                      className="text-sm font-medium text-gray-500 transition hover:text-red-600 disabled:opacity-50"
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
            <dd className="font-medium">{money(cart.subtotal)}</dd>
          </div>
          {cart.savings > 0 && (
            <div className="flex justify-between text-green-700">
              <dt>You save</dt>
              <dd>{money(cart.savings)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-600">Shipping</dt>
            <dd className="font-medium">{cart.shipping === 0 ? "Free" : money(cart.shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd>{money(cart.total)}</dd>
          </div>
        </dl>

        {cart.shipping > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-600">
              Add <strong>{money(Math.max(0, FREE_SHIPPING_OVER - cart.subtotal))}</strong> more for
              free shipping.
            </p>
            <div className="mt-1.5 h-1.5 rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-brand-500"
                style={{ width: `${Math.min(100, (cart.subtotal / FREE_SHIPPING_OVER) * 100)}%` }}
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

        {cart.hasProblem && (
          <p className="mt-2 text-xs text-red-600">Fix the items marked above to continue.</p>
        )}
      </aside>
    </div>
  );
}