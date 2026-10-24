"use client";
import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import { stagger } from "@/lib/motion";
import type { ProductSummary } from "@/types/product";

export type ShopQueryParams = {
  category?: string;
  search?: string;
  min?: number;
  max?: number;
  sort: string;
};

type Props = {
  initialProducts: ProductSummary[];
  initialTotal: number;
  initialPages: number;
  query: ShopQueryParams;
};

type ShopResponse = {
  products: ProductSummary[];
  total: number;
  page: number;
  pages: number;
};

export default function ShopProducts({ initialProducts, initialTotal, initialPages, query }: Props) {
  const [items, setItems] = useState(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(initialPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasMore = page < pages;
  const remaining = Math.max(0, total - items.length);

  const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (query.category) params.set("category", query.category);
      if (query.search) params.set("search", query.search);
      if (query.min !== undefined) params.set("min", String(query.min));
      if (query.max !== undefined) params.set("max", String(query.max));
      params.set("sort", query.sort);
      params.set("page", String(page + 1));

      const res = await fetch(`/api/shop?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load");
      const data: ShopResponse = await res.json();

      // Skip anything already shown, in case products were added while browsing
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p._id));
        return [...prev, ...data.products.filter((p) => !seen.has(p._id))];
      });
      setPage(data.page);
      setPages(data.pages);
      setTotal(data.total);
    } catch {
      setError("Could not load more products. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {items.map((p, i) => (
          // Each product rises in a moment after the one before it. A new batch starts fresh.
          <li key={p._id} className="enter" style={stagger(i % 12, 6)}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center gap-3">
        <p aria-live="polite" className="text-sm text-slate-400">
          Showing {items.length} of {total} {total === 1 ? "product" : "products"}
        </p>

        {error && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-lg bg-brand-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Loading..." : `Load more${remaining > 0 ? ` (${remaining} more)` : ""}`}
          </button>
        )}
      </div>
    </>
  );
}