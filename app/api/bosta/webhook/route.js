import crypto from "crypto";
import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import Shipment from "@/models/Shipment";
import { syncRecords } from "@/lib/fulfillment";
import { BOSTA_DELIVERED, BOSTA_RETURNED, BOSTA_TERMINATED } from "@/lib/bostaStates";
import { NextResponse } from "next/server";

const ok = () => NextResponse.json({ received: true });

// Bosta doesn't sign its webhooks, so the secret travels inside the URL
function validSecret(given) {
  const expected = process.env.BOSTA_WEBHOOK_SECRET;
  if (!expected || !given) return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request) {
  if (!validSecret(new URL(request.url).searchParams.get("secret"))) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const trackingNumber = String(body.trackingNumber ?? body.tracking_number ?? "");
  const bostaId = String(body._id ?? body.id ?? "");
  const reference = String(body.businessReference ?? "");
  const rawState = body.state && typeof body.state === "object" ? body.state.code : body.state;
  const code = Number(rawState);

  console.log("Bosta webhook:", { trackingNumber, state: rawState }); // handy while testing

  await connectDB();

  // Find our shipment by tracking number, Bosta id, or our order number
  const match = [];
  if (trackingNumber) match.push({ trackingNumber });
  if (bostaId) match.push({ bostaId });

  let shipment = match.length ? await Shipment.findOne({ $or: match }) : null;
  if (!shipment && reference) {
    const o = await Order.findOne({ orderNumber: reference }).select("_id");
    if (o) shipment = await Shipment.findOne({ order: o._id });
  }
  if (!shipment) return ok(); // answer 200 so Bosta stops retrying

  const order = await Order.findById(shipment.order);

  if (Number.isFinite(code)) {
    shipment.bostaState = code;
    shipment.bostaStateAt = new Date();

    if (BOSTA_DELIVERED.includes(code)) {
      // Delivered: finish the order. Cash on delivery counts as paid now.
      if (order && order.status === "shipped") {
        order.status = "delivered";
        if (order.paymentMethod === "cod") {
          order.paymentStatus = "paid";
          order.paidAt = order.paidAt || new Date();
        }
        await order.save();
      }
    } else if (BOSTA_RETURNED.includes(code) || BOSTA_TERMINATED.includes(code)) {
      // The parcel came back or was canceled. The admin decides what happens to the order
      // (the "Parcel returned" button gives the stock back).
      shipment.status = "returned";
    }
  }

  await shipment.save();
  if (order) await syncRecords(order);
  return ok();
}