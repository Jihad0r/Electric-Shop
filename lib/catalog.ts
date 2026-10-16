import { cache } from "react";
import { connection } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { bestOffer, getActiveOffers } from "@/lib/offers";
import { formatMoney } from "@/lib/format";
import { CURRENCY } from "@/lib/store";
import type { Category, ProductDetail, ProductSummary } from "@/types/product";

/* ---------- Types ---------- */

type RawProduct = {
  _id: unknown;
  name: string;
  price: number;
  category: Category;
  stock: number;
  image?: { url?: string };
  variants?: unknown[];
};

type OfferDoc = {
  _id: unknown;
  title: string;
  description?: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  applyToAll: boolean;
  products: unknown[];
  showOnHome: boolean;
  endsAt?: Date | null;
};

type Priced = { price: number; originalPrice?: number; discountPercent?: number };

export type OfferRow = {
  id: string;
  title: string;
  description: string;
  label: string;
  endsAt: string | null;
  products: ProductSummary[];
};

export type ShopSort = "newest" | "price-asc" | "price-desc";

export type ShopQuery = {
  category?: Category;
  search?: string;
  min?: number;
  max?: number;
  sort: ShopSort;
  page: number;
};

export type ShopResult = {
  products: ProductSummary[];
  total: number;
  page: number;
  pages: number;
};

/* ---------- Helpers ---------- */

export const PAGE_SIZE = 12;
const MAX_SCANNED = 500; // safety cap on products loaded per request

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function priceWithOffer(productId: unknown, price: number, offers: OfferDoc[]): Priced {
  const deal = bestOffer(productId, price, offers);
  if (!deal) return { price };
  return {
    price: round2(price - deal.amount),
    originalPrice: price,
    discountPercent: Math.round((deal.amount / price) * 100),
  };
}

// Turns a product into card data, with the best active offer applied
function toSummary(p: RawProduct, offers: OfferDoc[]): ProductSummary {
  const priced = priceWithOffer(p._id, p.price, offers);

  return {
    _id: String(p._id),
    name: p.name,
    price: priced.price,
    originalPrice: priced.originalPrice,
    discountPercent: priced.discountPercent,
    category: p.category,
    stock: p.stock,
    image: p.image?.url,
    hasOptions: (p.variants?.length ?? 0) > 0,
  };
}

/* ---------- Home page ---------- */

export async function getFeatured(limit = 8): Promise<ProductSummary[]> {
  await connection(); // the date-based offer check must run at request time
  try {
    await connectDB();
    const offers = (await getActiveOffers()) as unknown as OfferDoc[];
    const docs = (await Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()) as unknown as RawProduct[];
    return docs.map((p) => toSummary(p, offers));
  } catch (error) {
    console.error("Could not load products:", error);
    return [];
  }
}

// One row per active offer that is set to show on the home page
export async function getOfferRows(maxRows = 4, perRow = 10): Promise<OfferRow[]> {
  await connection();
  try {
    await connectDB();
    const offers = (await getActiveOffers()) as unknown as OfferDoc[];
    const onHome = offers.filter((o) => o.showOnHome).slice(0, maxRows);

    const rows: OfferRow[] = [];
    for (const offer of onHome) {
      const filter = offer.applyToAll
        ? { isActive: true }
        : { isActive: true, _id: { $in: offer.products } };

      const docs = (await Product.find(filter)
        .sort({ createdAt: -1 })
        .limit(perRow)
        .lean()) as unknown as RawProduct[];

      if (docs.length === 0) continue;

      rows.push({
        id: String(offer._id),
        title: offer.title,
        description: offer.description ?? "",
        label:
          offer.discountType === "percent"
            ? `${offer.discountValue}% OFF`
            : `${formatMoney(offer.discountValue, CURRENCY)} OFF`,
        endsAt: offer.endsAt ? new Date(offer.endsAt).toISOString() : null,
        products: docs.map((p) => toSummary(p, offers)),
      });
    }
    return rows;
  } catch (error) {
    console.error("Could not load offers:", error);
    return [];
  }
}

/* ---------- Shop and category pages ---------- */

export async function getShopProducts(q: ShopQuery): Promise<ShopResult> {
  await connection(); // offers depend on the current date
  try {
    await connectDB();

    const filter: Record<string, unknown> = { isActive: true }; // hidden products never show
    if (q.category) filter.category = q.category;
    if (q.search) filter.name = { $regex: escapeRegex(q.search), $options: "i" };

    const [offers, docs] = await Promise.all([
      getActiveOffers() as unknown as Promise<OfferDoc[]>,
      Product.find(filter)
        .sort({ createdAt: -1 })
        .limit(MAX_SCANNED)
        .lean() as unknown as Promise<RawProduct[]>,
    ]);

    // Prices include offers, so price filters and sorting use the price the customer sees
    let items = docs.map((p) => toSummary(p, offers));
    if (q.min !== undefined) items = items.filter((p) => p.price >= q.min!);
    if (q.max !== undefined) items = items.filter((p) => p.price <= q.max!);

    if (q.sort === "price-asc") items.sort((a, b) => a.price - b.price);
    if (q.sort === "price-desc") items.sort((a, b) => b.price - a.price);

    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(q.page, pages);

    return {
      products: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total,
      page,
      pages,
    };
  } catch (error) {
    console.error("Could not load shop products:", error);
    return { products: [], total: 0, page: 1, pages: 1 };
  }
}

/* ---------- Single product page ---------- */

type RawVariant = {
  _id: unknown;
  selections: { name: string; value: string }[];
  price: number;
  stock: number;
};

type RawDetail = RawProduct & {
  description?: string;
  options?: { name: string; values: string[] }[];
  variants?: RawVariant[];
};

// cache() lets the page and its sections share one database query
export const getProductDetail = cache(async (id: string): Promise<ProductDetail | null> => {
  await connection();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  try {
    await connectDB();
    const [offers, doc] = await Promise.all([
      getActiveOffers() as unknown as Promise<OfferDoc[]>,
      Product.findOne({ _id: id, isActive: true }).lean() as unknown as Promise<RawDetail | null>,
    ]);
    if (!doc) return null; // missing or hidden products show a 404

    const base = priceWithOffer(doc._id, doc.price, offers);

    return {
      _id: String(doc._id),
      name: doc.name,
      description: doc.description ?? "",
      category: doc.category,
      image: doc.image?.url,
      options: (doc.options ?? []).map((o) => ({ name: o.name, values: [...o.values] })),
      variants: (doc.variants ?? []).map((v) => ({
        _id: String(v._id),
        selections: v.selections.map((s) => ({ name: s.name, value: s.value })),
        stock: v.stock,
        ...priceWithOffer(doc._id, v.price, offers),
      })),
      price: base.price,
      originalPrice: base.originalPrice,
      discountPercent: base.discountPercent,
      stock: doc.stock,
    };
  } catch (error) {
    console.error("Could not load product:", error);
    return null;
  }
});

export async function getRelated(
  category: Category,
  excludeId: string,
  limit = 4
): Promise<ProductSummary[]> {
  await connection();
  try {
    await connectDB();
    const offers = (await getActiveOffers()) as unknown as OfferDoc[];
    const docs = (await Product.find({ isActive: true, category, _id: { $ne: excludeId } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()) as unknown as RawProduct[];
    return docs.map((p) => toSummary(p, offers));
  } catch (error) {
    console.error("Could not load related products:", error);
    return [];
  }
}