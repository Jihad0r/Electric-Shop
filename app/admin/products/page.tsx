"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddProductModal from "@/components/AddProductModal";
import { CATEGORIES, type Category, type Product } from "@/types/product";

type Me = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
};

type Status = "loading" | "ready" | "denied" | "error";

const LOW_STOCK = 5;
const CURRENCY = "EGP"; // change to match your prices

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY });

const fieldClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm";

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        Out of stock
      </span>
    );
  }
  if (stock <= LOW_STOCK) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        {stock} left
      </span>
    );
  }
  return <span className="text-gray-900">{stock} in stock</span>;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
      }`}
    >
      {active ? "Active" : "Hidden"}
    </span>
  );
}

function Thumb({ product }: { product: Product }) {
  return product.image?.url ? (
    <Image
      src={product.image.url}
      alt={product.name}
      width={56}
      height={56}
      className="h-14 w-14 shrink-0 rounded-lg object-cover"
    />
  ) : (
    <div className="h-14 w-14 shrink-0 rounded-lg bg-gray-100" />
  );
}

export default function AdminProductsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.status === 401) {
          router.replace("/login");
          return;
        }
        const me: Me = await meRes.json();
        if (me.role !== "admin") {
          if (!cancelled) setStatus("denied");
          return;
        }

        const res = await fetch("/api/products");
        if (!res.ok) throw new Error("Failed to load products");
        const data: Product[] = await res.json();

        if (!cancelled) {
          setProducts(data);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, search, category]);

  const outOfStock = products.filter((p) => p.stock === 0).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length;

  const handleCreated = (product: Product) => {
    setProducts((prev) => [product, ...prev]);
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    setActionError("");
    setDeletingId(product._id);

    try {
      const res = await fetch(`/api/products/${product._id}`, { method: "DELETE" });
      const data: { error?: string } = await res.json();

      if (!res.ok) {
        setActionError(data.error || "Could not delete the product");
        return;
      }
      setProducts((prev) => prev.filter((p) => p._id !== product._id));
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading") {
    return <p className="p-6 text-gray-500 sm:p-8">Loading products...</p>;
  }

  if (status === "denied") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Access denied</h1>
        <p className="text-gray-500">You need an admin account to view this page.</p>
        <Link href="/" className="font-medium text-blue-600 hover:underline">
          Back to home
        </Link>
      </main>
    );
  }

  if (status === "error") {
    return (
      <p className="p-6 text-red-600 sm:p-8">
        Something went wrong while loading products. Please refresh the page.
      </p>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Products</h1>
          <p className="text-sm text-gray-500">Manage your store&apos;s catalogue</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
        >
          + Add product
        </button>
      </div>

      {/* Summary */}
      <div className="mt-5 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-4">
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200 sm:p-4">
          <p className="text-xs text-gray-500 sm:text-sm">Total</p>
          <p className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">{products.length}</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200 sm:p-4">
          <p className="text-xs text-gray-500 sm:text-sm">
            Low stock<span className="hidden sm:inline"> (≤ {LOW_STOCK})</span>
          </p>
          <p className="mt-1 text-xl font-bold text-amber-600 sm:text-2xl">{lowStock}</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200 sm:p-4">
          <p className="text-xs text-gray-500 sm:text-sm">Out of stock</p>
          <p className="mt-1 text-xl font-bold text-red-600 sm:text-2xl">{outOfStock}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          aria-label="Search products"
          className={`w-full sm:max-w-xs ${fieldClass}`}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | "all")}
          aria-label="Filter by category"
          className={`w-full sm:w-auto ${fieldClass}`}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {actionError && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {actionError}
        </p>
      )}

      {filtered.length === 0 && (
        <p className="mt-4 rounded-xl bg-white px-4 py-10 text-center text-gray-500 shadow-sm ring-1 ring-gray-200">
          No products found.
        </p>
      )}

      {/* Mobile: cards (hidden from 768px up) */}
      {filtered.length > 0 && (
        <ul className="mt-4 space-y-3 md:hidden">
          {filtered.map((p) => (
            <li key={p._id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
              <div className="flex gap-3">
                <Thumb product={p} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-medium text-gray-900">{p.name}</p>
                  <p className="mt-0.5 text-xs capitalize text-gray-500">{p.category}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-gray-900">
                  {money.format(p.price)}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <StockBadge stock={p.stock} />
                <StatusBadge active={p.isActive} />
              </div>

              <button
                onClick={() => handleDelete(p)}
                disabled={deletingId === p._id}
                className="mt-3 w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === p._id ? "Deleting..." : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Tablet and desktop: table (shown from 768px up) */}
      {filtered.length > 0 && (
        <div className="mt-4 hidden overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200 md:block">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Thumb product={p} />
                      <span className="max-w-[16rem] truncate font-medium text-gray-900 lg:max-w-sm">
                        {p.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{p.category}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                    {money.format(p.price)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StockBadge stock={p.stock} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge active={p.isActive} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={deletingId === p._id}
                      className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === p._id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-sm text-gray-500">
        Showing {filtered.length} of {products.length} products
      </p>

      {/* Add product popup */}
      {showAdd && (
        <AddProductModal onClose={() => setShowAdd(false)} onCreated={handleCreated} />
      )}
    </main>
  );
}