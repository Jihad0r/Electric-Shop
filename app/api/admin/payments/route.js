import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];
const METHODS = ["cod", "card", "wallet"];

export async function GET(request) {
  try {
    const auth = await getAuth();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Number(searchParams.get("limit")) || 10);
    const paymentStatus = searchParams.get("paymentStatus");
    const method = searchParams.get("method");

    const filter = {};
    if (PAYMENT_STATUSES.includes(paymentStatus)) filter.paymentStatus = paymentStatus;
    if (METHODS.includes(method)) filter.paymentMethod = method;
    // Cancelled orders that were never paid are not "waiting for payment"
    if (filter.paymentStatus === "pending") filter.status = { $ne: "cancelled" };

    // Cancelled-and-unpaid orders are left out of the totals
    const live = {
      $or: [{ status: { $ne: "cancelled" } }, { paymentStatus: { $in: ["paid", "refunded"] } }],
    };

    const [orders, total, summaryRows, methodRows, needsRefund] = await Promise.all([
      Order.find(filter)
        .populate("user", "name email")
        .select("orderNumber user totalPrice currency paymentMethod paymentStatus paidAt status createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
      Order.aggregate([
        { $match: live },
        { $group: { _id: "$paymentStatus", amount: { $sum: "$totalPrice" }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: "$paymentMethod", amount: { $sum: "$totalPrice" } } },
      ]),
      Order.countDocuments({ status: "cancelled", paymentStatus: "paid" }),
    ]);

    const summary = {};
    for (const s of PAYMENT_STATUSES) summary[s] = { amount: 0, count: 0 };
    for (const row of summaryRows) summary[row._id] = { amount: row.amount, count: row.count };

    const paidByMethod = { cod: 0, card: 0, wallet: 0 };
    for (const row of methodRows) paidByMethod[row._id] = row.amount;

    return NextResponse.json({
      orders,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      summary,
      paidByMethod,
      needsRefund,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}