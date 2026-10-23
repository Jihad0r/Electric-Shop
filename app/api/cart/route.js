import { connectDB } from "@/lib/mongoose";
import {
  addItem,
  clearItems,
  loadCart,
  priceCart,
  removeItem,
  resolveCart,
  setQuantity,
  withCart,
} from "@/lib/cartServer";
import { NextResponse } from "next/server";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

// GET /api/cart: the cart with today's prices
export async function GET() {
  try {
    await connectDB();
    const resolved = await resolveCart();
    return withCart(NextResponse.json(await priceCart(resolved.cart)), resolved);
  } catch (error) {
    console.error("Cart GET failed:", error);
    return bad("Could not load the cart", 500);
  }
}

// POST { productId, variantId?, quantity }: add to the cart
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Invalid request");

    await connectDB();
    const resolved = await resolveCart({ create: true });
    const result = await addItem(resolved.cart._id, body);
    const cart = await priceCart(await loadCart(resolved.cart._id));

    return withCart(NextResponse.json({ result, cart }), resolved);
  } catch (error) {
    console.error("Cart POST failed:", error);
    return bad("Could not add to the cart", 500);
  }
}

// PATCH { key, quantity }: change a quantity
export async function PATCH(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.key !== "string") return bad("Invalid request");

    await connectDB();
    const resolved = await resolveCart();
    if (resolved.cart) await setQuantity(resolved.cart._id, body.key, body.quantity);

    const cart = await priceCart(resolved.cart ? await loadCart(resolved.cart._id) : null);
    return withCart(NextResponse.json({ cart }), resolved);
  } catch (error) {
    console.error("Cart PATCH failed:", error);
    return bad("Could not update the cart", 500);
  }
}

// DELETE ?key=...: remove one item. Without a key: empty the cart
export async function DELETE(request) {
  try {
    const key = new URL(request.url).searchParams.get("key");

    await connectDB();
    const resolved = await resolveCart();
    if (resolved.cart) {
      if (key) await removeItem(resolved.cart._id, key);
      else await clearItems(resolved.cart._id);
    }

    const cart = await priceCart(resolved.cart ? await loadCart(resolved.cart._id) : null);
    return withCart(NextResponse.json({ cart }), resolved);
  } catch (error) {
    console.error("Cart DELETE failed:", error);
    return bad("Could not update the cart", 500);
  }
}