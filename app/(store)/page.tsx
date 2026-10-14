import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import ProductCard, { type ProductSummary } from "@/components/ProductCard";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { CATEGORY_META, STORE_NAME } from "@/lib/store";
import { CATEGORIES, type Category } from "@/types/product";

export const metadata: Metadata = {
  title: `${STORE_NAME} | Phones, laptops, tablets & accessories`,
  description: "Shop the latest phones, laptops, tablets and accessories.",
};

type RawProduct = {
  _id: unknown;
  name: string;
  price: number;
  category: Category;
  stock: number;
  image?: { url?: string };
};

async function getNewArrivals(): Promise<ProductSummary[]> {
  try {
    await connectDB();
    const docs = (await Product.find({ isActive: true }) // hidden products never show here
      .sort({ createdAt: -1 })
      .limit(8)
      .lean()) as unknown as RawProduct[];

    return docs.map((p) => ({
      _id: String(p._id),
      name: p.name,
      price: p.price,
      category: p.category,
      stock: p.stock,
      image: p.image?.url,
    }));
  } catch (error) {
    console.error("Could not load new arrivals:", error);
    return [];
  }
}

async function NewArrivals() {
  const products = await getNewArrivals();

  if (products.length === 0) {
    return (
      <p className="rounded-xl bg-gray-50 px-4 py-10 text-center text-gray-500">
        No products to show yet. Check back soon!
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p._id} product={p} />
      ))}
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl ring-1 ring-gray-200">
          <div className="aspect-square animate-pulse bg-gray-100" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

const FEATURES = [
  { emoji: "💵", title: "Cash on delivery", text: "Pay when your order arrives at your door." },
  { emoji: "🔒", title: "Secure accounts", text: "Your password is encrypted and your details stay private." },
  { emoji: "🛒", title: "Everything in one place", text: "Phones, laptops, tablets and accessories from one store." },
];

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-blue-200">
              Welcome to {STORE_NAME}
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">
              The latest phones, laptops &amp; tablets
            </h1>
            <p className="mt-4 max-w-xl text-base text-blue-100 sm:text-lg">
              Find the right device at the right price, and the accessories to go with it.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/products"
                className="rounded-lg bg-white px-6 py-3 text-center font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                Shop now
              </Link>
              <a
                href="#categories"
                className="rounded-lg border border-white/40 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                Browse categories
              </a>
            </div>
          </div>

          {/* Decorative tiles, large screens only */}
          <div className="hidden grid-cols-2 gap-4 lg:grid" aria-hidden="true">
            {(["phones", "laptops", "accessories", "tablets"] as const).map((c) => (
              <div
                key={c}
                className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur"
              >
                <span className="text-5xl">{CATEGORY_META[c].emoji}</span>
                <span className="mt-2 text-sm font-medium text-blue-100">
                  {CATEGORY_META[c].label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Shop by category</h2>
        <p className="mt-1 text-sm text-gray-500">Pick a category to start browsing</p>

        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <Link
                href={`/products?category=${c}`}
                className="flex h-full flex-col items-center rounded-2xl bg-gray-50 p-4 text-center ring-1 ring-gray-200 transition hover:bg-blue-50 hover:ring-blue-200"
              >
                <span className="text-4xl" aria-hidden="true">
                  {CATEGORY_META[c].emoji}
                </span>
                <span className="mt-3 font-semibold text-gray-900">{CATEGORY_META[c].label}</span>
                <span className="mt-1 text-xs text-gray-500">{CATEGORY_META[c].blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* New arrivals */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">New arrivals</h2>
            <p className="mt-1 text-sm text-gray-500">Our latest products</p>
          </div>
          <Link href="/products" className="shrink-0 text-sm font-medium text-blue-600 hover:underline">
            View all &rarr;
          </Link>
        </div>

        <div className="mt-6">
          <Suspense fallback={<ProductsSkeleton />}>
            <NewArrivals />
          </Suspense>
        </div>
      </section>

      {/* Why shop with us */}
      <section className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:px-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="text-center sm:text-left">
              <span className="text-3xl" aria-hidden="true">
                {f.emoji}
              </span>
              <h3 className="mt-3 font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}