"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrderStatusBadge, PaymentBadge } from "@/components/OrderBadges";
import { formatDate, formatMoney } from "@/lib/format";
import { CURRENCY } from "@/lib/store";
import { ORDER_STATUSES, type OrderStatus, type PaymentStatus } from "@/types/order";

type Stats = {
  totalSales: number;
  totalOrders: number;
  customers: number;
  products: number;
  daily: { date: string; sales: number; orders: number }[];
  byStatus: Record<OrderStatus, number>;
  recentOrders: {
    _id: string;
    orderNumber: string;
    user: { name: string } | null;
    totalPrice: number;
    currency: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    createdAt: string;
  }[];
  lowStock: { _id: string; name: string; stock: number; image?: { url: string } }[];
  lowStockLimit: number;
};

type State = "loading" | "ready" | "denied" | "error";

const STATUS_BAR: Record<OrderStatus, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-blue-500",
  shipped: "bg-indigo-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-400",
};

// "2026-10-16" -> "Fri" (noon avoids time zone shifts)
const weekday = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (res.status === 403) {
          if (!cancelled) setState("denied");
          return;
        }
        if (!res.ok) throw new Error("Failed to load");
        const data: Stats = await res.json();
        if (!cancelled) {
          setStats(data);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "loading") return <p className="p-6 text-gray-500 sm:p-8">Loading dashboard...</p>;

  if (state === "denied") {
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

  if (state === "error" || !stats) {
    return <p className="p-6 text-red-600 sm:p-8">Something went wrong. Please refresh the page.</p>;
  }

  const maxSales = Math.max(...stats.daily.map((d) => d.sales), 1);
  const weekSales = stats.daily.reduce((sum, d) => sum + d.sales, 0);

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Dashboard</h1>
      <p className="text-sm text-gray-500">A quick look at how your store is doing</p>

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total sales"
          value={formatMoney(stats.totalSales, CURRENCY)}
          hint="Excluding cancelled orders"
        />
        <StatCard label="Total orders" value={String(stats.totalOrders)} />
        <StatCard label="Customers" value={String(stats.customers)} />
        <StatCard label="Products" value={String(stats.products)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Sales chart */}
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 lg:col-span-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold text-gray-900">Sales, last 7 days</h2>
            <p className="text-sm text-gray-500">{formatMoney(weekSales, CURRENCY)}</p>
          </div>

          <div className="mt-4 flex gap-2">
            {stats.daily.map((d) => {
              const pct = d.sales > 0 ? Math.max(4, (d.sales / maxSales) * 100) : 2;
              return (
                <div
                  key={d.date}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${formatMoney(d.sales, CURRENCY)} · ${d.orders} ${d.orders === 1 ? "order" : "orders"}`}
                >
                  <div className="flex h-36 w-full items-end">
                    <div
                      className={`w-full rounded-t-md ${d.sales > 0 ? "bg-brand-500" : "bg-gray-200"}`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{weekday(d.date)}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Orders by status */}
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <h2 className="font-semibold text-gray-900">Orders by status</h2>
          <ul className="mt-4 space-y-3">
            {ORDER_STATUSES.map((s) => {
              const count = stats.byStatus[s] ?? 0;
              const pct = stats.totalOrders > 0 ? (count / stats.totalOrders) * 100 : 0;
              return (
                <li key={s}>
                  <div className="flex justify-between text-sm">
                    <span className="capitalize text-gray-700">{s}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div className={`h-2 rounded-full ${STATUS_BAR[s]}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Recent orders */}
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm font-medium text-blue-600 hover:underline">
              View all
            </Link>
          </div>

          {stats.recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No orders yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {stats.recentOrders.map((o) => (
                <li key={o._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{o.orderNumber}</p>
                    <p className="truncate text-xs text-gray-500">
                      {o.user?.name ?? "Deleted user"} · {formatDate(o.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <OrderStatusBadge status={o.status} />
                    <PaymentBadge status={o.paymentStatus} />
                    <span className="text-sm font-semibold text-gray-900">
                      {formatMoney(o.totalPrice, o.currency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Low stock */}
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Low stock</h2>
            <Link href="/admin/products" className="text-sm font-medium text-blue-600 hover:underline">
              Products
            </Link>
          </div>

          {stats.lowStock.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              Everything has more than {stats.lowStockLimit} in stock.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {stats.lowStock.map((p) => (
                <li key={p._id} className="flex items-center gap-3">
                  {p.image?.url ? (
                    <Image
                      src={p.image.url}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-100" />
                  )}
                  <p className="min-w-0 flex-1 truncate text-sm text-gray-900">{p.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.stock === 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {p.stock === 0 ? "Out" : `${p.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}