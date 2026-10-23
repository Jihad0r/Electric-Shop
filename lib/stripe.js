import Stripe from "stripe";

let client;

export function getStripe() {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
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

  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL is not set");

  const meta = { orderId: String(order._id), orderNumber: order.orderNumber };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: meta.orderId,
    customer_email: user?.email || undefined,
    metadata: meta,
    payment_intent_data: { metadata: meta, description: `Order ${order.orderNumber}` },
    // One line for the whole order, so shipping and discounts are already included
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: String(order.currency).toLowerCase(),
          unit_amount: Math.round(order.totalPrice * 100),
          product_data: {
            name: `Order ${order.orderNumber}`,
            description: "Includes shipping and any discounts",
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