
import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

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
  const { order, error, status } = await loadOrder(id, auth);
  if (error) return NextResponse.json({ error }, { status });

  await order.populate([
    { path: "user", select: "name email" },
    { path: "items.product", select: "name price image" },
  ]);
  return NextResponse.json(order);
}

// PATCH /api/orders/:id
// Admin: { status, paymentStatus }
// User:  { status: "cancelled" } (only while pending)
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

    if (body.status && body.status !== order.status) {
      if (!isAdmin && !(body.status === "cancelled" && order.status === "pending")) {
        return NextResponse.json(
          { error: "You can only cancel an order that is still pending" },
          { status: 403 }
        );
      }
      if (!TRANSITIONS[order.status].includes(body.status)) {
        return NextResponse.json(
          { error: `Cannot change status from ${order.status} to ${body.status}` },
          { status: 400 }
        );
      }

      order.status = body.status;

      if (body.status === "delivered" && order.paymentMethod === "cod") {
        order.paymentStatus = "paid";
        order.paidAt = new Date();
      }

      if (body.status === "cancelled") {
        // Give the stock back
        for (const item of order.items) {
          await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
        }
      }
    }

    // Admin-only field
    if (isAdmin && body.paymentStatus) {
      order.paymentStatus = body.paymentStatus;
      if (body.paymentStatus === "paid" && !order.paidAt) order.paidAt = new Date();
    }

    await order.save();
    return NextResponse.json(order);
  } catch (error) {
    const status = error.name === "ValidationError" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}