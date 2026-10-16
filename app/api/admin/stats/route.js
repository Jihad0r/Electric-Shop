import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import Product from "@/models/Product";
import User from "@/models/User";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

const TIMEZONE = "Africa/Cairo"; // days in the chart follow this time zone
const LOW_STOCK = 5;

const dayKey = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(date); // 2026-10-16

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();

    const days = Array.from({ length: 7 }, (_, i) =>
      dayKey(new Date(Date.now() - (6 - i) * 86400000))
    );
    const since = new Date(Date.now() - 8 * 86400000);

    const [totals, perDay, statusRows, customers, products, recentOrders, lowStock] =
      await Promise.all([
        Order.aggregate([
          { $match: { status: { $ne: "cancelled" } } },
          { $group: { _id: null, sales: { $sum: "$totalPrice" } } },
        ]),
        Order.aggregate([
          { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TIMEZONE } },
              sales: { $sum: "$totalPrice" },
              orders: { $sum: 1 },
            },
          },
        ]),
        Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        User.countDocuments({ role: "user" }),
        Product.countDocuments(),
        Order.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .populate("user", "name")
          .select("orderNumber user totalPrice currency status paymentStatus createdAt")
          .lean(),
        Product.find({ stock: { $lte: LOW_STOCK } })
          .sort({ stock: 1 })
          .limit(5)
          .select("name stock image")
          .lean(),
      ]);

    const byDay = new Map(perDay.map((d) => [d._id, d]));
    const daily = days.map((date) => ({
      date,
      sales: byDay.get(date)?.sales ?? 0,
      orders: byDay.get(date)?.orders ?? 0,
    }));

    const byStatus = { pending: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0 };
    for (const row of statusRows) byStatus[row._id] = row.count;
    const totalOrders = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

    return NextResponse.json({
      totalSales: totals[0]?.sales ?? 0,
      totalOrders,
      customers,
      products,
      daily,
      byStatus,
      recentOrders,
      lowStock,
      lowStockLimit: LOW_STOCK,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}