import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { getActiveOffers, bestOffer } from "@/lib/offers";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const MAX_LINES = 100;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const isId = (v) => mongoose.Types.ObjectId.isValid(v);

// POST { items: [{ productId, variantId? }] } -> { items: { "<productId>:<variantId>": info } }
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const list = Array.isArray(body?.items) ? body.items : null;

    if (!list || list.length === 0 || list.length > MAX_LINES) {
      return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
    }

    const lines = list.map((item) => {
      const productId = String(item?.productId ?? "");
      const variantId = item?.variantId ? String(item.variantId) : "";
      return { key: `${productId}:${variantId}`, productId, variantId };
    });

    const ids = [...new Set(lines.filter((l) => isId(l.productId)).map((l) => l.productId))];

    await connectDB();
    const [products, offers] = await Promise.all([
      Product.find({ _id: { $in: ids }, isActive: true }).lean(),
      getActiveOffers(),
    ]);
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const items = {};

    for (const line of lines) {
      const product = byId.get(line.productId);
      if (!product) {
        items[line.key] = { available: false };
        continue;
      }

      let unitPrice = product.price;
      let stock = product.stock;
      let label = "";

      if (product.variants?.length > 0) {
        const variant = product.variants.find((v) => String(v._id) === line.variantId);
        if (!variant) {
          items[line.key] = { available: false }; // that option was removed
          continue;
        }
        unitPrice = variant.price;
        stock = variant.stock;
        label = variant.selections.map((s) => s.value).join(" / ");
      } else if (line.variantId) {
        items[line.key] = { available: false };
        continue;
      }

      const deal = bestOffer(product._id, unitPrice, offers);

      items[line.key] = {
        available: true,
        name: product.name,
        image: product.image?.url || "",
        label,
        price: deal ? round2(unitPrice - deal.amount) : unitPrice,
        originalPrice: deal ? unitPrice : undefined,
        stock,
      };
    }

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}