import { connection } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { bestOffer, getActiveOffers } from "@/lib/offers";
import { formatMoney } from "@/lib/format";
import { CURRENCY } from "@/lib/store";
import type { Category, ProductSummary } from "@/types/product";

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

export type OfferRow = {
  id: string;
  title: string;
  description: string;
  label: string;
  endsAt: string | null;
  products: ProductSummary[];
};

// Turns a product into card data, with the best active offer applied
function toSummary(p: RawProduct, offers: OfferDoc[]): ProductSummary {
  const deal = bestOffer(p._id, p.price, offers);
  const finalPrice = deal ? Math.round((p.price - deal.amount) * 100) / 100 : p.price;

  return {
    _id: String(p._id),
    name: p.name,
    price: finalPrice,
    originalPrice: deal ? p.price : undefined,
    discountPercent: deal ? Math.round((deal.amount / p.price) * 100) : undefined,
    category: p.category,
    stock: p.stock,
    image: p.image?.url,
    hasOptions: (p.variants?.length ?? 0) > 0,
  };
}

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