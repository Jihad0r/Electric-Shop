import Link from "next/link";
import { redirect } from "next/navigation";
import ShopProducts from "@/components/ShopProducts";
import { getShopProducts, type ShopSort } from "@/lib/catalog";
import { CATEGORY_META, STORE_NAME } from "@/lib/store";
import { CATEGORIES, isCategory, type Category } from "@/types/product";

export type RawParams = Record<string, string | string[] | undefined>;

type Filters = {
  search?: string;
  min?: number;
  max?: number;
  sort: ShopSort;
};

const SORTS: { value: ShopSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const toNumber = (v: string | undefined) => {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

function parseFilters(raw: RawParams): Filters {
  const sort = first(raw.sort);
  const search = first(raw.search)?.trim().slice(0, 60);

  return {
    search: search || undefined,
    min: toNumber(first(raw.min)),
    max: toNumber(first(raw.max)),
    sort: SORTS.some((s) => s.value === sort) ? (sort as ShopSort) : "newest",
  };
}

const pathFor = (category?: Category) => (category ? `/${category}` : "/products");

// Builds a URL for a category (or all products) that keeps the current filters
function href(category: Category | undefined, current: Filters, patch: Partial<Filters> = {}) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.search) params.set("search", next.search);
  if (next.min !== undefined) params.set("min", String(next.min));
  if (next.max !== undefined) params.set("max", String(next.max));
  if (next.sort !== "newest") params.set("sort", next.sort);
  const qs = params.toString();
  return qs ? `${pathFor(category)}?${qs}` : pathFor(category);
}

const CATEGORY_ITEMS: { label: string; value?: Category }[] = [
  { label: "All products" },
  ...CATEGORIES.map((c) => ({ label: CATEGORY_META[c].label, value: c as Category })),
];

const fieldClass =
  "w-full rounded-lg border border-white/10 bg-ink-800/70 px-3 py-2 text-base text-slate-100 placeholder-slate-500 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 sm:text-sm";

function PriceForm({ category, filters }: { category?: Category; filters: Filters }) {
  const hasPrice = filters.min !== undefined || filters.max !== undefined;

  return (
    <form action={pathFor(category)} method="get" className="space-y-3 ">
      {filters.search && <input type="hidden" name="search" value={filters.search} />}
      {filters.sort !== "newest" && <input type="hidden" name="sort" value={filters.sort} />}

      <div className="grid grid-cols-2 gap-2">
        <input
          name="min"
          type="text"
          min={0}
          inputMode="numeric"
          defaultValue={filters.min}
          placeholder="Min"
          aria-label="Minimum price"
          className={fieldClass}
        />
        <input
          name="max"
          type="text"
          min={0}
          inputMode="numeric"
          defaultValue={filters.max}
          placeholder="Max"
          aria-label="Maximum price"
          className={fieldClass}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500 ring-1 ring-white"
        >
          Apply
        </button>
        {hasPrice && (
          <Link
            href={href(category, filters, { min: undefined, max: undefined })}
            className="text-sm text-slate-400 transition hover:text-white"
          >
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}

export function ShopSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
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

export default async function ShopListing({
  category,
  searchParams,
}: {
  category?: Category; // set on category pages, empty on /products
  searchParams: Promise<RawParams>;
}) {
  const raw = await searchParams;
  const filters = parseFilters(raw);

  // Old links like /products?category=laptops now go to /laptops
  if (!category) {
    const legacy = first(raw.category);
    if (legacy && isCategory(legacy)) redirect(href(legacy, filters));
  }

  // Always starts at the first batch. The Load more button fetches the rest.
  const { products, total, pages } = await getShopProducts({ ...filters, category, page: 1 });

  const title = category
    ? CATEGORY_META[category].label
    : filters.search
      ? `Results for "${filters.search}"`
      : "All products";

  const hasFilters = Boolean(filters.search || filters.min !== undefined || filters.max !== undefined);

  // A new key resets the "Load more" list whenever the category, search, price or sort changes
  const listKey = [category ?? "all", filters.search ?? "", filters.min ?? "", filters.max ?? "", filters.sort].join("|");

  const pill = (isActive: boolean) =>
    `shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
      isActive
        ? "bg-brand-600 text-white"
        : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <>
      <title>{`${title} | ${STORE_NAME}`}</title>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
        <Link href="/" className="transition hover:text-white">
          Home
        </Link>
        <span className="mx-2">/</span>
        {category ? (
          <>
            <Link href="/products" className="transition hover:text-white">
              Shop
            </Link>
            <span className="mx-2">/</span>
            <span className="text-slate-200">{CATEGORY_META[category].label}</span>
          </>
        ) : (
          <span className="text-slate-200">Shop</span>
        )}
      </nav>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
          {category && <p className="mt-1 text-sm text-slate-300">{CATEGORY_META[category].blurb}</p>}
          <p className="mt-1 text-sm text-slate-400">
            {total === 0 ? "No products found" : `${total} ${total === 1 ? "product" : "products"}`}
          </p>
        </div>

        {/* Sort */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm text-black">Sort by:</span>
            {SORTS.map((s) => (
              <Link
                key={s.value}
                href={href(category, filters, { sort: s.value })}
                aria-current={filters.sort === s.value ? "true" : undefined}
                className={pill(filters.sort === s.value)}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Categories on phones and tablets: a swipeable row that stays under the navbar.
          If you see a gap or overlap, adjust the two top-[...] values to match your navbar height. */}
      <div className="sticky top-[10.25rem] z-30 -mx-4 mt-5 overflow-x-auto bg-black px-4 py-2 backdrop-blur md:top-[7.25rem] lg:hidden">
        <div className="flex gap-2 whitespace-nowrap">
          {CATEGORY_ITEMS.map((c) => (
            <Link key={c.label} href={href(c.value, filters)} className={pill(category === c.value)}>
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Price filter on phones */}
      <details className="mt-3 rounded-xl bg-white/5 ring-1 ring-white/10 lg:hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-200">
          Price range
        </summary>
        <div className="px-4 pb-4">
          <PriceForm category={category} filters={filters} />
        </div>
      </details>

      <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_1fr]">
        {/* Sidebar (large screens): stays in view while you scroll */}
        <aside className="hidden lg:block">
          <div className="sticky top-[7.75rem] max-h-[calc(100dvh-8.75rem)] space-y-6 overflow-y-auto rounded-xl bg-black p-4 ring-1 ring-white/10">
            <div>
              <h2 className="text-sm font-semibold text-white">Categories</h2>
              <ul className="mt-3 space-y-1">
                {CATEGORY_ITEMS.map((c) => {
                  const isActive = category === c.value;
                  return (
                    <li key={c.label}>
                      <Link
                        href={href(c.value, filters)}
                        aria-current={isActive ? "page" : undefined}
                        className={`block rounded-lg px-3 py-2 text-sm transition ${
                          isActive
                            ? "bg-brand-600/20 font-medium text-white ring-1 ring-white"
                            : "text-slate-300 hover:bg-white hover:text-black"
                        }`}
                      >
                        {c.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-white">Price range</h2>
              <div className="mt-3">
                <PriceForm category={category} filters={filters} />
              </div>
            </div>
          </div>
        </aside>

        {/* Products */}
        <section>
          {products.length === 0 ? (
            <div className="rounded-xl bg-white/5 px-4 py-14 text-center ring-1 ring-white/10">
              <p className="font-medium text-white">No products found</p>
              <p className="mt-1 text-sm text-slate-400">
                {category
                  ? `There are no ${CATEGORY_META[category].label.toLowerCase()} here yet.`
                  : "Try a different search or price range."}
              </p>
              <Link
                href={hasFilters ? pathFor(category) : "/products"}
                className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500"
              >
                {hasFilters ? "Clear filters" : "Browse all products"}
              </Link>
            </div>
          ) : (
            <ShopProducts
              key={listKey}
              initialProducts={products}
              initialTotal={total}
              initialPages={pages}
              query={{
                category,
                search: filters.search,
                min: filters.min,
                max: filters.max,
                sort: filters.sort,
              }}
            />
          )}
        </section>
      </div>
    </>
  );
}