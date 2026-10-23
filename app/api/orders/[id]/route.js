import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import { restoreStock } from "@/lib/stock";
import { setShipmentDetails, syncRecords } from "@/lib/fulfillment";
import { shipOrder } from "@/lib/shipOrder";
import { syncShipments } from "@/lib/syncTracking";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"], // cancelling a shipped order = the parcel came back (admin only)
  delivered: [],
  cancelled: [],
};

const SHIPMENT_FIELDS =
  "courier trackingNumber labelUrl status lastUpdateText lastUpdateAt lastError";

async function loadOrder(id, auth) {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: "Invalid ID", status: 400 };
  const order = await Order.findById(id);
  if (!order) return { error: "Order not found", status: 404 };
  if (auth.role !== "admin" && order.user.toString() !== auth.id) {
    return { error: "Order not found", status: 404 };
  }
  return { order };
}

// GET /api/orders/:id
export async function GET(request, { params }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Please log in" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const loaded = await loadOrder(id, auth);
  if (loaded.error) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  let order = loaded.order;

  // A shipped parcel: ask Aramex for news (at most every 10 minutes per parcel)
  if (order.status === "shipped") {
    await syncShipments({ orderId: order._id }).catch((e) => console.error(e));
    order = (await Order.findById(order._id)) ?? order;
  }

  await order.populate([
    { path: "user", select: "name email" },
    { path: "items.product", select: "name price image variants" },
    { path: "payment" },
    { path: "shipment", select: SHIPMENT_FIELDS },
  ]);
  return NextResponse.json(order);
}

// PATCH /api/orders/:id
// Admin: { status, paymentStatus, courier, trackingNumber }
// Customer: { status: "cancelled" } (only while pending and unpaid)
export async function PATCH(request, { params }) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Please log in" }, { status: 401 });

    const { id } = await params;
    await connectDB();
    const { order, error, status: errStatus } = await loadOrder(id, auth);
    if (error) return NextResponse.json({ error }, { status: errStatus });

    const body = await request.json();
    const isAdmin = auth.role === "admin";

    // Shipping goes through Aramex: the shipment is created first, then the order is marked shipped
    if (body.status === "shipped" && order.status !== "shipped") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Only an admin can ship an order" }, { status: 403 });
      }
      const result = await shipOrder(order._id);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

      const shipped = await Order.findById(order._id).populate("shipment", SHIPMENT_FIELDS);
      return NextResponse.json(shipped);
    }

    if (body.status && body.status !== order.status) {
      if (!isAdmin && !(body.status === "cancelled" && order.status === "pending")) {
        return NextResponse.json(
          { error: "You can only cancel an order that is still pending" },
          { status: 403 }
        );
      }
      if (body.status === "cancelled" && order.paymentStatus === "paid" && !isAdmin) {
        return NextResponse.json(
          { error: "Paid orders can't be cancelled here. Please contact support for a refund." },
          { status: 400 }
        );
      }
      if (!TRANSITIONS[order.status].includes(body.status)) {
        return NextResponse.json(
          { error: `Cannot change status from ${order.status} to ${body.status}` },
          { status: 400 }
        );
      }

      order.status = body.status;

      // Cash on delivery: the money is collected when the parcel is delivered
      if (body.status === "delivered" && order.paymentMethod === "cod") {
        order.paymentStatus = "paid";
        order.paidAt = new Date();
      }

      if (body.status === "cancelled") {
        // Give the stock back
        for (const item of order.items) {
          await restoreStock(item);
        }
      }
    }

    // Admin-only field
    if (isAdmin && body.paymentStatus) {
      order.paymentStatus = body.paymentStatus;
      if (body.paymentStatus === "paid" && !order.paidAt) order.paidAt = new Date();
    }

    await order.save();

    // Keep the Payment and Shipment records in step with the order
    await syncRecords(order);
    if (isAdmin) await setShipmentDetails(order._id, body);

    const fresh = await Order.findById(order._id).populate("shipment", SHIPMENT_FIELDS);
    return NextResponse.json(fresh);
  } catch (error) {
    const status = error.name === "ValidationError" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}