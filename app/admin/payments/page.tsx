"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrderStatusBadge, PaymentBadge } from "@/components/OrderBadges";
import { formatDate, formatMoney } from "@/lib/format";
import { CURRENCY } from "@/lib/store";
import {
  PAYMENT_STATUSES,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/types/order";

type Row = {
  _id: string;
  orderNumber: string;
  user: { name: string; email: string } | null;
  totalPrice: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAt?: string;
  status: OrderStatus;
  createdAt: string;
};

type Bucket = { amount: number; count: number };

type Response = {
  orders: Row[];
  total: number;
  page: number;
  pages: number;
  summary: Record<PaymentStatus, Bucket>;
  paidByMethod: Record<PaymentMethod, number>;
  needsRefund: number;
};

type Access = "checking" | "allowed" | "denied";
type Filter = PaymentStatus | "all";

const PAGE_SIZE = 10;

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on delivery",
  card: "Card",
  wallet: "Wallet",
};

const TABS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  ...PAYMENT_STATUSES.map((s) => ({
    value: s as Filter,
    label: s.charAt(0).toUpperCase() + s.slice(1),
  })),
];

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900 sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function NeedsRefund({ row }: { row: Row }) {
  if (row.status !== "cancelled" || row.paymentStatus !== "paid") return null;
  return (
    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      Needs refund
    </span>
  );
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [access, setAccess] = useState<Access>("checking");
  const [data, setData] = useState<Response | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>("all");
  const [method, setMethod] = useState<PaymentMethod | "all">("all");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (filter !== "all") params.set("paymentStatus", filter);
    if (method !== "all") params.set("method", method);

    (async () => {
      try {
        const res = await fetch(`/api/admin/payments?${params.toString()}`);
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (res.status === 403) {
          if (!cancelled) setAccess("denied");
          return;
        }
        if (!res.ok) throw new Error("Failed to load");

        const json: Response = await res.json();
        if (cancelled) return;
        setData(json);
        setAccess("allowed");
      } catch {
        if (!cancelled) setLoadError("Could not load payments. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, filter, method, reload, router]);

  const changeFilter = (value: Filter) => {
    if (value === filter) return;
    setFilter(value);
    setPage(1);
    setLoadError("");
    setLoading(true);
  };

  const changeMethod = (value: PaymentMethod | "all") => {
    setMethod(value);
    setPage(1);
    setLoadError("");
    setLoading(true);
  };

  const changePage = (next: number) => {
    if (!data || next < 1 || next > data.pages || next === page) return;
    setPage(next);
    setLoadError("");
    setLoading(true);
  };

  const updatePayment = async (row: Row, next: PaymentStatus) => {
    if (next === "refunded") {
      const ok = window.confirm(
        `Mark ${row.orderNumber} as refunded? This only updates your records. Send the money back through your payment provider or in cash yourself.`
      );
      if (!ok) return;
    }

    setActionError("");
    setBusyId(row._id);
    try {
      const res = await fetch(`/api/orders/${row._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || "Could not update the payment");
        return;
      }
      setReload((n) => n + 1); // totals change too, so reload everything
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  if (access === "checking" && loading) return <p className="p-6 text-gray-500 sm:p-8">Loading...</p>;

  if (access === "denied") {
    return (
      <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Access denied</h1>
        <p className="text-gray-500">You need an admin account to view this page.</p>
        <Link href="/" className="font-medium text-blue-600 hover:underline">
          Back to home
        </Link>
      </main>
    );
  }

  const summary = data?.summary;
  const rows = data?.orders ?? [];
  const money = (n: number, currency = CURRENCY) => formatMoney(n, currency);

  const actionButton = (row: Row) => {
    const busy = busyId === row._id;
    if (row.paymentStatus === "pending" || row.paymentStatus === "failed") {
      return (
        <button
          onClick={() => updatePayment(row, "paid")}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-50 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Mark as paid"}
        </button>
      );
    }
    if (row.paymentStatus === "paid") {
      return (
        <button
          onClick={() => updatePayment(row, "refunded")}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-purple-700 transition hover:bg-purple-50 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Mark refunded"}
        </button>
      );
    }
    return null;
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Payments</h1>
      <p className="text-sm text-gray-500">Track what has been paid, what is still owed, and refunds</p>

      {/* Summary */}
      {summary && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="Collected"
              value={money(summary.paid.amount)}
              hint={`${summary.paid.count} paid ${summary.paid.count === 1 ? "order" : "orders"}`}
            />
            <StatCard
              label="Waiting for payment"
              value={money(summary.pending.amount)}
              hint={`${summary.pending.count} ${summary.pending.count === 1 ? "order" : "orders"}`}
            />
            <StatCard
              label="Refunded"
              value={money(summary.refunded.amount)}
              hint={`${summary.refunded.count} ${summary.refunded.count === 1 ? "order" : "orders"}`}
            />
            <StatCard
              label="Failed"
              value={String(summary.failed.count)}
              hint={money(summary.failed.amount)}
            />
          </div>

          <p className="mt-3 text-sm text-gray-500">
            Collected by method:{" "}
            {(Object.keys(METHOD_LABELS) as PaymentMethod[])
              .map((m) => `${METHOD_LABELS[m]} ${money(data!.paidByMethod[m])}`)
              .join(" · ")}
          </p>

          {data!.needsRefund > 0 && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {data!.needsRefund} cancelled {data!.needsRefund === 1 ? "order was" : "orders were"}{" "}
              already paid and still {data!.needsRefund === 1 ? "needs" : "need"} a refund.
            </p>
          )}
        </>
      )}

      {/* Filters */}
      <div className="-mx-3 mt-5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Filter by payment status" className="flex gap-2 whitespace-nowrap">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={filter === tab.value}
              onClick={() => changeFilter(tab.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === tab.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <select
          value={method}
          onChange={(e) => changeMethod(e.target.value as PaymentMethod | "all")}
          aria-label="Filter by payment method"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:w-auto sm:text-sm"
        >
          <option value="all">All payment methods</option>
          {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>
              {METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {(loadError || actionError) && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {loadError || actionError}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-gray-500">Loading payments...</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-xl bg-white px-4 py-10 text-center text-gray-500 shadow-sm ring-1 ring-gray-200">
          No payments found.
        </p>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="mt-4 space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r._id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{r.orderNumber}</p>
                    <p className="truncate text-xs text-gray-500">
                      {r.user?.name ?? "Deleted user"} · {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-gray-900">{money(r.totalPrice, r.currency)}</p>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-600">{METHOD_LABELS[r.paymentMethod]}</span>
                  <PaymentBadge status={r.paymentStatus} />
                  <OrderStatusBadge status={r.status} />
                  <NeedsRefund row={r} />
                </div>

                <div className="mt-2">{actionButton(r)}</div>
              </li>
            ))}
          </ul>

          {/* Tablet and desktop: table */}
          <div className="mt-4 hidden overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200 md:block">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Paid on</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-medium text-gray-900">{r.orderNumber}</p>
                      <p className="text-xs text-gray-500">{formatDate(r.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[12rem] truncate text-gray-900">{r.user?.name ?? "Deleted user"}</p>
                      {r.user && (
                        <p className="max-w-[12rem] truncate text-xs text-gray-500">{r.user.email}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {METHOD_LABELS[r.paymentMethod]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                      {money(r.totalPrice, r.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PaymentBadge status={r.paymentStatus} />
                        <NeedsRefund row={r} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {r.paidAt ? formatDate(r.paidAt) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{actionButton(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {!loading && data && data.total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            {data.total} {data.total === 1 ? "order" : "orders"} · Page {page} of {data.pages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => changePage(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => changePage(page + 1)}
              disabled={page >= data.pages}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </main>
  );
}