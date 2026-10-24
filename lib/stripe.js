import Stripe from "stripe";
import Product from "@/models/Product";
import { bestOffer, getActiveOffers } from "@/lib/offers";

let client;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) throw new Error("STRIPE_SECRET_KEY is missing in the environment settings");
  if (key.startsWith("pk_")) {
    throw new Error("STRIPE_SECRET_KEY holds the publishable key (pk_...). It needs the secret key (sk_...).");
  }

  if (!client) client = new Stripe(key);
  return client;
}

// Card payments are offered only when the Stripe key is set
export function isOnlineAvailable(method) {
  return method === "card" && Boolean(process.env.STRIPE_SECRET_KEY);
}

export function availableMethods() {
  return isOnlineAvailable("card") ? ["cod", "card"] : ["cod"];
}

const SESSION_MINUTES = 31; // Stripe requires a session to stay open for at least 30 minutes

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const cents = (n) => Math.round(n * 100);

// Stripe wants a two-letter country code
function iso2(country) {
  const text = String(country ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(text)) return text.toUpperCase();
  if (/^egypt$/i.test(text) || text === "مصر") return "EG";
  return undefined;
}

// Works out what the customer is buying, as Stripe line items.
// Returns { lineItems, summary }. lineItems is null when the prices don't add up to the order total.
async function describeOrder(order) {
  const currency = String(order.currency).toLowerCase();
  const ids = [...new Set(order.items.map((i) => String(i.product)))];

  const [products, offers] = await Promise.all([
    Product.find({ _id: { $in: ids } }).select("name price image variants").lean(),
    getActiveOffers(),
  ]);
  const byId = new Map(products.map((p) => [String(p._id), p]));

  let complete = true;
  const rows = [];

  for (const item of order.items) {
    const product = byId.get(String(item.product));
    if (!product) {
      complete = false;
      rows.push({ name: "Product no longer in the store", label: item.variantLabel || "", quantity: item.quantity, unit: 0 });
      continue;
    }

    let unit = product.price;
    if (item.variantId) {
      const variant = product.variants?.find((v) => String(v._id) === String(item.variantId));
      if (variant) unit = variant.price;
      else complete = false;
    }

    // The same offer rules the order used, so the prices match what the customer was shown
    const deal = bestOffer(product._id, unit, offers);

    rows.push({
      productId: String(product._id),
      variantId: item.variantId ? String(item.variantId) : "",
      name: product.name,
      label: item.variantLabel || "",
      quantity: item.quantity,
      unit: deal ? round2(unit - deal.amount) : unit,
      image: product.image?.url,
    });
  }

  const summary = rows
    .map((r) => `${r.quantity}x ${r.name}${r.label ? ` (${r.label})` : ""}`)
    .join("; ")
    .slice(0, 480);

  // Do the lines, shipping and tax add up to exactly what the order charges?
  const itemsCents = rows.reduce((sum, r) => sum + cents(r.unit) * r.quantity, 0);
  const shippingCents = cents(order.shippingPrice || 0);
  const taxCents = cents(order.taxPrice || 0);
  const matches = complete && itemsCents + shippingCents + taxCents === cents(order.totalPrice);

  if (!matches) return { lineItems: null, summary };

  const lineItems = rows.map((r) => ({
    quantity: r.quantity,
    price_data: {
      currency,
      unit_amount: cents(r.unit),
      product_data: {
        name: r.name.slice(0, 250),
        ...(r.label ? { description: r.label.slice(0, 500) } : {}),
        ...(r.image && r.image.startsWith("https://") ? { images: [r.image] } : {}),
        metadata: { productId: r.productId, ...(r.variantId ? { variantId: r.variantId } : {}) },
      },
    },
  }));

  if (shippingCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: { currency, unit_amount: shippingCents, product_data: { name: "Shipping" } },
    });
  }
  if (taxCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: { currency, unit_amount: taxCents, product_data: { name: "Tax" } },
    });
  }

  return { lineItems, summary };
}

// Returns { url } for the page the customer pays on, or { paidSession } if it was already paid.
export async function startCheckout(order, user) {
  const stripe = getStripe();

  // Reuse a payment page that is still open, so the customer can never pay twice
  if (order.stripe?.sessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(order.stripe.sessionId);
      if (existing.payment_status === "paid") return { paidSession: existing };
      if (existing.status === "open" && existing.url) return { url: existing.url, session: existing };
    } catch {
      // can't find it: create a new one below
    }
  }

  const appUrl = String(process.env.APP_URL ?? "").trim().replace(/\/$/, "");
  if (!/^https?:\/\//.test(appUrl)) {
    throw new Error("APP_URL is missing or invalid. Use your site's address, like https://yourstore.com");
  }

  const currency = String(order.currency).toLowerCase();
  const { lineItems, summary } = await describeOrder(order);
  const a = order.shippingAddress;
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  const meta = {
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    ...(summary ? { items: summary } : {}),
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: meta.orderId,
    customer_email: user?.email || undefined,
    metadata: meta,
    payment_intent_data: {
      metadata: meta,
      description: `Order ${order.orderNumber} (${itemCount} ${itemCount === 1 ? "item" : "items"})`,
      // Shows under the payment in your Stripe Dashboard
      shipping: {
        name: a.fullName,
        phone: a.phone,
        address: {
          line1: a.street,
          city: a.city,
          ...(a.postalCode ? { postal_code: a.postalCode } : {}),
          ...(iso2(a.country) ? { country: iso2(a.country) } : {}),
        },
      },
    },
    line_items: lineItems ?? [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: cents(order.totalPrice),
          product_data: {
            name: `Order ${order.orderNumber}`,
            description: summary || "Includes shipping and any discounts",
          },
        },
      },
    ],
    success_url: `${appUrl}/orders/${order._id}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/orders/${order._id}/confirmation`,
    expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
  });

  return { url: session.url, session };
}