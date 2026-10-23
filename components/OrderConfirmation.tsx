"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import type { Order } from "@/types/order";
import ShippingInfo from "@/components/ShippingInfo";
type State = "loading" | "ready" | "guest" | "missing" | "error";

const MAX_CHECKS = 12; // about 30 seconds of waiting for Paymob's confirmation
const card = "rounded-2xl bg-white p-4 text-gray-900 shadow-xl shadow-black/20 sm:p-6";

export default function OrderConfirmation({ orderId }: { orderId: string }) {
  const [state, setState] = useState<State>("loading");
  const [order, setOrder] = useState<Order | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let checks = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (cancelled) return;
        if (res.status === 401) return setState("guest");
        if (res.status === 404 || res.status === 400) return setState("missing");
        if (!res.ok) throw new Error("Failed");

        const data: Order = await res.json();
        if (cancelled) return;
        setOrder(data);
        setState("ready");

        // Online order still waiting for Paymob's confirmation: check again shortly
        const waiting =
          data.paymentMethod !== "cod" && data.paymentStatus === "pending" && data.status === "pending";
        checks++;
        if (waiting && checks < MAX_CHECKS) timer = setTimeout(load, 2500);
        else if (waiting) setGaveUp(true);
      } catch {
        if (!cancelled) setState("error");
      }
    };

        // Back from Stripe: ask the server to confirm the payment before showing the result
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    (async () => {
      if (sessionId) {
        try {
          await fetch(`/api/orders/${orderId}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
        } catch {
          // the page still loads. The webhook may confirm it a moment later
        }
      }
      if (!cancelled) load();
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  const retryPayment = async () => {
    setRetrying(true);
    setRetryError("");
    try {
      const res = await fetch(`/api/orders/${orderId}/pay`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setRetryError(json.error || "We couldn't start the payment.");
        setRetrying(false);
        return;
      }
      window.location.href = json.checkoutUrl;
    } catch {
      setRetryError("Network error. Please try again.");
      setRetrying(false);
    }
  };

  if (state === "loading") {
    return <p className="text-slate-300">Loading your order...</p>;
  }

  if (state === "guest") {
    return (
      <div className={`${card} mx-auto max-w-md py-10 text-center`}>
        <h1 className="text-xl font-bold">Log in to see your order</h1>
        <Link
          href={`/login?next=/orders/${orderId}/confirmation`}
          className="mt-5 inline-block rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (state === "missing" || state === "error" || !order) {
    return (
      <div className={`${card} mx-auto max-w-md py-10 text-center`}>
        <h1 className="text-xl font-bold">
          {state === "error" ? "Something went wrong" : "Order not found"}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {state === "error" ? "Please refresh the page." : "We couldn't find that order."}
        </p>
        <Link
          href="/products"
          className="mt-5 inline-block rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  const money = (n: number) => formatMoney(n, order.currency);
  const isCod = order.paymentMethod === "cod";
  const cancelled = order.status === "cancelled";
  const unpaid = !isCod && order.paymentStatus !== "paid" && !cancelled;
  const failed = unpaid && order.paymentStatus === "failed";
  const canRetry = unpaid && order.status === "pending";
  const addr = order.shippingAddress;

  let tone = "bg-green-50 text-green-800";
  let title = "Thank you! Your order is confirmed";
  let text = `We'll collect ${money(order.totalPrice)} when your order arrives.`;

  if (isCod && order.status === "shipped") {
    title = "Your order is confirmed and on its way";
  } else if (isCod && order.status === "delivered") {
    title = "Your order was delivered";
    text = "Thank you for shopping with us!";
  }
  if (cancelled) {
    tone = "bg-gray-100 text-gray-800";
    title = "This order was cancelled";
    text = isCod
      ? "No payment was taken."
      : order.paymentStatus === "paid"
        ? "Your payment was received. We'll refund it to you."
        : "No payment was taken.";
  } else if (!isCod && order.paymentStatus === "paid") {
    title = "Payment successful";
    text = "Thank you! Your order is confirmed and we're getting it ready.";
  } else if (failed) {
    tone = "bg-red-50 text-red-800";
    title = "Your payment didn't go through";
    text = "Nothing was charged. You can try again.";
  } else if (unpaid && !gaveUp) {
    tone = "bg-blue-50 text-blue-800";
    title = "Confirming your payment...";
    text = "This usually takes a few seconds. Please keep this page open.";
  } else if (unpaid) {
    tone = "bg-amber-50 text-amber-900";
    title = "We haven't received your payment confirmation yet";
    text =
      "If you already paid, please don't pay again. It can take a few minutes to arrive. If you didn't pay, you can try again.";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className={`rounded-2xl p-5 sm:p-6 ${tone}`} aria-live="polite">
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        <p className="mt-1 text-sm">{text}</p>
        <p className="mt-3 text-sm">
          Order <strong>{order.orderNumber}</strong> · {formatDate(order.createdAt)}
        </p>

        {canRetry && (
          <div className="mt-4">
            <button
              type="button"
              onClick={retryPayment}
              disabled={retrying}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {retrying ? "Please wait..." : "Pay now"}
            </button>
            {retryError && (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {retryError}
              </p>
            )}
          </div>
        )}
      </section>
<ShippingInfo shipment={order.shipment} />
      <section className={card}>
        <h2 className="font-semibold">Order details</h2>

        <ul className="mt-3 divide-y divide-gray-100">
          {order.items.map((item, i) => (
            <li key={`${item.product?._id ?? "x"}-${item.variantId ?? i}`} className="flex gap-3 py-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                {item.product?.image?.url && (
                  <Image
                    src={item.product.image.url}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-contain p-1"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-gray-900">
                  {item.product?.name ?? "Removed product"}
                </p>
                {item.variantLabel && <p className="text-xs text-brand-600">{item.variantLabel}</p>}
                <p className="text-xs text-gray-500">Qty {item.quantity}</p>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-3 space-y-2 border-t border-gray-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Items</dt>
            <dd>{money(order.itemsPrice)}</dd>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-green-700">
              <dt>Discount</dt>
              <dd>−{money(order.discountAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-600">Shipping</dt>
            <dd>{order.shippingPrice === 0 ? "Free" : money(order.shippingPrice)}</dd>
          </div>
          {order.taxPrice > 0 && (
            <div className="flex justify-between">
              <dt className="text-gray-600">Tax</dt>
              <dd>{money(order.taxPrice)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd>{money(order.totalPrice)}</dd>
          </div>
        </dl>

        <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ship to</p>
          <p className="mt-1 font-medium text-gray-900">{addr.fullName}</p>
          <p className="text-gray-600">{addr.phone}</p>
          <p className="text-gray-600">
            {addr.street}, {addr.city}
            {addr.postalCode ? ` ${addr.postalCode}` : ""}, {addr.country}
          </p>
        </div>
      </section>

      <Link href="/products" className="inline-block text-sm font-medium text-brand-400 hover:text-white">
        &larr; Continue shopping
      </Link>
    </div>
  );
}