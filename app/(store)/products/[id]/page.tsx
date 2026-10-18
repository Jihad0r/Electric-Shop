import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import ProductPurchase from "@/components/ProductPurchase";
import { getProductDetail, getRelated } from "@/lib/catalog";
import { CATEGORY_META, STORE_NAME } from "@/lib/store";
import type { Category } from "@/types/product";

async function Suggestions({ category, excludeId }: { category: Category; excludeId: string }) {
  const products = await getRelated(category, excludeId, 8);
  if (products.length === 0) return null;

  return (
    <section className="mt-10" aria-labelledby="suggestions-title">
      <div className="flex items-end justify-between gap-3">
        <h2 id="suggestions-title" className="text-xl font-bold text-white sm:text-2xl">
          You may also like
        </h2>
        <Link
          href={`/${category}`}
          className="shrink-0 text-sm font-medium text-brand-400 transition hover:text-white"
        >
          More {CATEGORY_META[category].label} &rarr;
        </Link>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <li key={p._id}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SuggestionsSkeleton() {
  return (
    <div className="mt-10" aria-hidden="true">
      <div className="h-7 w-48 animate-pulse rounded bg-white/10" />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
            <div className="aspect-square animate-pulse bg-white/10" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
              <div className="h-8 w-full animate-pulse rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function ProductContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductDetail(id);
  if (!product) notFound();

  const meta = CATEGORY_META[product.category];

  return (
    <>
      <title>{`${product.name} | ${STORE_NAME}`}</title>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
        <Link href="/" className="transition hover:text-white">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/${product.category}`} className="transition hover:text-white">
          {meta.label}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-200">{product.name}</span>
      </nav>

      {/* Details for this one product */}
      <div className="mt-4 overflow-hidden rounded-2xl bg-white text-gray-900 shadow-xl shadow-black/30">
        <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-2 lg:gap-10 lg:p-8">
          {/* Image */}
          <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-50">
            {product.image && (
              <Image
                src={product.image}
                alt={product.name}
                fill
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-contain p-6"
              />
            )}
          </div>

          {/* Name, price, options, quantity, Add to Cart */}
          <div>
            <Link
              href={`/${product.category}`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              {meta.label}
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">{product.name}</h1>

            <ProductPurchase product={product} />
          </div>
        </div>

        {product.description && (
          <section className="border-t border-gray-200 p-4 sm:p-6 lg:p-8">
            <h2 className="font-semibold text-gray-900">Description</h2>
            <p className="mt-3 max-w-3xl whitespace-pre-line text-gray-700">{product.description}</p>
          </section>
        )}
      </div>

      {/* Suggestions under the product */}
      <Suspense fallback={<SuggestionsSkeleton />}>
        <Suggestions category={product.category} excludeId={product._id} />
      </Suspense>
    </>
  );
}

function ProductSkeleton() {
  return (
    <div aria-hidden="true" className="mt-4 rounded-2xl bg-white p-4 sm:p-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-xl bg-gray-100" />
        <div className="space-y-4">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-gray-100" />
          <div className="h-10 w-1/2 animate-pulse rounded bg-gray-100" />
          <div className="h-12 w-full animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<ProductSkeleton />}>
        <ProductContent params={params} />
      </Suspense>
    </main>
  );
}