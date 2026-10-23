import Order from "@/models/Order";
import Shipment from "@/models/Shipment";
import { isAramexConfigured, trackShipments } from "@/lib/aramex";
import { classifyUpdate } from "@/lib/aramexStates";
import { syncRecords } from "@/lib/fulfillment";

const STALE_MS = 10 * 60 * 1000; // a parcel is checked at most every 10 minutes

// Asks Aramex for the latest news on shipped parcels. Call connectDB() first.
// Options: { orderId } to check one order, { force: true } to ignore the 10 minute limit.
export async function syncShipments({ orderId, force = false, limit = 20 } = {}) {
  if (!isAramexConfigured()) return { checked: 0, delivered: 0 };

  const filter = { status: "shipped", trackingNumber: { $ne: "" } };
  if (orderId) filter.order = orderId;
  if (!force) {
    const cutoff = new Date(Date.now() - STALE_MS);
    filter.$or = [{ lastSyncedAt: null }, { lastSyncedAt: { $lt: cutoff } }];
  }

  const shipments = await Shipment.find(filter).sort({ lastSyncedAt: 1 }).limit(limit);
  if (shipments.length === 0) return { checked: 0, delivered: 0 };

  let latest;
  try {
    latest = await trackShipments(shipments.map((s) => s.trackingNumber));
  } catch (error) {
    console.error("Aramex tracking failed:", error.message);
    return { checked: 0, delivered: 0, error: error.message };
  }

  let delivered = 0;

  for (const shipment of shipments) {
    const update = latest.get(shipment.trackingNumber);
    shipment.lastSyncedAt = new Date();

    let outcome = "other";
    if (update) {
      shipment.lastUpdateCode = update.code;
      shipment.lastUpdateText = update.text;
      shipment.lastUpdateAt = update.at ?? new Date();

      outcome = classifyUpdate(update.code, update.text);
      console.log("Aramex update:", shipment.trackingNumber, update.code, update.text, "->", outcome);

      if (outcome === "returned") shipment.status = "returned";
    }
    await shipment.save();

    if (outcome === "delivered") {
      const order = await Order.findById(shipment.order);
      if (order && order.status === "shipped") {
        order.status = "delivered";
        // Cash on delivery: the money is collected when the parcel is delivered
        if (order.paymentMethod === "cod") {
          order.paymentStatus = "paid";
          order.paidAt = order.paidAt || new Date();
        }
        await order.save();
        delivered++;
      }
      if (order) await syncRecords(order);
    }
  }

  return { checked: shipments.length, delivered };
}