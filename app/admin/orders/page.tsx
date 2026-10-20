"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OrderActions from "@/components/OrderActions";
import OrderModal, { type OrderPatch } from "@/components/OrderModal";
import { OrderStatusBadge, PaymentBadge } from "@/components/OrderBadges";
import { formatDate, formatMoney } from "@/lib/format";
import {
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
  type OrdersResponse,
} from "@/types/order";

type Access = "checking" | "allowed" | "denied";
type Filter = OrderStatus | "all";

type Me = { id: string; name: string; email: string; role: "user" | "admin" };

const PAGE_SIZE = 10;

const TABS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  ...ORDER_STATUSES.map((s) => ({
    value: s as Filter,
    label: s.charAt(0).toUpperCase() + s.slice(1),
  })),
];

export default function AdminOrdersPage() {
  const router = useRouter();
  const [access, setAccess] = useState<Access>("checking");
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 1. Check the user is an admin
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const me: Me = await res.json();
        if (!cancelled) setAccess(me.role === "admin" ? "allowed" : "denied");
      } catch {
        if (!cancelled) setAccess("denied");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // 2. Load orders whenever the page or status tab changes
  useEffect(() => {
    if (access !== "allowed") return;
    let cancelled = false;

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (filter !== "all") params.set("status", filter);

    (async () => {
      try {
        const res = await fetch(`/api/orders?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load orders");
        const data: OrdersResponse = await res.json();
        if (cancelled) return;
        setOrders(data.orders);
        setTotal(data.total);
        setPages(Math.max(1, data.pages));
      } catch {
        if (!cancelled) setLoadError("Could not load orders. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [access, page, filter]);

  const changeFilter = (value: Filter) => {
    if (value === filter) return;
    setFilter(value);
    setPage(1);
    setLoadError("");
    setLoading(true);
  };

  const changePage = (next: number) => {
    if (next < 1 || next > pages || next === page) return;
    setPage(next);
    setLoadError("");
    setLoading(true);
  };

  // Search runs on the orders of the current page
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.user?.name.toLowerCase().includes(q) ||
        o.user?.email.toLowerCase().includes(q) ||
        o.shippingAddress.fullName.toLowerCase().includes(q)
    );
  }, [orders, search]);

  const selected = orders.find((o) => o._id === selectedId) ?? null;

  // The API returns the updated order without customer and product details,
  // so only the changed fields are merged into the order we already have
  const handleUpdated = (id: string, patch: OrderPatch) => {
    setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, ...patch } : o)));
  };

  if (access === "checking") {
    return <p className="p-6 text-gray-500 sm:p-8">Loading...</p>;
  }

  if (access === "denied") {
    return (
      <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Access denied</h1>
        <p className="text-gray-500">You need an admin account to view this page.</p>
        <Link href="/" className="font-medium text-blue-600 hover:underline">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Orders</h1>
        <p className="text-sm text-gray-500">Confirm, ship and track your orders</p>
      </div>

      {/* Status tabs */}
      <div className="-mx-3 mt-5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Filter by status" className="flex gap-2 whitespace-nowrap">
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

      {/* Search */}
      <div className="mt-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order number, name or email..."
          aria-label="Search orders"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:max-w-sm sm:text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">Searches the orders on this page.</p>
      </div>

      {loadError && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {loadError}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-gray-500">Loading orders...</p>
      ) : visible.length === 0 ? (
        <p className="mt-4 rounded-xl bg-white px-4 py-10 text-center text-gray-500 shadow-sm ring-1 ring-gray-200">
          No orders found.
        </p>
      ) : (
        <>
          {/* Mobile: cards (hidden from 768px up) */}
          <ul className="mt-4 space-y-3 md:hidden">
            {visible.map((o) => (
              <li key={o._id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{o.orderNumber}</p>
                    <p className="text-xs text-gray-500">{formatDate(o.createdAt)}</p>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>

                <p className="mt-2 truncate text-sm text-gray-700">
                  {o.user?.name ?? "Deleted user"}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900">
                    {formatMoney(o.totalPrice, o.currency)}
                  </p>
                  <PaymentBadge status={o.paymentStatus} />
                </div>

                <div className="mt-3">
                  <OrderActions order={o} onUpdated={handleUpdated} />
                </div>

                <button
                  onClick={() => setSelectedId(o._id)}
                  className="mt-3 w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  View details
                </button>
              </li>
            ))}
          </ul>

          {/* Tablet and desktop: table (shown from 768px up) */}
          <div className="mt-4 hidden overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200 md:block">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((o) => (
                  <tr key={o._id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                      {o.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[12rem] truncate text-gray-900">
                        {o.user?.name ?? "Deleted user"}
                      </p>
                      {o.user && (
                        <p className="max-w-[12rem] truncate text-xs text-gray-500">
                          {o.user.email}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {formatDate(o.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {o.items.reduce((sum, i) => sum + i.quantity, 0)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                      {formatMoney(o.totalPrice, o.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentBadge status={o.paymentStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <OrderActions order={o} onUpdated={handleUpdated} align="end" />
                        <button
                          onClick={() => setSelectedId(o._id)}
                          className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            {total} {total === 1 ? "order" : "orders"} · Page {page} of {pages}
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
              disabled={page >= pages}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Details popup */}
      {selected && (
        <OrderModal
          key={selected._id}
          order={selected}
          onClose={() => setSelectedId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </main>
  );
}