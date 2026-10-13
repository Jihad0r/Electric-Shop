import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Orders";
import Product from "@/models/Product";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const FREE_SHIPPING_OVER = 100;
const SHIPPING_FEE = 5;
const TAX_RATE = 0;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// POST /api/orders
export async function POST(request) {
  const reserved = []; // { id, quantity } for rolling back stock

  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Please log in" }, { status: 401 });
    }

    await connectDB();
    const { items, shippingAddress, paymentMethod } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Merge duplicates and validate input
    const wanted = new Map();
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!mongoose.Types.ObjectId.isValid(item.productId) || !Number.isInteger(qty) || qty < 1) {
        return NextResponse.json({ error: "Invalid item in cart" }, { status: 400 });
      }
      wanted.set(item.productId, (wanted.get(item.productId) || 0) + qty);
    }

    const products = await Product.find({ _id: { $in: [...wanted.keys()] }, isActive: true });
    if (products.length !== wanted.size) {
      return NextResponse.json({ error: "One or more products are unavailable" }, { status: 400 });
    }

    // Order items only store product + quantity; the total uses real DB prices
    const orderItems = [];
    let itemsPrice = 0;
    for (const p of products) {
      const quantity = wanted.get(p._id.toString());
      orderItems.push({ product: p._id, quantity });
      itemsPrice += p.price * quantity;
    }
    itemsPrice = round2(itemsPrice);

    // Reserve stock atomically (fails if not enough left)
    for (const item of orderItems) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      );
      if (!updated) {
        for (const r of reserved) {
          await Product.updateOne({ _id: r.id }, { $inc: { stock: r.quantity } });
        }
        const name = products.find((p) => p._id.equals(item.product))?.name;
        return NextResponse.json({ error: `Not enough stock for "${name}"` }, { status: 409 });
      }
      reserved.push({ id: item.product, quantity: item.quantity });
    }

    const order = await Order.create({
      user: auth.id,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      shippingPrice: itemsPrice >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE,
      taxPrice: round2(itemsPrice * TAX_RATE),
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    // Order failed after stock was reserved, so give the stock back
    for (const r of reserved) {
      await Product.updateOne({ _id: r.id }, { $inc: { stock: r.quantity } });
    }
    const status = error.name === "ValidationError" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

// GET /api/orders (users see their own, admins see all)
export async function GET(request) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ error: "Please log in" }, { status: 401 });
  }

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
      .populate("items.product", "name price image") // name/price/image now come from the product
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
}