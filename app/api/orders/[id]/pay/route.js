import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import User from "@/models/User";
import { getAuth } from "@/lib/auth";
import { isOnlineAvailable, startCheckout } from "@/lib/stripe";
import { applyCheckoutSession } from "@/lib/stripePayments";
import { syncRecords } from "@/lib/fulfillment";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

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
    const result = await startCheckout(order, user);

    // It turned out the customer had already paid on the earlier page
    if (result.paidSession) {
      await applyCheckoutSession(result.paidSession);
      return bad("This order is already paid", 409);
    }

    order.stripe = { sessionId: result.session.id, paymentIntentId: "" };
    order.paymentStatus = "pending";
    await order.save();
    await syncRecords(order);

    return NextResponse.json({ checkoutUrl: result.url });
  } catch (error) {
    console.error("Could not start the Stripe payment:", error);

    // While developing, show the real reason. On a live site customers only see the short message.
    const detail = process.env.NODE_ENV !== "production" ? ` (${error.message})` : "";
    return bad(`Could not start the payment. Please try again.${detail}`, 500);
  }
}