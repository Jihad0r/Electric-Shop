import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Link from "next/link";
import HeroSlider from "@/components/HeroSlider";
import ProductCard from "@/components/ProductCard";
import ProductSlider from "@/components/ProductSlider";
import { getFeatured, getOfferRows } from "@/lib/catalog";
import { DEFAULT_HERO_IMAGE } from "@/lib/heroDefaults";
import { getHeroSlides } from "@/lib/hero";
import { OFFER, PERKS, STORE_NAME } from "@/lib/store";
import PerkIcon from "@/components/PerkIcon";
export const metadata: Metadata = {
  title: `${STORE_NAME} | Phones, laptops, tablets & accessories`,
  description: "Shop the latest phones, laptops, tablets and accessories.",
};

// cache() lets the hero and the product grid share one database query
const loadFeatured = cache(() => getFeatured(8));

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Cairo",
  });
}

async function HeroSection() {
  const slides = await getHeroSlides();

  // Without a default image, slides with no picture show the newest product photos
  const needsFallback = !DEFAULT_HERO_IMAGE && slides.some((s) => !s.imageUrl);
  const fallback = needsFallback
    ? (await loadFeatured())
        .filter((p) => p.image)
        .slice(0, 3)
        .map((p) => ({ id: p._id, image: p.image as string }))
    : [];

  return <HeroSlider slides={slides} fallback={fallback} />;
}

function HeroSkeleton() {
  return (
    <section className="surface-dark bg-linear-to-r from-black via-ink-900 to-ink-700" aria-hidden="true">
      <div className="mx-auto h-80 max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="h-12 w-2/3 animate-pulse bg-white/10" />
        <div className="mt-4 h-12 w-1/2 animate-pulse bg-white/10" />
      </div>
    </section>
  );
}

async function OfferRows() {
  const rows = await getOfferRows();
  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((row) => (
        <section key={row.id} className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold sm:text-2xl">{row.title}</h2>
            <span className="bg-black px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              {row.label}
            </span>
          </div>
          {row.description && <p className="mt-1 text-sm text-slate-400">{row.description}</p>}
          {row.endsAt && (
            <p className="mt-1 text-xs font-medium text-amber-700">Ends {formatDay(row.endsAt)}</p>
          )}

          <div className="mt-5">
            <ProductSlider label={`${row.title} products`}>
              {row.products.map((p) => (
                <li key={p._id} className="w-44 shrink-0 sm:w-52">
                  <ProductCard product={p} />
                </li>
              ))}
            </ProductSlider>
          </div>
        </section>
      ))}
    </>
  );
}

async function FeaturedProducts() {
  const products = (await loadFeatured()).slice(0, 4);

  if (products.length === 0) {
    return (
      <p className="border border-black/10 px-4 py-10 text-center text-slate-400">
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
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="overflow-hidden border border-black/10">
          <div className="aspect-square animate-pulse bg-white/10" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-4/5 animate-pulse bg-white/10" />
            <div className="h-3 w-1/3 animate-pulse bg-white/10" />
            <div className="h-8 w-full animate-pulse bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}


export default function HomePage() {
  return (
    <main>
      {/* Hero slider: managed from Admin > Content */}
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>

      {/* Perks */}
      <section className="border-b border-black/10">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-5 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
          {PERKS.map((perk) => (
            <li key={perk.title} className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-black/15 ">
                <PerkIcon name={perk.icon} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{perk.title}</p>
                <p className="text-xs text-slate-400">{perk.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Offers managed from Admin > Content */}
      <Suspense fallback={null}>
        <OfferRows />
      </Suspense>

      {/* Featured products */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold  sm:text-2xl">Featured Products</h2>
          <Link
            href="/products"
            className="shrink-0 text-sm font-medium  underline underline-offset-4 transition hover:no-underline"
          >
            View all
          </Link>
        </div>

        <div className="mt-6">
          <Suspense fallback={<ProductsSkeleton />}>
            <FeaturedProducts />
          </Suspense>
        </div>
      </section>

      {/* Limited time offer banner (static text, edit it in lib/store.ts) */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="surface-dark relative overflow-hidden bg-linear-to-r from-black via-ink-800 to-ink-700 p-6 sm:p-10">
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold  sm:text-2xl">{OFFER.title}</h2>
              <p className="mt-1 text-sm text-slate-300 sm:text-base">{OFFER.text}</p>
              <Link
                href={OFFER.href}
                className="mt-4 inline-flex items-center gap-2 bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200"
              >
                {OFFER.cta} <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
            <p className="self-start border border-white/30 px-6 py-3 text-4xl font-extrabold text-white sm:self-center sm:text-5xl">
              {OFFER.badge}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}