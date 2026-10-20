"use client";
import { useState, type ReactNode } from "react";
import { formatMoney } from "@/lib/format";
import type { OrderPatch } from "@/components/OrderModal";
import type { Order, OrderStatus } from "@/types/order";

type Props = {
  order: Order;
  onUpdated: (id: string, patch: OrderPatch) => void;
  align?: "start" | "end";
};

type Result = { ok: true; patch: OrderPatch } | { ok: false; error: string };

async function changeStatus(id: string, status: OrderStatus): Promise<Result> {
  try {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "Could not update the order" };

    return {
      ok: true,
      patch: {
        status: json.status,
        paymentStatus: json.paymentStatus,
        paidAt: json.paidAt,
        shipment: json.shipment ?? null,
      },
    };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

const primary =
  "rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

export default function OrderActions({ order, onUpdated, align = "start" }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const isCod = order.paymentMethod === "cod";
  // An online order that hasn't been paid yet must not be confirmed or shipped
  const awaitingPayment = !isCod && order.paymentStatus !== "paid";

  // Runs the steps one after another. "Confirm & ship" is two steps.
  const run = async (label: string, steps: OrderStatus[], confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;

    setBusy(label);
    setError("");

    let last: OrderPatch | null = null;
    for (const step of steps) {
      const result = await changeStatus(order._id, step);
      if (!result.ok) {
        setError(result.error);
        break;
      }
      last = result.patch;
    }

    if (last) onUpdated(order._id, last);
    setBusy(null);
  };

  const label = (key: string, text: string) => (busy === key ? "Working..." : text);

  let buttons: ReactNode = null;

  if (order.status === "pending" || order.status === "confirmed") {
    if (awaitingPayment) {
      buttons = <span className="text-xs font-medium text-amber-700">Awaiting payment</span>;
    } else if (order.status === "pending") {
      buttons = (
        <>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("ship", ["confirmed", "shipped"])}
            className={primary}
          >
            {label("ship", "Confirm & ship")}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("confirm", ["confirmed"])}
            className={secondary}
          >
            {label("confirm", "Confirm")}
          </button>
        </>
      );
    } else {
      buttons = (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("ship", ["shipped"])}
          className={primary}
        >
          {label("ship", order.shipment?.lastError ? "Retry shipping" : "Start shipping")}
        </button>
      );
    }
  } else if (order.status === "shipped") {
    const note = isCod
      ? ` The ${formatMoney(order.totalPrice, order.currency)} payment will be recorded as received.`
      : "";
    buttons = (
      <>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run("deliver", ["delivered"], `Mark ${order.orderNumber} as delivered?${note}`)
          }
          className={primary}
        >
          {label("deliver", "Mark delivered")}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run(
              "return",
              ["cancelled"],
              `Mark ${order.orderNumber} as returned? The stock goes back to your inventory. This also cancels the order, and it cannot be undone.`
            )
          }
          className={secondary}
        >
          {label("return", "Parcel returned")}
        </button>
      </>
    );
  }

  if (!buttons) return null;

  return (
    <div className={`flex flex-col gap-1 ${align === "end" ? "items-end" : "items-start"}`}>
      <div className="flex flex-wrap gap-2">{buttons}</div>
      {error && (
        <p role="alert" className="max-w-[16rem] whitespace-normal text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}