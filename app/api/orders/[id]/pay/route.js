import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import User from "@/models/User";
import { getAuth } from "@/lib/auth";
import { checkoutUrl, createIntention, isOnlineAvailable } from "@/lib/paymob";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { syncRecords } from "@/lib/fulfillment";
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request, { params }) {
  try {
    const auth = await getAuth();
    if (!auth) return bad("Please log in", 401);

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return bad("Invalid ID");

    await connectDB();
    const order = await Order.findById(id);
    if (!order || order.user.toString() !== auth.id) return bad("Order not found", 404);

    if (order.paymentMethod === "cod") return bad("This order is cash on delivery");
    if (!isOnlineAvailable(order.paymentMethod)) return bad("Online payment isn't available right now");
    if (order.paymentStatus === "paid") return bad("This order is already paid");
    if (order.status !== "pending") return bad("This order can no longer be paid");

    const user = await User.findById(auth.id);
    const intention = await createIntention({ order, user, attempt: Date.now() });

    order.paymob = {
      intentionId: String(intention.id ?? ""),
      orderId: String(intention.intention_order_id ?? ""),
      transactionId: "",
    };
    order.paymentStatus = "pending";
    await order.save();
 await syncRecords(order); 
    return NextResponse.json({ checkoutUrl: checkoutUrl(intention.client_secret) });
  } catch (error) {
    console.error(error);
    return bad("Could not start the payment", 500);
  }
}