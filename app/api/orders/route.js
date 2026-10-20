import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { restoreStock } from "@/lib/stock";
import { getActiveOffers, bestOffer } from "@/lib/offers";
import { AUTO_SHIP_COD, TAX_RATE, shippingFor } from "@/lib/shipping";
import { expireStaleOrders } from "@/lib/expireOrders";
import { isOnlineAvailable } from "@/lib/paymob";
import { syncRecords } from "@/lib/fulfillment";
import { shipOrder } from "@/lib/shipOrder";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

// POST /api/orders
export async function POST(request) {
  const reserved = []; // { product, variantId, quantity } for rolling back stock

  const rollback = async () => {
    for (const r of reserved) await restoreStock(r);
    reserved.length = 0;
  };

  try {
    const auth = await getAuth();
    if (!auth) return bad("Please log in", 401);

    await connectDB();

    // Give back the stock of online orders that were never paid
    await expireStaleOrders().catch((e) => console.error("Could not release old orders:", e));

    const { items, shippingAddress, paymentMethod } = await request.json();

    const method = paymentMethod ?? "cod";
    if (!["cod", "card", "wallet"].includes(method)) return bad("Invalid payment method");
    if (method !== "cod" && !isOnlineAvailable(method)) {
      return bad("That payment method isn't available right now");
    }
    if (!shippingAddress || typeof shippingAddress !== "object") {
      return bad("Please enter your shipping address");
    }

    if (!Array.isArray(items) || items.length === 0) return bad("Cart is empty");

    // Merge duplicates (same product AND same variant) and validate input
    const wanted = new Map();
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!isId(item.productId) || !Number.isInteger(qty) || qty < 1) {
        return bad("Invalid item in cart");
      }
      if (item.variantId && !isId(item.variantId)) return bad("Invalid item in cart");

      const productId = new mongoose.Types.ObjectId(item.productId).toString();
      const variantId = item.variantId ? new mongoose.Types.ObjectId(item.variantId).toString() : "";
      const key = `${productId}:${variantId}`;

      const existing = wanted.get(key);
      wanted.set(key, { productId, variantId, quantity: (existing?.quantity || 0) + qty });
    }

    const productIds = [...new Set([...wanted.values()].map((w) => w.productId))];
    const products = await Product.find({ _id: { $in: productIds }, isActive: true });
    const byId = new Map(products.map((p) => [p._id.toString(), p]));

    const offers = await getActiveOffers();

    // Build the order lines using REAL prices from the database
    const lines = []; // { item, title }
    let itemsPrice = 0;
    let discountAmount = 0;
    const offerTitles = new Set();

    for (const w of wanted.values()) {
      const product = byId.get(w.productId);
      if (!product) return bad("One or more products are unavailable");

      let unitPrice = product.price;
      let variantId;
      let variantLabel = "";

      if (product.variants.length > 0) {
        if (!w.variantId) return bad(`Please choose options for "${product.name}"`);

        const variant = product.variants.id(w.variantId);
        if (!variant) return bad(`That option of "${product.name}" is no longer available`);

        unitPrice = variant.price;
        variantId = variant._id;
        variantLabel = variant.selections.map((s) => s.value).join(" / ");
      } else if (w.variantId) {
        return bad(`"${product.name}" has no options`);
      }

      lines.push({
        item: { product: product._id, variantId, variantLabel, quantity: w.quantity },
        title: variantLabel ? `${product.name} (${variantLabel})` : product.name,
      });
      itemsPrice += unitPrice * w.quantity;

      // Best active offer for this product (offers don't stack)
      const deal = bestOffer(product._id, unitPrice, offers);
      if (deal) {
        discountAmount += deal.amount * w.quantity;
        offerTitles.add(deal.offer.title);
      }
    }

    itemsPrice = round2(itemsPrice);
    discountAmount = round2(discountAmount);
    const netPrice = round2(itemsPrice - discountAmount);

    // Reserve stock atomically (fails if not enough is left)
    for (const { item, title } of lines) {
      const filter = item.variantId
        ? {
            _id: item.product,
            variants: { $elemMatch: { _id: item.variantId, stock: { $gte: item.quantity } } },
          }
        : { _id: item.product, stock: { $gte: item.quantity } };

      const update = item.variantId
        ? { $inc: { "variants.$.stock": -item.quantity, stock: -item.quantity } }
        : { $inc: { stock: -item.quantity } };

      const updated = await Product.findOneAndUpdate(filter, update);
      if (!updated) {
        await rollback();
        return bad(`Not enough stock for "${title}"`, 409);
      }

      reserved.push({ product: item.product, variantId: item.variantId, quantity: item.quantity });
    }

    const autoShip = method === "cod" && AUTO_SHIP_COD;

    const order = await Order.create({
      user: auth.id,
      items: lines.map((l) => l.item),
      shippingAddress,
      paymentMethod: method,
      // Cash on delivery is confirmed straight away. Online orders wait for payment.
      status: autoShip ? "confirmed" : "pending",
      itemsPrice,
      discountAmount,
      discountCode: [...offerTitles].join(", "),
      shippingPrice: shippingFor(netPrice),
      taxPrice: round2(netPrice * TAX_RATE),
    });

    await syncRecords(order);

    // Cash on delivery: hand the parcel to Bosta right away. If Bosta is unavailable,
    // the order stays confirmed and you can retry with "Start shipping" in the admin.
    if (autoShip) {
      const result = await shipOrder(order._id).catch((e) => ({ ok: false, error: e.message }));
      if (!result.ok) console.error("Could not create the Bosta delivery:", result.error);
    }

    const fresh = await Order.findById(order._id);
    return NextResponse.json(fresh ?? order, { status: 201 });
  } catch (error) {
    // The order failed after stock was reserved, so give the stock back
    await rollback();
    const status = error.name === "ValidationError" ? 400 : 500;
    return bad(error.message, status);
  }
}

// GET /api/orders (users see their own, admins see all)
export async function GET(request) {
  const auth = await getAuth();
  if (!auth) return bad("Please log in", 401);

  await connectDB();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Number(searchParams.get("limit")) || 10);
  const status = searchParams.get("status");

  const filter = auth.role === "admin" ? {} : { user: auth.id };
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "name email")
      .populate("items.product", "name price image variants")
      .populate("shipment", "courier trackingNumber status bostaState lastError")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
}