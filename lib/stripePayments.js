import mongoose from "mongoose";
import Order from "@/models/Order";
import { syncRecords } from "@/lib/fulfillment";

const intentId = (value) => (typeof value === "string" ? value : (value?.id ?? ""));

// Marks the order paid from a Checkout Session. Safe to call any number of times.
// Used by the webhook and by the page the customer returns to.
export async function applyCheckoutSession(session) {
  const orderId = session.client_reference_id || session.metadata?.orderId;
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) return { ok: false, paid: false };

  const order = await Order.findById(orderId);
  if (!order) return { ok: false, paid: false };

  if (order.paymentStatus === "paid") return { ok: true, paid: true, order };
  if (session.payment_status !== "paid") return { ok: true, paid: false, order };

  // The amount and currency paid must match what we asked for
  const expected = Math.round(order.totalPrice * 100);
  if (
    session.amount_total !== expected ||
    String(session.currency).toLowerCase() !== String(order.currency).toLowerCase()
  ) {
    console.error("Stripe amount mismatch for", order.orderNumber, session.amount_total, expected);
    return { ok: false, paid: false, order };
  }

  order.paymentStatus = "paid";
  order.paidAt = new Date();
  order.stripe = { sessionId: session.id, paymentIntentId: intentId(session.payment_intent) };

  // If the order was cancelled while the customer was paying, it stays cancelled but is marked
  // paid, so the Payments page flags it "Needs refund"
  if (order.status === "pending") order.status = "confirmed";

  await order.save();
  await syncRecords(order);
  return { ok: true, paid: true, order };
}

// Called when a payment is refunded in the Stripe Dashboard
export async function markRefunded(paymentIntentId) {
  if (!paymentIntentId) return;

  const order = await Order.findOne({ "stripe.paymentIntentId": paymentIntentId });
  if (!order || order.paymentStatus === "refunded") return;

  order.paymentStatus = "refunded";
  await order.save();
  await syncRecords(order);
}

// A payment page expired or failed. Only the order's latest page counts.
export async function markFailed(sessionId) {
  const order = await Order.findOne({ "stripe.sessionId": sessionId });
  if (!order || order.paymentStatus === "paid") return;

  order.paymentStatus = "failed";
  await order.save();
  await syncRecords(order);
}