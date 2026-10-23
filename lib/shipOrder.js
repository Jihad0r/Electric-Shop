import Order from "@/models/Order";
import Shipment from "@/models/Shipment";
import User from "@/models/User";
import { createAramexShipment, isAramexConfigured } from "@/lib/aramex";
import { syncRecords } from "@/lib/fulfillment";

// Creates the Aramex shipment and marks the order as shipped.
// If Aramex fails, the order stays "confirmed" and the error is saved so you can retry.
export async function shipOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status === "shipped") return { ok: true, order };

  if (!["pending", "confirmed"].includes(order.status)) {
    return { ok: false, error: `A ${order.status} order can't be shipped` };
  }
  if (order.paymentMethod !== "cod" && order.paymentStatus !== "paid") {
    return { ok: false, error: "This order hasn't been paid yet" };
  }
  if (!isAramexConfigured()) {
    return { ok: false, error: "Aramex isn't set up yet. Add the ARAMEX_ values to .env.local." };
  }

  await syncRecords(order);
  const shipment = await Shipment.findOne({ order: order._id });
  if (!shipment) return { ok: false, error: "Could not prepare the shipment record" };

  // A shipment may already exist at Aramex from an earlier attempt that failed afterwards.
  // Reusing it avoids creating a second parcel.
  if (!shipment.trackingNumber) {
    try {
      const user = await User.findById(order.user).select("email").lean();
      const created = await createAramexShipment(order, { email: user?.email });

      shipment.trackingNumber = created.trackingNumber;
      shipment.labelUrl = created.labelUrl;
      shipment.courier = "Aramex";
      shipment.lastError = "";
      await shipment.save();
    } catch (error) {
      shipment.lastError = String(error.message).slice(0, 300);
      await shipment.save();

      if (order.status === "pending") {
        order.status = "confirmed";
        await order.save();
        await syncRecords(order);
      }
      return { ok: false, error: error.message };
    }
  }

  order.status = "shipped";
  await order.save();
  await syncRecords(order);
  return { ok: true, order };
}