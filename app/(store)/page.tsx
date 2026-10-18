import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Link from "next/link";
import HeroSlider from "@/components/HeroSlider";
import ProductCard from "@/components/ProductCard";
import { getFeatured, getOfferRows } from "@/lib/catalog";
import { getHeroSlides } from "@/lib/hero";
import { OFFER, PERKS, STORE_NAME } from "@/lib/store";
import ProductSlider from "@/components/ProductSlider";
import { DEFAULT_HERO_IMAGE } from "@/lib/heroDefaults";
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

  // Slides without an image show the newest product photos instead
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
    <section className="bg-linear-to-r from-ink-950 via-ink-900 to-brand-700" aria-hidden="true">
      <div className="mx-auto h-80 max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="h-12 w-2/3 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-12 w-1/2 animate-pulse rounded bg-white/10" />
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
        <section key={row.id} className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-white sm:text-3xl">{row.title}</h2>
            <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-semibold text-brand-600 ring-1 ring-brand-500/30">
              {row.label}
            </span>
          </div>
          {row.description && <p className="mt-1 text-sm text-gray-600">{row.description}</p>}
          {row.endsAt && (
            <p className="mt-1 text-xs font-medium text-amber-600">Ends {formatDay(row.endsAt)}</p>
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
      <p className="rounded-xl bg-white/5 px-4 py-10 text-center text-slate-400 ring-1 ring-white/10">
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
        <div key={i} className="overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
          <div className="aspect-square animate-pulse bg-white/10" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
            <div className="h-8 w-full animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PerkIcon({ name }: { name: (typeof PERKS)[number]["icon"] }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "truck" && (
        <>
          <path d="M3 7h11v9H3z" />
          <path d="M14 10h4l3 3v3h-7z" />
          <circle cx="7.5" cy="17.5" r="1.8" />
          <circle cx="17.5" cy="17.5" r="1.8" />
        </>
      )}
      {name === "lock" && (
        <>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      )}
      {name === "headset" && (
        <>
          <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
          <rect x="3" y="14" width="4" height="6" rx="1.5" />
          <rect x="17" y="14" width="4" height="6" rx="1.5" />
        </>
      )}
      {name === "return" && (
        <>
          <path d="M4 12a8 8 0 1 0 3-6.2" />
          <path d="M4 4v5h5" />
        </>
      )}
    </svg>
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
      <section className="border-y border-white/10 bg-ink-900/60">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-5 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
          {PERKS.map((perk) => (
            <li key={perk.title} className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/30">
                <PerkIcon name={perk.icon} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{perk.title}</p>
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
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold text-white sm:text-3xl">Featured Products</h2>
          <Link
            href="/products"
            className="shrink-0 text-sm font-medium text-brand-400 transition hover:text-black"
          >
            View All &rarr;
          </Link>
        </div>

        <div className="mt-5">
          <Suspense fallback={<ProductsSkeleton />}>
            <FeaturedProducts />
          </Suspense>
        </div>
      </section>

      {/* Limited time offer banner (static text, edit it in lib/store.ts) */}
      <section className="mx-auto max-w-7xl px-4 pb-6  sm:px-6 lg:px-8">
        <div className="relative  overflow-hidden rounded-2xl bg-linear-to-r from-ink-700 via-brand-700 to-brand-600 p-6 sm:p-8">
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white sm:text-2xl">{OFFER.title}</h2>
              <p className="mt-1 text-sm text-blue-100 sm:text-base">{OFFER.text}</p>
              <Link
                href={OFFER.href}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-400 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-sky-300"
              >
                {OFFER.cta} <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
            <p className="self-start rounded-2xl bg-white/10 px-6 py-3 text-4xl font-extrabold text-white ring-1 ring-white/20 sm:self-center sm:text-5xl">
              {OFFER.badge}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}