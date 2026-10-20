import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import { verifyHmac } from "@/lib/paymob";
import { NextResponse } from "next/server";
mport { syncRecords } from "@/lib/fulfillment";
const ok = () => NextResponse.json({ received: true });

export async function POST(request) {
  const hmac = new URL(request.url).searchParams.get("hmac");
  const body = await request.json().catch(() => null);
  const obj = body?.obj;

  // Reject anything that isn't a genuine Paymob transaction callback
  if (body?.type !== "TRANSACTION" || !obj || !verifyHmac(obj, hmac)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  await connectDB();

  // special_reference was "<orderNumber>_<attempt>"
  const orderNumber = String(obj.order?.merchant_order_id ?? "").split("_")[0];
  const order =
    (orderNumber && (await Order.findOne({ orderNumber }))) ||
    (obj.order?.id ? await Order.findOne({ "paymob.orderId": String(obj.order.id) }) : null);

  // Answer 200 for unknown orders so Paymob stops retrying
  if (!order) return ok();

  if (obj.is_refunded) {
    order.paymentStatus = "refunded";
  } else if (obj.success === true && !obj.pending) {
    // Paymob can send the same callback more than once
    if (order.paymentStatus === "paid") return ok();

    // The amount and currency paid must match what we asked for
    const paid = Number(obj.amount_cents);
    if (
      paid !== Math.round(order.totalPrice * 100) ||
      String(obj.currency).toUpperCase() !== String(order.currency).toUpperCase()
    ) {
      console.error("Paymob amount mismatch for", order.orderNumber);
      return ok();
    }

    order.paymentStatus = "paid";
    order.paidAt = new Date();
    order.paymob.transactionId = String(obj.id);

    // If the order was cancelled while the customer was paying, it stays cancelled but is
    // marked paid, so the Payments page flags it as "Needs refund"
    if (order.status === "pending") order.status = "confirmed";
  } else if (obj.success === false && !obj.pending) {
    if (order.paymentStatus !== "paid") order.paymentStatus = "failed";
  } else {
    return ok();
  }

  await order.save();
  await syncRecords(order);
  return ok();
}