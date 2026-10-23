import crypto from "crypto";
import mongoose from "mongoose";
import { cookies } from "next/headers";
import Cart from "@/models/Cart";
import Product from "@/models/Product";
import { getAuth } from "@/lib/auth";
import { bestOffer, getActiveOffers } from "@/lib/offers";
import { tightImage } from "@/lib/images";
import { TAX_RATE, shippingFor } from "@/lib/shipping";

const COOKIE = "cart_token";
const MAX_LINE_QTY = 99;
const MAX_LINES = 50;
const GUEST_DAYS = 30;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const keyOf = (item) => `${item.product}:${item.variantId ?? ""}`;
const guestExpiry = () => new Date(Date.now() + GUEST_DAYS * 24 * 60 * 60 * 1000);

/* ---------- Whose cart is it? ---------- */

// Finds the cart of the logged-in user, or of the visitor's cookie.
// A visitor's cart is merged into the account cart once they are logged in.
export async function resolveCart({ create = false } = {}) {
  const auth = await getAuth();
  const token = (await cookies()).get(COOKIE)?.value;
  const out = { cart: null, setToken: "", clearToken: false };

  if (auth) {
    let cart = await Cart.findOne({ user: auth.id });

    if (token) {
      // Take the visitor's cart in one step, so two requests can't both merge it
      const guest = await Cart.findOneAndDelete({ token });

      if (guest && guest.items.length > 0) {
        if (!cart) {
          cart = await Cart.findOneAndUpdate(
            { user: auth.id },
            { $setOnInsert: { items: [] } },
            { upsert: true, new: true }
          );
        }
        for (const g of guest.items) {
          const existing = cart.items.find((i) => keyOf(i) === keyOf(g));
          if (existing) {
            existing.quantity = Math.min(existing.quantity + g.quantity, MAX_LINE_QTY);
          } else if (cart.items.length < MAX_LINES) {
            cart.items.push({
              product: g.product,
              variantId: g.variantId,
              name: g.name,
              quantity: g.quantity,
            });
          }
        }
        await cart.save();
      }
      out.clearToken = true;
    }

    if (!cart && create) {
      cart = await Cart.findOneAndUpdate(
        { user: auth.id },
        { $setOnInsert: { items: [] } },
        { upsert: true, new: true }
      );
    }
    out.cart = cart;
    return out;
  }

  let cart = token ? await Cart.findOne({ token }) : null;
  if (!cart && create) {
    const fresh = crypto.randomBytes(24).toString("hex");
    cart = await Cart.create({ token: fresh, items: [], expiresAt: guestExpiry() });
    out.setToken = fresh;
  }
  out.cart = cart;
  return out;
}

// Adds or removes the visitor cookie on the answer
export function withCart(response, resolved) {
  if (resolved.setToken) {
    response.cookies.set(COOKIE, resolved.setToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * GUEST_DAYS,
      path: "/",
    });
  } else if (resolved.clearToken) {
    response.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
  }
  return response;
}

export const loadCart = (id) => Cart.findById(id);

/* ---------- Changing the cart ---------- */

// Runs a change on the cart, and tries again if another request changed it at the same time
async function mutate(cartId, change) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const cart = await Cart.findById(cartId);
    if (!cart) return null;

    const result = await change(cart);

    try {
      if (cart.token) cart.expiresAt = guestExpiry();
      await cart.save();
      return { result };
    } catch (error) {
      if (error.name !== "VersionError") throw error;
    }
  }
  throw new Error("The cart is busy. Please try again.");
}

// Never puts more in the cart than there is in stock
export async function addItem(cartId, { productId, variantId, quantity }) {
  const qty = Math.floor(Number(quantity));
  if (!isId(productId) || !(qty >= 1) || (variantId && !isId(variantId))) {
    return { status: "invalid", added: 0 };
  }
  const pid = new mongoose.Types.ObjectId(productId).toString();
  const vid = variantId ? new mongoose.Types.ObjectId(variantId).toString() : "";

  const product = await Product.findOne({ _id: pid, isActive: true }).lean();
  if (!product) return { status: "unavailable", added: 0 };

  let stock = product.stock;
  if ((product.variants?.length ?? 0) > 0) {
    const variant = product.variants.find((v) => String(v._id) === vid);
    if (!variant) return { status: "unavailable", added: 0 };
    stock = variant.stock;
  } else if (vid) {
    return { status: "unavailable", added: 0 };
  }

  const limit = Math.min(Math.floor(stock) || 0, MAX_LINE_QTY);
  if (limit <= 0) return { status: "soldout", added: 0 };

  const done = await mutate(cartId, (cart) => {
    const existing = cart.items.find((i) => keyOf(i) === `${pid}:${vid}`);
    const inCart = existing?.quantity ?? 0;
    const room = limit - inCart;

    if (room <= 0) return { status: "max", added: 0 };
    if (!existing && cart.items.length >= MAX_LINES) return { status: "full", added: 0 };

    const added = Math.min(qty, room);
    if (existing) existing.quantity = inCart + added;
    else cart.items.push({ product: pid, variantId: vid || undefined, name: product.name, quantity: added });

    return { status: added < qty ? "partial" : "added", added };
  });

  return done?.result ?? { status: "error", added: 0 };
}

export async function setQuantity(cartId, key, quantity) {
  const qty = Math.floor(Number(quantity));
  if (!(qty >= 1)) return;

  const [productId, variantId = ""] = String(key).split(":");
  let limit = 0; // 0 = no stock information, so the quantity can only go down

  if (isId(productId)) {
    const product = await Product.findOne({ _id: productId, isActive: true })
      .select("stock variants")
      .lean();
    if (product) {
      const stock = variantId
        ? product.variants?.find((v) => String(v._id) === variantId)?.stock
        : product.stock;
      if (typeof stock === "number" && stock > 0) limit = Math.min(stock, MAX_LINE_QTY);
    }
  }

  await mutate(cartId, (cart) => {
    const item = cart.items.find((i) => keyOf(i) === key);
    if (item) item.quantity = Math.min(qty, limit > 0 ? limit : item.quantity);
  });
}

export async function removeItem(cartId, key) {
  await mutate(cartId, (cart) => {
    cart.items = cart.items.filter((i) => keyOf(i) !== key);
  });
}

export async function clearItems(cartId) {
  await mutate(cartId, (cart) => {
    cart.items = [];
  });
}

/* ---------- Prices ---------- */

const emptyCart = () => ({
  lines: [],
  itemCount: 0,
  subtotal: 0,
  savings: 0,
  shipping: 0,
  tax: 0,
  total: 0,
  hasProblem: false,
});

// Turns the saved cart into what the pages show, with today's prices, offers and stock
export async function priceCart(cart) {
  const items = cart?.items ?? [];
  if (items.length === 0) return emptyCart();

  const ids = [...new Set(items.map((i) => String(i.product)))];
  const [products, offers] = await Promise.all([
    Product.find({ _id: { $in: ids }, isActive: true }).lean(),
    getActiveOffers(),
  ]);
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines = items.map((item) => {
    const base = {
      key: keyOf(item),
      productId: String(item.product),
      variantId: item.variantId ? String(item.variantId) : undefined,
      quantity: item.quantity,
    };
    const product = byId.get(base.productId);
    const gone = (name) => ({ ...base, name: name || "Unavailable product", unit: 0, stock: 0, problem: "unavailable" });

    if (!product) return gone(item.name);

    let unit = product.price;
    let stock = product.stock;
    let label = "";

    if ((product.variants?.length ?? 0) > 0) {
      const variant = product.variants.find((v) => String(v._id) === base.variantId);
      if (!variant) return gone(product.name); // that option was removed
      unit = variant.price;
      stock = variant.stock;
      label = variant.selections.map((s) => s.value).join(" / ");
    } else if (base.variantId) {
      return gone(product.name);
    }

    const deal = bestOffer(product._id, unit, offers);

    return {
      ...base,
      name: product.name,
      image: tightImage(product.image?.url),
      label: label || undefined,
      unit: deal ? round2(unit - deal.amount) : unit,
      original: deal ? unit : undefined,
      stock,
      problem: stock <= 0 ? "soldout" : item.quantity > stock ? "over" : undefined,
    };
  });

  const counted = lines.filter((l) => l.problem !== "unavailable" && l.problem !== "soldout");
  const subtotal = round2(counted.reduce((sum, l) => sum + l.unit * l.quantity, 0));
  const savings = round2(
    counted.reduce((sum, l) => sum + (l.original ? (l.original - l.unit) * l.quantity : 0), 0)
  );
  const shipping = counted.length > 0 ? shippingFor(subtotal) : 0;
  const tax = round2(subtotal * TAX_RATE);

  return {
    lines,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotal,
    savings,
    shipping,
    tax,
    total: round2(subtotal + shipping + tax),
    hasProblem: lines.some((l) => l.problem),
  };
}