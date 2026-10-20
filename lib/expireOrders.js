import Order from "@/models/Order";
import { restoreStock } from "@/lib/stock";
import { syncRecords } from "@/lib/fulfillment";
const HOLD_MINUTES = 30;
const UNPAID = ["pending", "failed"];

export async function expireStaleOrders() {
  const cutoff = new Date(Date.now() - HOLD_MINUTES * 60 * 1000);

  const stale = await Order.find({
    status: "pending",
    paymentMethod: { $in: ["card", "wallet"] },
    paymentStatus: { $in: UNPAID },
    createdAt: { $lt: cutoff },
  }).limit(20);

  for (const order of stale) {
    // Claim it first, so two requests can't both give the stock back
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, status: "pending", paymentStatus: { $in: UNPAID } },
      { $set: { status: "cancelled" } }
    );
    if (!claimed) continue;
    for (const item of order.items) await restoreStock(item);

    const fresh = await Order.findById(order._id);
    if (fresh) await syncRecords(fresh);
  }
}