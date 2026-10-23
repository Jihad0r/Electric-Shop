import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import { getAuth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { applyCheckoutSession } from "@/lib/stripePayments";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request, { params }) {
  try {
    const auth = await getAuth();
    if (!auth) return bad("Please log in", 401);

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return bad("Invalid ID");

    const { sessionId } = await request.json().catch(() => ({}));
    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) return bad("Invalid session");

    await connectDB();
    const order = await Order.findById(id);
    if (!order || order.user.toString() !== auth.id) return bad("Order not found", 404);

    // Ask Stripe, don't trust the browser
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== String(order._id)) return bad("That payment isn't for this order");

    const result = await applyCheckoutSession(session);
    return NextResponse.json({ paid: result.paid });
  } catch (error) {
    console.error("Could not verify the Stripe payment:", error);
    return bad("Could not verify the payment", 500);
  }
}