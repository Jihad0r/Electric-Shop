import type { Metadata } from "next";
import { Suspense } from "react";
import ShopListing, { ShopSkeleton, type RawParams } from "@/components/ShopListing";

export const metadata: Metadata = { title: "Shop" };

export default function ShopPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<ShopSkeleton />}>
        <ShopListing searchParams={searchParams} />
      </Suspense>
    </main>
  );
}