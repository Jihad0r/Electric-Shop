import { connectDB } from "@/lib/mongoose";
import { getStripe } from "@/lib/stripe";
import { applyCheckoutSession, markFailed, markRefunded } from "@/lib/stripePayments";
import { NextResponse } from "next/server";

export async function POST(request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Webhook is not set up" }, { status: 400 });
  }

  // The signature is checked against the raw, unparsed body
  const body = await request.text();

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await connectDB();
    const object = event.data.object;

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await applyCheckoutSession(object); // only marks it paid if Stripe says it is paid
        break;

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        await markFailed(object.id);
        break;

      case "charge.refunded":
        if (object.refunded) await markRefunded(String(object.payment_intent ?? ""));
        break;

      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook failed:", error);
    // A 500 makes Stripe try again later
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}