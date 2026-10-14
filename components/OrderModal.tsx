"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { OrderStatusBadge, PaymentBadge } from "@/components/OrderBadges";
import { formatDate, formatMoney } from "@/lib/format";
import {
  PAYMENT_STATUSES,
  type Order,
  type OrderStatus,
  type PaymentStatus,
} from "@/types/order";

export type OrderPatch = {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paidAt?: string;
};

type Props = {
  order: Order;
  onClose: () => void;
  onUpdated: (id: string, patch: OrderPatch) => void;
};

// Same rules as the API: which status can follow which
const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

const METHOD_LABELS: Record<Order["paymentMethod"], string> = {
  cod: "Cash on delivery",
  card: "Card",
  wallet: "Wallet",
};

const selectClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base capitalize text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

export default function OrderModal({ order, onClose, onUpdated }: Props) {
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(order.paymentStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const options = NEXT_STATUSES[order.status];
  const statusChanged = nextStatus !== "";
  const paymentChanged = paymentStatus !== order.paymentStatus;
  const dirty = statusChanged || paymentChanged;

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

  const handleSave = async () => {
    if (!dirty) return;

    if (nextStatus === "cancelled") {
      const refundNote =
        order.paymentStatus === "paid"
          ? " This order is already paid, so remember to refund it from your payment dashboard."
          : "";
      const ok = window.confirm(
        `Cancel order ${order.orderNumber}? The stock will be returned to inventory and this cannot be undone.${refundNote}`
      );
      if (!ok) return;
    }

    // Only send what actually changed
    const body: { status?: OrderStatus; paymentStatus?: PaymentStatus } = {};
    if (statusChanged) body.status = nextStatus as OrderStatus;
    if (paymentChanged) body.paymentStatus = paymentStatus;

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch(`/api/orders/${order._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Could not update the order");
        return;
      }

      onUpdated(order._id, {
        status: json.status,
        paymentStatus: json.paymentStatus,
        paidAt: json.paidAt,
      });
      setNextStatus("");
      setPaymentStatus(json.paymentStatus);
      setSaved(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const money = (n: number) => formatMoney(n, order.currency);
  const addr = order.shippingAddress;

  return (
    // Bottom sheet on phones, centred popup from 640px up
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-title"
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-h-[90dvh] sm:rounded-2xl sm:p-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="order-modal-title" className="truncate text-xl font-bold text-gray-900">
              {order.orderNumber}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">{formatDate(order.createdAt)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <OrderStatusBadge status={order.status} />
              <PaymentBadge status={order.paymentStatus} />
            </div>
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

        {/* Customer and shipping */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="rounded-xl bg-gray-50 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Customer
            </h3>
            {order.user ? (
              <>
                <p className="mt-1 font-medium text-gray-900">{order.user.name}</p>
                <p className="break-all text-sm text-gray-600">{order.user.email}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-500">Deleted user</p>
            )}
          </section>

          <section className="rounded-xl bg-gray-50 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Ship to
            </h3>
            <p className="mt-1 font-medium text-gray-900">{addr.fullName}</p>
            <p className="text-sm text-gray-600">{addr.phone}</p>
            <p className="text-sm text-gray-600">
              {addr.street}, {addr.city}
              {addr.postalCode ? ` ${addr.postalCode}` : ""}, {addr.country}
            </p>
          </section>
        </div>

        {/* Items */}
        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Items ({order.items.reduce((sum, i) => sum + i.quantity, 0)})
          </h3>
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl ring-1 ring-gray-200">
            {order.items.map((item, i) => (
              <li key={item.product?._id ?? i} className="flex items-center gap-3 p-3">
                {item.product?.image?.url ? (
                  <Image
                    src={item.product.image.url}
                    alt={item.product.name}
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {item.product?.name ?? "Deleted product"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.product ? `${money(item.product.price)} × ${item.quantity}` : `Qty ${item.quantity}`}
                  </p>
                </div>
                {item.product && (
                  <p className="shrink-0 text-sm font-medium text-gray-900">
                    {money(item.product.price * item.quantity)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Totals and payment */}
        <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-gray-50 p-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Summary
            </h3>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between">
                <dt className="text-gray-600">Items</dt>
                <dd className="text-gray-900">{money(order.itemsPrice)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Shipping</dt>
                <dd className="text-gray-900">
                  {order.shippingPrice === 0 ? "Free" : money(order.shippingPrice)}
                </dd>
              </div>
              {order.taxPrice > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">Tax</dt>
                  <dd className="text-gray-900">{money(order.taxPrice)}</dd>
                </div>
              )}
              {order.discountAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">
                    Discount{order.discountCode ? ` (${order.discountCode})` : ""}
                  </dt>
                  <dd className="text-green-700">−{money(order.discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold">
                <dt className="text-gray-900">Total</dt>
                <dd className="text-gray-900">{money(order.totalPrice)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl bg-gray-50 p-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Payment
            </h3>
            <p className="mt-2 text-gray-900">{METHOD_LABELS[order.paymentMethod]}</p>
            <div className="mt-1">
              <PaymentBadge status={order.paymentStatus} />
            </div>
            {order.paidAt && (
              <p className="mt-2 text-xs text-gray-500">Paid on {formatDate(order.paidAt)}</p>
            )}
          </div>
        </section>

        {/* Update */}
        <section className="mt-5 rounded-xl border border-gray-200 p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-gray-900">Update order</h3>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="order-status" className={labelClass}>
                Move to status
              </label>
              {options.length > 0 ? (
                <select
                  id="order-status"
                  value={nextStatus}
                  onChange={(e) => {
                    setNextStatus(e.target.value as OrderStatus | "");
                    setSaved(false);
                  }}
                  className={selectClass}
                >
                  <option value="">Keep as {order.status}</option>
                  {options.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  This order is {order.status}, so its status can&apos;t change any more.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="payment-status" className={labelClass}>
                Payment status
              </label>
              <select
                id="payment-status"
                value={paymentStatus}
                onChange={(e) => {
                  setPaymentStatus(e.target.value as PaymentStatus);
                  setSaved(false);
                }}
                className={selectClass}
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {saved && !error && (
            <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              Order updated.
            </p>
          )}

          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}