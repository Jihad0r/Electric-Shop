import { Suspense } from "react";
import { notFound } from "next/navigation";
import ShopListing, { ShopSkeleton, type RawParams } from "@/components/ShopListing";
import { CATEGORIES, isCategory } from "@/types/product";

// The five category pages are known ahead of time
export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

async function CategoryContent({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<RawParams>;
}) {
  const { category } = await params;
  if (!isCategory(category)) notFound(); // e.g. /banana shows a 404
  return <ShopListing category={category} searchParams={searchParams} />;
}

export default function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<RawParams>;
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<ShopSkeleton />}>
        <CategoryContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}